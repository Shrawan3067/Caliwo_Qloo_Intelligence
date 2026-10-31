/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unused-vars */
import React, { useEffect } from "react";
import { Tabs, useRouter } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import * as Haptics from "expo-haptics";

import { colors } from "@/src/theme";
import api from "@/src/lib/api";
import { useAuth } from "@/src/context/AuthContext";

function CustomTabBar({ state, descriptors, navigation }: any) {
  const router = useRouter();
  if (!state?.routes || !descriptors) {
    return null;
  }

  const currentRoute = state.routes[state.index];
  const { options } = descriptors[currentRoute?.key] || {};

  if (currentRoute?.name === "coach" || options?.tabBarStyle?.display === "none") {
    return null;
  }

  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const barHeight = 66;
  const bottomPadding = Math.max(insets.bottom, 10);
  const totalHeight = barHeight + bottomPadding;
  const cornerRadius = 24;
  const center = width / 2;

  // Exact smooth semi-circular U-notch SVG path
  const fabRadius = 37;
  const gap = 6;
  const notchRadius = fabRadius + gap;
  const shoulder = 18;

  const d = `
M 0 ${cornerRadius}
A ${cornerRadius} ${cornerRadius} 0 0 1 ${cornerRadius} 0

L ${center - notchRadius - shoulder} 0

Q ${center - notchRadius} 0 ${center - notchRadius} ${shoulder}

A ${notchRadius} ${notchRadius} 0 0 0 ${center + notchRadius} ${shoulder}

Q ${center + notchRadius} 0 ${center + notchRadius + shoulder} 0

L ${width - cornerRadius} 0

A ${cornerRadius} ${cornerRadius} 0 0 1 ${width} ${cornerRadius}

L ${width} ${totalHeight}
L 0 ${totalHeight}
Z
`;

  const leftRoutes = state.routes.slice(0, 2);
  const scanRoute =
    state.routes.find((r: any) => r.name === "scan") || state.routes[2];
  const rightRoutes = state.routes.slice(3, 5);

  const activeColor = colors.accent;
  const inactiveColor = "#64748B";

  const renderTabItem = (route: any) => {
    const isFocused = state.routes[state.index].key === route.key;
    const { options } = descriptors[route.key];
    const label = options.title || route.name;

    let iconName: keyof typeof Ionicons.glyphMap = "ellipse-outline";
    if (route.name === "home") iconName = isFocused ? "home" : "home-outline";
    else if (route.name === "diary")
      iconName = isFocused ? "book" : "book-outline";
    else if (route.name === "coach")
      iconName = isFocused
        ? "chatbubble-ellipses"
        : "chatbubble-ellipses-outline";
    else if (route.name === "profile")
      iconName = isFocused ? "person" : "person-outline";

    const onPress = () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const event = navigation?.emit
        ? navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          })
        : { defaultPrevented: false };

      if (!isFocused && !event?.defaultPrevented) {
        if (navigation?.navigate) {
          navigation.navigate(route.name);
        } else {
          router.push(`/(tabs)/${route.name}` as any);
        }
      }
    };

    return (
      <TouchableOpacity
        key={route.key}
        onPress={onPress}
        activeOpacity={0.7}
        style={styles.tabItem}
      >
        <Ionicons
          name={iconName}
          size={23}
          color={isFocused ? activeColor : inactiveColor}
        />
        <Text
          style={[
            styles.tabLabel,
            {
              color: isFocused ? activeColor : inactiveColor,
              fontWeight: isFocused ? "800" : "600",
            },
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const isScanFocused = state.routes[state.index].name === "scan";

  const onScanPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (scanRoute) {
      const event = navigation?.emit
        ? navigation.emit({
            type: "tabPress",
            target: scanRoute.key,
            canPreventDefault: true,
          })
        : { defaultPrevented: false };

      if (!isScanFocused && !event?.defaultPrevented) {
        if (navigation?.navigate) {
          navigation.navigate(scanRoute.name);
        } else {
          router.push(`/(tabs)/${scanRoute.name}` as any);
        }
      }
    }
  };

  return (
    <View style={[styles.tabBarContainer, { height: totalHeight }]}>
      {/* Background SVG notched surface */}
      <View style={StyleSheet.absoluteFill}>
        <Svg width={width} height={totalHeight}>
          <Path d={d} fill="#FFFFFF" stroke="#E2E8F0" strokeWidth={1.5} />
        </Svg>
      </View>

      {/* Foreground Tab Content */}
      <View style={[styles.tabBarContent, { height: barHeight }]}>
        {/* Left Side Tabs */}
        <View style={styles.tabGroup}>{leftRoutes.map(renderTabItem)}</View>

        {/* Center Floating Action Button resting in notch */}
        <View style={styles.centerFabWrapper}>
          <TouchableOpacity
            onPress={onScanPress}
            activeOpacity={0.88}
            style={[
              styles.fabButton,
              {
                backgroundColor: isScanFocused ? colors.accent : "#000000",
              },
            ]}
          >
            <Ionicons name="qr-code-outline" size={26} color={colors.white} />
            <Text style={styles.fabButtonText}>Scan</Text>
          </TouchableOpacity>
        </View>

        {/* Right Side Tabs */}
        <View style={styles.tabGroup}>{rightRoutes.map(renderTabItem)}</View>
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/");
    } else {
      (async () => {
        try {
          const Constants = require("expo-constants").default;
          if (Constants.appOwnership === "expo") return;

          const Notifications = require("expo-notifications");
          const { status: existingStatus } =
            await Notifications.getPermissionsAsync();
          let finalStatus = existingStatus;
          if (existingStatus !== "granted") {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
          }
          if (finalStatus !== "granted") return;

          const tokenData = await Notifications.getExpoPushTokenAsync({
            projectId: "caliwo", // TODO: Replace with real Expo project ID from expo.dev
          });

          if (tokenData && tokenData.data) {
            await api.post("/push/register", { token: tokenData.data });
          }
        } catch (e) {
          // silently ignore in dev/simulator
        }
      })();
    }
  }, [user, loading, router]);

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: "transparent" },
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Home" }} />
      <Tabs.Screen name="diary" options={{ title: "Diary" }} />
      <Tabs.Screen name="scan" options={{ title: "Scan" }} />
      <Tabs.Screen
        name="coach"
        options={{
          title: "Coach",
          tabBarStyle: { display: "none" },
        }}
      />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "transparent",
    ...Platform.select({
      ios: {
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  tabBarContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  tabGroup: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  centerFabWrapper: {
    width: 98,
    height: 98,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    top: -16,
  },
  fabButton: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 2,
    borderWidth: 3,
    borderColor: colors.white,
    ...Platform.select({
      ios: {
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
      },
      android: { elevation: 6 },
    }),
  },
  fabButtonText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: "900",
    marginTop: 1,
    letterSpacing: 0.2,
  },
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    flex: 1,
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 3,
    letterSpacing: -0.1,
  },
});
