package expo.modules;

import expo.modules.core.interfaces.Package;
import expo.modules.kotlin.modules.Module;
import expo.modules.kotlin.ModulesProvider;

class ExpoModulesPackageList : ModulesProvider {
  companion object {
    val packagesList: List<Package> = listOf(
          expo.modules.logbox.ExpoLogBoxPackage(),
      expo.modules.devlauncher.DevLauncherPackage(),
      expo.modules.devmenu.DevMenuPackage(),
      expo.modules.linking.ExpoLinkingPackage(),
      expo.modules.adapters.react.ReactAdapterPackage(),
      expo.modules.core.BasePackage(),
      expo.modules.kotlin.edgeToEdge.EdgeToEdgePackage(),
      expo.modules.notifications.NotificationsPackage(),
      expo.modules.statusbar.StatusBarPackage(),
      expo.modules.systemui.SystemUIPackage()
    )

    val modulesMap: Map<Class<out Module>, String?> = mapOf(
          expo.modules.webview.DomWebViewModule::class.java to null,
      expo.modules.fetch.ExpoFetchModule::class.java to null,
      expo.modules.asset.AssetModule::class.java to null,
      expo.modules.audio.AudioModule::class.java to null,
      expo.modules.camera.CameraViewModule::class.java to null,
      expo.modules.clipboard.ClipboardModule::class.java to null,
      expo.modules.constants.ConstantsModule::class.java to null,
      expo.modules.devlauncher.modules.ExpoDevLauncherModule::class.java to null,
      expo.modules.devmenu.modules.DevMenuModule::class.java to null,
      expo.modules.filesystem.FileSystemModule::class.java to null,
      expo.modules.filesystem.legacy.FileSystemLegacyModule::class.java to null,
      expo.modules.font.FontLoaderModule::class.java to null,
      expo.modules.font.FontUtilsModule::class.java to null,
      expo.modules.imagepicker.ImagePickerModule::class.java to null,
      expo.modules.keepawake.KeepAwakeModule::class.java to null,
      expo.modules.lineargradient.LinearGradientModule::class.java to null,
      expo.modules.linking.ExpoLinkingModule::class.java to null,
      expo.modules.location.LocationModule::class.java to null,
      expo.modules.location.next.LocationModuleNext::class.java to null,
      expo.modules.notifications.badge.BadgeModule::class.java to null,
      expo.modules.notifications.notifications.background.ExpoBackgroundNotificationTasksModule::class.java to null,
      expo.modules.notifications.notifications.categories.ExpoNotificationCategoriesModule::class.java to null,
      expo.modules.notifications.notifications.channels.NotificationChannelGroupManagerModule::class.java to null,
      expo.modules.notifications.notifications.channels.NotificationChannelManagerModule::class.java to null,
      expo.modules.notifications.notifications.emitting.NotificationsEmitter::class.java to null,
      expo.modules.notifications.notifications.handling.NotificationsHandler::class.java to null,
      expo.modules.notifications.permissions.NotificationPermissionsModule::class.java to null,
      expo.modules.notifications.notifications.presentation.ExpoNotificationPresentationModule::class.java to null,
      expo.modules.notifications.notifications.scheduling.NotificationScheduler::class.java to null,
      expo.modules.notifications.serverregistration.ServerRegistrationModule::class.java to null,
      expo.modules.notifications.tokens.PushTokenModule::class.java to null,
      expo.modules.notifications.topics.TopicSubscriptionModule::class.java to null,
      expo.modules.notifications.notifications.channels.AndroidXNotificationsChannelsProvider::class.java to null,
      expo.modules.router.ExpoRouterModule::class.java to null,
      expo.modules.securestore.SecureStoreModule::class.java to null,
      expo.modules.sensors.modules.AccelerometerModule::class.java to null,
      expo.modules.sensors.modules.BarometerModule::class.java to null,
      expo.modules.sensors.modules.GyroscopeModule::class.java to null,
      expo.modules.sensors.modules.LightSensorModule::class.java to null,
      expo.modules.sensors.modules.DeviceMotionModule::class.java to null,
      expo.modules.sensors.modules.MagnetometerModule::class.java to null,
      expo.modules.sensors.modules.MagnetometerUncalibratedModule::class.java to null,
      expo.modules.sensors.modules.PedometerModule::class.java to null,
      expo.modules.splashscreen.SplashScreenModule::class.java to null,
      expo.modules.systemui.SystemUIModule::class.java to null 
    )

    @JvmStatic
    fun getPackageList(): List<Package> {
      return packagesList
    }
  }

  override fun getModulesMap(): Map<Class<out Module>, String?> {
    return modulesMap
  }
  
  override fun getServices(): List<Class<out expo.modules.kotlin.services.Service>> {
    return listOf<Class<out expo.modules.kotlin.services.Service>>(
          expo.modules.constants.ConstantsService::class.java,
      expo.modules.imageloader.ImageLoaderService::class.java
    )
  }
}
