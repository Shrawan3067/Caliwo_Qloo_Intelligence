const { withEntitlementsPlist, withAndroidManifest, withDangerousMod, createRunOncePlugin } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Expo Config Plugin to enable iOS App Group entitlements, Android AppWidget receivers,
 * and network security configuration for Caliwo.
 */
function withWidgetsPlugin(config) {
  // 1. Add iOS App Group Entitlement
  config = withEntitlementsPlist(config, (config) => {
    const existingGroups = config.modResults["com.apple.security.application-groups"] || [];
    const appGroup = "group.com.caliwo.ainutritioncoach";

    if (!existingGroups.includes(appGroup)) {
      config.modResults["com.apple.security.application-groups"] = [...existingGroups, appGroup];
    }
    return config;
  });

  // 2. Write Android XML resource files
  config = withDangerousMod(config, [
    "android",
    async (config) => {
      const xmlDir = path.join(config.modRequest.platformProjectRoot, "app/src/main/res/xml");
      if (!fs.existsSync(xmlDir)) {
        fs.mkdirSync(xmlDir, { recursive: true });
      }

      const todayWidgetInfo = `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="180dp"
    android:minHeight="110dp"
    android:updatePeriodMillis="1800000"
    android:initialLayout="@android:layout/simple_list_item_1"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen">
</appwidget-provider>`;

      const waterWidgetInfo = `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="180dp"
    android:minHeight="110dp"
    android:updatePeriodMillis="1800000"
    android:initialLayout="@android:layout/simple_list_item_1"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen">
</appwidget-provider>`;

      const backupRules = `<?xml version="1.0" encoding="utf-8"?>
<full-backup-content>
    <exclude domain="sharedpref" path="secure_store.xml" />
</full-backup-content>`;

      const dataExtractionRules = `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
    <cloud-backup>
        <exclude domain="sharedpref" path="secure_store.xml" />
    </cloud-backup>
    <device-to-device-backup>
        <exclude domain="sharedpref" path="secure_store.xml" />
    </device-to-device-backup>
</data-extraction-rules>`;

      fs.writeFileSync(path.join(xmlDir, "today_intake_widget_info.xml"), todayWidgetInfo, "utf8");
      fs.writeFileSync(path.join(xmlDir, "log_water_widget_info.xml"), waterWidgetInfo, "utf8");
      if (!fs.existsSync(path.join(xmlDir, "secure_store_backup_rules.xml"))) {
        fs.writeFileSync(path.join(xmlDir, "secure_store_backup_rules.xml"), backupRules, "utf8");
      }
      if (!fs.existsSync(path.join(xmlDir, "secure_store_data_extraction_rules.xml"))) {
        fs.writeFileSync(path.join(xmlDir, "secure_store_data_extraction_rules.xml"), dataExtractionRules, "utf8");
      }

      // Network Security Config — allows cleartext HTTP to backend IP
      const networkSecurityConfig = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">54.196.186.142</domain>
        <domain includeSubdomains="true">10.0.2.2</domain>
        <domain includeSubdomains="true">localhost</domain>
        <domain includeSubdomains="true">api.caliwo.app</domain>
    </domain-config>
</network-security-config>`;
      fs.writeFileSync(path.join(xmlDir, "network_security_config.xml"), networkSecurityConfig, "utf8");

      return config;
    },
  ]);

  // 3. Add Android Manifest Widget Receivers + Network Security
  config = withAndroidManifest(config, (config) => {
    const mainApplication = config.modResults.manifest.application?.[0];
    if (mainApplication) {
      // Enable cleartext traffic + network security config
      mainApplication.$["android:usesCleartextTraffic"] = "true";
      mainApplication.$["android:networkSecurityConfig"] = "@xml/network_security_config";

      if (!mainApplication.receiver) {
        mainApplication.receiver = [];
      }

      const receivers = mainApplication.receiver;

      const intakeReceiverExists = receivers.some(
        (r) => r.$ && r.$["android:name"] === ".widget.TodayIntakeWidgetProvider"
      );
      if (!intakeReceiverExists) {
        receivers.push({
          $: {
            "android:name": ".widget.TodayIntakeWidgetProvider",
            "android:exported": "true",
            "android:label": "Today's Intake Widget",
          },
          "intent-filter": [
            {
              action: [{ $: { "android:name": "android.appwidget.action.APPWIDGET_UPDATE" } }],
            },
          ],
          "meta-data": [
            {
              $: {
                "android:name": "android.appwidget.provider",
                "android:resource": "@xml/today_intake_widget_info",
              },
            },
          ],
        });
      }

      const waterReceiverExists = receivers.some(
        (r) => r.$ && r.$["android:name"] === ".widget.LogWaterWidgetProvider"
      );
      if (!waterReceiverExists) {
        receivers.push({
          $: {
            "android:name": ".widget.LogWaterWidgetProvider",
            "android:exported": "true",
            "android:label": "Log Water Widget",
          },
          "intent-filter": [
            {
              action: [{ $: { "android:name": "android.appwidget.action.APPWIDGET_UPDATE" } }],
            },
          ],
          "meta-data": [
            {
              $: {
                "android:name": "android.appwidget.provider",
                "android:resource": "@xml/log_water_widget_info",
              },
            },
          ],
        });
      }
    }
    return config;
  });

  return config;
}

module.exports = createRunOncePlugin(withWidgetsPlugin, "withWidgetsPlugin", "1.0.0");
