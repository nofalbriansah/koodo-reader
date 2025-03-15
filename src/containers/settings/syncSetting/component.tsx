import React from "react";
import { SettingInfoProps, SettingInfoState } from "./interface";
import { Trans } from "react-i18next";
import i18n from "../../../i18n";
import { removeCloudConfig } from "../../../utils/file/common";
import { isElectron } from "react-device-detect";
import _ from "underscore";
import { syncSettingList } from "../../../constants/settingList";
import { themeList } from "../../../constants/themeList";
import toast from "react-hot-toast";
import {
  handleContextMenu,
  openExternalUrl,
  WEBSITE_URL,
} from "../../../utils/common";
import { getStorageLocation } from "../../../utils/common";
import { driveInputConfig, driveList } from "../../../constants/driveList";
import {
  ConfigService,
  SyncUtil,
  TokenService,
} from "../../../assets/lib/kookit-extra-browser.min";
import {
  encryptToken,
  onSyncCallback,
} from "../../../utils/request/thirdparty";
import SyncService from "../../../utils/storage/syncService";
declare var window: any;
class SyncSetting extends React.Component<SettingInfoProps, SettingInfoState> {
  constructor(props: SettingInfoProps) {
    super(props);
    this.state = {
      isTouch: ConfigService.getReaderConfig("isTouch") === "yes",
      isImportPath: ConfigService.getReaderConfig("isImportPath") === "yes",
      isMergeWord: ConfigService.getReaderConfig("isMergeWord") === "yes",
      isPreventTrigger:
        ConfigService.getReaderConfig("isPreventTrigger") === "yes",
      isAutoFullscreen:
        ConfigService.getReaderConfig("isAutoFullscreen") === "yes",
      isPreventAdd: ConfigService.getReaderConfig("isPreventAdd") === "yes",
      isLemmatizeWord:
        ConfigService.getReaderConfig("isLemmatizeWord") === "yes",
      isOpenBook: ConfigService.getReaderConfig("isOpenBook") === "yes",
      isExpandContent:
        ConfigService.getReaderConfig("isExpandContent") === "yes",
      isDisablePopup: ConfigService.getReaderConfig("isDisablePopup") === "yes",
      isDisableTrashBin:
        ConfigService.getReaderConfig("isDisableTrashBin") === "yes",
      isDeleteShelfBook:
        ConfigService.getReaderConfig("isDeleteShelfBook") === "yes",
      isHideShelfBook:
        ConfigService.getReaderConfig("isHideShelfBook") === "yes",
      isPreventSleep: ConfigService.getReaderConfig("isPreventSleep") === "yes",
      isOpenInMain: ConfigService.getReaderConfig("isOpenInMain") === "yes",
      isDisableUpdate:
        ConfigService.getReaderConfig("isDisableUpdate") === "yes",
      isPrecacheBook: ConfigService.getReaderConfig("isPrecacheBook") === "yes",
      isDisableMobilePrecache:
        ConfigService.getReaderConfig("isDisableMobilePrecache") === "yes",
      appSkin: ConfigService.getReaderConfig("appSkin"),
      isUseBuiltIn: ConfigService.getReaderConfig("isUseBuiltIn") === "yes",
      isKeepLocal: ConfigService.getReaderConfig("isKeepLocal") === "yes",
      isDisableCrop: ConfigService.getReaderConfig("isDisableCrop") === "yes",
      isDisablePDFCover:
        ConfigService.getReaderConfig("isDisablePDFCover") === "yes",
      currentThemeIndex: _.findLastIndex(themeList, {
        name: ConfigService.getReaderConfig("themeColor"),
      }),
      storageLocation: getStorageLocation() || "",
      isAddNew: false,
      settingLogin: "",
      driveConfig: {},
      loginConfig: {},
    };
  }
  handleRest = (_bool: boolean) => {
    toast.success(this.props.t("Change successful"));
  };
  handleJump = (url: string) => {
    openExternalUrl(url);
  };
  handleSetting = (stateName: string) => {
    this.setState({ [stateName]: !this.state[stateName] } as any);
    ConfigService.setReaderConfig(
      stateName,
      this.state[stateName] ? "no" : "yes"
    );
    this.handleRest(this.state[stateName]);
  };
  handleAddDataSource = (event: any) => {
    if (!event.target.value) {
      return;
    }
    if (
      !driveList
        .find((item) => item.value === event.target.value)
        ?.support.includes("browser") &&
      !isElectron
    ) {
      toast(
        this.props.t(
          "Koodo Reader's web version are limited by the browser, for more powerful features, please download the desktop version."
        )
      );
      return;
    }
    if (
      driveList.find((item) => item.value === event.target.value)?.isPro &&
      !this.props.isAuthed
    ) {
      toast(this.props.t("This feature is not available in the free version"));
      return;
    }
    this.props.handleSettingDrive(event.target.value);
  };
  handleDeleteDataSource = async (event: any) => {
    if (!event.target.value) {
      return;
    }
    await TokenService.setToken(event.target.value + "_token", "");
    SyncService.removeSyncUtil(event.target.value);
    removeCloudConfig(event.target.value);
    if (isElectron) {
      const { ipcRenderer } = window.require("electron");
      await ipcRenderer.invoke("cloud-close", {
        service: event.target.value,
      });
    }
    ConfigService.deleteListConfig(event.target.value, "dataSourceList");
    this.props.handleFetchDataSourceList();
    toast.success(this.props.t("Deletion successful"));
  };
  handleSetDefaultSyncOption = (event: any) => {
    if (!event.target.value) {
      return;
    }
    ConfigService.setItem("defaultSyncOption", event.target.value);
    this.props.handleFetchDefaultSyncOption();
    toast.success(this.props.t("Change successful"));
  };
  handleCancelDrive = () => {
    this.props.handleSettingDrive("");
  };
  handleConfirmDrive = async () => {
    let flag = true;
    for (let item of driveInputConfig[this.props.settingDrive]) {
      if (!this.state.driveConfig[item.value]) {
        toast.error(
          this.props.t("Missing parameters") + ": " + this.props.t(item.label)
        );
        flag = false;
        break;
      }
    }
    if (!flag) {
      return;
    }
    if (
      this.props.settingDrive === "webdav" ||
      this.props.settingDrive === "ftp" ||
      this.props.settingDrive === "sftp" ||
      this.props.settingDrive === "mega" ||
      this.props.settingDrive === "s3compatible"
    ) {
      toast.loading(i18n.t("Adding"), { id: "adding-sync-id" });
      let res = await encryptToken(
        this.props.settingDrive,
        this.state.driveConfig
      );
      if (res.code === 200) {
        ConfigService.setListConfig(this.props.settingDrive, "dataSourceList");
        toast.success(i18n.t("Binding successful"), { id: "adding-sync-id" });
      } else {
        toast.error(i18n.t("Binding failed"), { id: "adding-sync-id" });
      }
    } else {
      await onSyncCallback(
        this.props.settingDrive,
        this.state.driveConfig.token
      );
    }
    if (this.props.isAuthed) {
      ConfigService.setItem("defaultSyncOption", this.props.settingDrive);
      this.props.handleFetchDefaultSyncOption();
    }
    this.props.handleFetchDataSourceList();
    this.props.handleSettingDrive("");
  };
  renderSwitchOption = (optionList: any[]) => {
    return optionList.map((item) => {
      return (
        <div
          style={item.isElectron ? (isElectron ? {} : { display: "none" }) : {}}
          key={item.propName}
        >
          <div className="setting-dialog-new-title" key={item.title}>
            <span style={{ width: "calc(100% - 100px)" }}>
              <Trans>{item.title}</Trans>
            </span>

            <span
              className="single-control-switch"
              onClick={() => {
                switch (item.propName) {
                  default:
                    this.handleSetting(item.propName);
                    break;
                }
              }}
              style={this.state[item.propName] ? {} : { opacity: 0.6 }}
            >
              <span
                className="single-control-button"
                style={
                  this.state[item.propName]
                    ? {
                        transform: "translateX(20px)",
                        transition: "transform 0.5s ease",
                      }
                    : {
                        transform: "translateX(0px)",
                        transition: "transform 0.5s ease",
                      }
                }
              ></span>
            </span>
          </div>
          <p className="setting-option-subtitle">
            <Trans>{item.desc}</Trans>
          </p>
        </div>
      );
    });
  };
  render() {
    return (
      <>
        {this.props.settingDrive && (
          <div
            className="voice-add-new-container"
            style={{
              marginLeft: "25px",
              width: "calc(100% - 50px)",
              fontWeight: 500,
            }}
          >
            {this.props.settingDrive === "webdav" ||
            this.props.settingDrive === "ftp" ||
            this.props.settingDrive === "sftp" ||
            this.props.settingDrive === "mega" ||
            this.props.settingDrive === "s3compatible" ? (
              <>
                {driveInputConfig[this.props.settingDrive].map((item) => {
                  return (
                    <input
                      type={item.type}
                      name={item.value}
                      key={item.value}
                      placeholder={this.props.t(item.label)}
                      onChange={(e) => {
                        if (e.target.value) {
                          this.setState((prevState) => ({
                            driveConfig: {
                              ...prevState.driveConfig,
                              [item.value]: e.target.value.trim(),
                            },
                          }));
                        }
                      }}
                      onContextMenu={() => {
                        handleContextMenu(
                          "token-dialog-" + item.value + "-box",
                          true
                        );
                      }}
                      id={"token-dialog-" + item.value + "-box"}
                      className="token-dialog-username-box"
                    />
                  );
                })}
              </>
            ) : (
              <>
                <textarea
                  className="token-dialog-token-box"
                  id="token-dialog-token-box"
                  placeholder={this.props.t(
                    "Please authorize your account, and fill the following box with the token"
                  )}
                  onChange={(e) => {
                    if (e.target.value) {
                      this.setState((prevState) => ({
                        driveConfig: {
                          ...prevState.driveConfig,
                          token: e.target.value.trim(),
                        },
                      }));
                    }
                  }}
                  onContextMenu={() => {
                    handleContextMenu("token-dialog-token-box");
                  }}
                />
              </>
            )}
            <div className="token-dialog-button-container">
              <div
                className="voice-add-confirm"
                onClick={async () => {
                  this.handleConfirmDrive();
                }}
              >
                <Trans>Bind</Trans>
              </div>

              <div className="voice-add-button-container">
                <div
                  className="voice-add-cancel"
                  onClick={() => {
                    this.handleCancelDrive();
                  }}
                >
                  <Trans>Cancel</Trans>
                </div>
                {(this.props.settingDrive === "dropbox" ||
                  this.props.settingDrive === "google" ||
                  this.props.settingDrive === "boxnet" ||
                  this.props.settingDrive === "pcloud" ||
                  this.props.settingDrive === "adrive" ||
                  this.props.settingDrive === "microsoft") && (
                  <div
                    className="voice-add-confirm"
                    style={{ marginRight: "10px" }}
                    onClick={async () => {
                      this.handleJump(
                        new SyncUtil(this.props.settingDrive, {}).getAuthUrl()
                      );
                    }}
                  >
                    <Trans>Authorize</Trans>
                  </div>
                )}
                {isElectron &&
                  (this.props.settingDrive === "webdav" ||
                    this.props.settingDrive === "ftp" ||
                    this.props.settingDrive === "sftp" ||
                    this.props.settingDrive === "mega" ||
                    this.props.settingDrive === "s3compatible") && (
                    <div
                      className="voice-add-confirm"
                      style={{ marginRight: "10px" }}
                      onClick={async () => {
                        toast.loading(this.props.t("Testing connection..."), {
                          id: "testing-connection-id",
                        });
                        const { ipcRenderer } = window.require("electron");
                        const fs = window.require("fs");
                        fs.writeFileSync(
                          getStorageLocation() + "/config/test.txt",
                          "Hello world!"
                        );
                        let driveConfig: any = {};
                        for (let item in this.state.driveConfig) {
                          driveConfig[item] = this.state.driveConfig[item];
                        }
                        let result = await ipcRenderer.invoke("cloud-upload", {
                          ...driveConfig,
                          fileName: "test.txt",
                          service: this.props.settingDrive,
                          type: "config",
                          storagePath: getStorageLocation(),
                          isUseCache: false,
                        });
                        if (result) {
                          toast.success(this.props.t("Connection successful"), {
                            id: "testing-connection-id",
                          });
                          await ipcRenderer.invoke("cloud-delete", {
                            ...driveConfig,
                            fileName: "test.txt",
                            service: this.props.settingDrive,
                            type: "config",
                            storagePath: getStorageLocation(),
                            isUseCache: false,
                          });
                        } else {
                          toast.error(this.props.t("Connection failed"), {
                            id: "testing-connection-id",
                          });
                        }
                        fs.unlinkSync(
                          getStorageLocation() + "/config/test.txt"
                        );
                      }}
                    >
                      <Trans>Test</Trans>
                    </div>
                  )}
                {(this.props.settingDrive === "webdav" ||
                  this.props.settingDrive === "ftp" ||
                  this.props.settingDrive === "sftp") &&
                  (ConfigService.getReaderConfig("lang") === "zhCN" ||
                    ConfigService.getReaderConfig("lang") === "zhTW" ||
                    ConfigService.getReaderConfig("lang") === "zhMO") && (
                    <div
                      className="voice-add-cancel"
                      style={{ borderWidth: 0 }}
                      onClick={() => {
                        openExternalUrl(WEBSITE_URL + "/zh/add-source");
                      }}
                    >
                      {this.props.t("How to fill out")}
                    </div>
                  )}
              </div>
            </div>
          </div>
        )}
        <div className="setting-dialog-new-title">
          <Trans>Add data source</Trans>
          <select
            name=""
            className="lang-setting-dropdown"
            onChange={this.handleAddDataSource}
          >
            {[{ label: "Please select", value: "", isPro: false }, ...driveList]
              .filter((item) => !this.props.dataSourceList.includes(item.value))
              .map((item) => (
                <option
                  value={item.value}
                  key={item.value}
                  className="lang-setting-option"
                >
                  {this.props.t(item.label) + (item.isPro ? " (Pro)" : "")}
                </option>
              ))}
          </select>
        </div>
        <div className="setting-dialog-new-title">
          <Trans>Delete data source</Trans>
          <select
            name=""
            className="lang-setting-dropdown"
            onChange={this.handleDeleteDataSource}
          >
            {[{ label: "Please select", value: "", isPro: false }, ...driveList]
              .filter(
                (item) =>
                  this.props.dataSourceList.includes(item.value) ||
                  item.value === ""
              )
              .map((item) => (
                <option
                  value={item.value}
                  key={item.value}
                  className="lang-setting-option"
                >
                  {this.props.t(item.label) + (item.isPro ? " (Pro)" : "")}
                </option>
              ))}
          </select>
        </div>
        {this.props.isAuthed && (
          <div className="setting-dialog-new-title">
            <Trans>Set default sync option</Trans>
            <select
              name=""
              className="lang-setting-dropdown"
              onChange={this.handleSetDefaultSyncOption}
            >
              {[
                { label: "Please select", value: "", isPro: false },
                ...driveList,
              ]
                .filter(
                  (item) =>
                    this.props.dataSourceList.includes(item.value) ||
                    item.value === "" ||
                    item.value === "local"
                )
                .map((item) => (
                  <option
                    value={item.value}
                    key={item.value}
                    className="lang-setting-option"
                    selected={
                      item.value === this.props.defaultSyncOption ? true : false
                    }
                  >
                    {this.props.t(item.label) + (item.isPro ? " (Pro)" : "")}
                  </option>
                ))}
            </select>
          </div>
        )}
        {this.renderSwitchOption(syncSettingList)}
      </>
    );
  }
}

export default SyncSetting;
