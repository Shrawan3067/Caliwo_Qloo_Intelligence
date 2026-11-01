# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# ── React Native Core ──────────────────────────────────────────────────
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }
-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.react.uimanager.** { *; }

# Keep all native module & TurboModule registrations
-keep,allowobfuscation @com.facebook.react.module.annotations.ReactModule class * { *; }
-keep,allowobfuscation @com.facebook.react.turbomodule.core.interfaces.TurboModule class * { *; }
-keepclassmembers class * extends com.facebook.react.bridge.ReactContextBaseJavaModule {
  @com.facebook.react.bridge.ReactMethod *;
}

# ── Hermes ─────────────────────────────────────────────────────────────
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }

# ── react-native-reanimated ───────────────────────────────────────────
-keep class com.swmansion.reanimated.** { *; }

# ── react-native-gesture-handler ──────────────────────────────────────
-keep class com.swmansion.gesturehandler.** { *; }

# ── react-native-screens ─────────────────────────────────────────────
-keep class com.swmansion.rnscreens.** { *; }

# ── react-native-svg ─────────────────────────────────────────────────
-keep class com.horcrux.svg.** { *; }

# ── react-native-safe-area-context ───────────────────────────────────
-keep class com.th3rdwave.safeareacontext.** { *; }

# ── Health Connect ────────────────────────────────────────────────────
-keep class dev.matinzd.healthconnect.** { *; }
-keep class androidx.health.connect.** { *; }

# ── Expo Modules ──────────────────────────────────────────────────────
-keep class expo.modules.** { *; }
-keep class expo.modules.ExpoModulesPackageList { *; }
-keep interface expo.modules.kotlin.ModulesProvider { *; }
-keepclassmembers class * {
  @expo.modules.core.interfaces.ExpoProp *;
}
-keepclassmembers class * extends expo.modules.core.ExportedModule {
  public *;
}

# ── AsyncStorage ──────────────────────────────────────────────────────
-keep class com.reactnativecommunity.asyncstorage.** { *; }

# ── react-native-worklets (JSI C++ module) ────────────────────────────
-keep class com.worklets.** { *; }
-keep class com.swmansion.worklets.** { *; }

# ── OkHttp (used by axios/fetch polyfill) ─────────────────────────────
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }

# ── Prevent stripping of JS interface classes ─────────────────────────
-keepattributes *Annotation*
-keepattributes JavascriptInterface

# Add any project specific keep options here:
