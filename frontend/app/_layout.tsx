import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Linking from "expo-linking";
import { useEffect } from "react";
import { StatusBar, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { LinearGradient } from "expo-linear-gradient";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AuthProvider } from "@/src/context/AuthContext";
import { OnboardingProvider } from "@/src/context/OnboardingContext";
import { SubscriptionProvider } from "@/src/modules/subscription/providers/SubscriptionProvider";
import { ActivityProvider } from "@/src/modules/activity/providers/ActivityProvider";
import { colors, bgGradient } from "@/src/theme";
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient, asyncStoragePersister } from '@/src/lib/queryClient';
import { WidgetService } from "@/src/widgets/widgetService";

import { AppSplashScreen } from "@/src/components/AppSplashScreen";
import { QlooGate } from "@/src/components/QlooGate";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  // Deep Link listener for Widget quick actions (e.g. caliwo://water/log?ml=250)
  useEffect(() => {
    const handleUrl = async (event: { url: string }) => {
      const url = event.url;
      if (!url) return;

      if (url.includes("water/log")) {
        const parsed = Linking.parse(url);
        const mlParam = parsed.queryParams?.ml;
        const ml = mlParam ? parseInt(String(mlParam), 10) : 250;
        await WidgetService.logWater(ml);
        queryClient.invalidateQueries({ queryKey: ["nutrition_today"] });
      } else if (url.includes("water/reset")) {
        await WidgetService.resetWater();
        queryClient.invalidateQueries({ queryKey: ["nutrition_today"] });
      }
    };

    const sub = Linking.addEventListener("url", handleUrl);
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl({ url });
    });

    return () => {
      sub.remove();
    };
  }, []);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bgSolid }}>
      <LinearGradient
        colors={bgGradient.colors as unknown as [string, string, string]}
        start={bgGradient.start}
        end={bgGradient.end}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{ persister: asyncStoragePersister }}
        >
          <AuthProvider>
            <QlooGate>
              <SubscriptionProvider>
                <ActivityProvider>
                  <OnboardingProvider>
                    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "transparent" } }} />
                  </OnboardingProvider>
                </ActivityProvider>
              </SubscriptionProvider>
            </QlooGate>
          </AuthProvider>
        </PersistQueryClientProvider>

        {/* 2-Second Animated Splash Screen */}
        <AppSplashScreen />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
