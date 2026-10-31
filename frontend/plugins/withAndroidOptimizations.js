// plugins/withAndroidOptimizations.js
// Custom Expo Config Plugin that enables Proguard/R8 code shrinking,
// resource shrinking, and ABI filtering for release builds.
// This dramatically reduces APK size by removing dead code and
// shipping only arm64-v8a native libraries (~95%+ of modern devices).
//
// All Gradle property changes are applied via withGradleProperties so they
// survive `expo prebuild --clean`.

const { withAppBuildGradle, withGradleProperties } = require("expo/config-plugins");

/**
 * Injects Proguard + shrinkResources + ABI filter into android/app/build.gradle
 */
function withProguardAndAbiFilter(config) {
  return withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;

    // ── 1. Enable Proguard (R8) for release builds ──
    // Replace the existing `enableProguardInReleaseBuilds = false` line,
    // or inject it if missing.
    if (contents.includes("enableProguardInReleaseBuilds")) {
      contents = contents.replace(
        /def enableProguardInReleaseBuilds\s*=\s*false/,
        "def enableProguardInReleaseBuilds = true"
      );
    } else {
      // Inject just before `android {`
      contents = contents.replace(
        /android\s*\{/,
        'def enableProguardInReleaseBuilds = true\n\nandroid {'
      );
    }

    // ── 2. Enable shrinkResources in release buildType ──
    if (!contents.includes("shrinkResources")) {
      contents = contents.replace(
        /(buildTypes\s*\{[\s\S]*?release\s*\{)/,
        "$1\n            shrinkResources enableProguardInReleaseBuilds"
      );
    }

    // ── 3. ABI filter — ship arm64-v8a + armeabi-v7a + x86_64 ──
    // Supports physical ARM devices (32-bit & 64-bit) as well as x86_64 emulators/devices
    if (!contents.includes("abiFilters")) {
      contents = contents.replace(
        /(defaultConfig\s*\{)/,
        '$1\n        ndk {\n            abiFilters "armeabi-v7a", "arm64-v8a", "x86_64"\n        }'
      );
    }

    cfg.modResults.contents = contents;
    return cfg;
  });
}

/**
 * Helper: upsert a Gradle property in the modResults array
 */
function setGradleProp(props, key, value) {
  const idx = props.findIndex((p) => p.key === key);
  if (idx >= 0) {
    props[idx].value = value;
  } else {
    props.push({ type: "property", key, value });
  }
}

/**
 * Sets Gradle properties for additional size optimization.
 * These survive `expo prebuild --clean` because they're applied
 * via the config plugin system.
 */
function withOptimizedGradleProps(config) {
  return withGradleProperties(config, (cfg) => {
    const props = cfg.modResults;

    // Ensure Hermes is enabled (should already be default in Expo 54)
    setGradleProp(props, "hermesEnabled", "true");

    // Ensure minSdk is set to 26 for Health Connect compatibility.
    // The Expo version catalog maps android.minSdkVersion → rootProject.ext.minSdkVersion.
    setGradleProp(props, "android.minSdkVersion", "26");

    // ── Size optimizations ──────────────────────────────────────────────

    // Ship arm64-v8a + armeabi-v7a + x86_64 native libraries for APK builds.
    // arm64-v8a covers modern phones; armeabi-v7a covers 32-bit devices; x86_64 covers emulators.
    setGradleProp(props, "reactNativeArchitectures", "armeabi-v7a,arm64-v8a,x86_64");

    // Enable legacy packaging (extract native libraries to disk upon install)
    // This prevents dlopen / SoLoader crashes on Android 14/15 and side-loaded APKs
    setGradleProp(props, "expo.useLegacyPackaging", "true");

    // Enable R8 code shrinking / minification for release builds.
    // This dramatically reduces DEX size by removing dead Java/Kotlin code.
    setGradleProp(props, "android.enableMinifyInReleaseBuilds", "true");

    // Enable Android resource shrinking (removes unused drawables, layouts, etc.)
    setGradleProp(props, "android.enableShrinkResourcesInReleaseBuilds", "true");

    // Disable GIF support — app does not use GIF images
    setGradleProp(props, "expo.gif.enabled", "false");

    // Disable dev-only network inspector for smaller release builds
    setGradleProp(props, "EX_DEV_CLIENT_NETWORK_INSPECTOR", "false");

    return cfg;
  });
}

module.exports = function withAndroidOptimizations(config) {
  config = withProguardAndAbiFilter(config);
  config = withOptimizedGradleProps(config);
  return config;
};
