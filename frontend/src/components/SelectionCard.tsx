import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, spacing } from "@/src/theme";

type Props = {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  customIcon?: React.ReactNode;
  iconColor?: string;
  iconBg?: string;
  badge?: string;
  active?: boolean;
  onPress: () => void;
  testID?: string;
};

export function SelectionCard({
  title,
  subtitle,
  icon,
  customIcon,
  iconColor,
  iconBg,
  badge,
  active,
  onPress,
  testID,
}: Props) {
  const handlePress = () => {
    Haptics.selectionAsync().catch(() => {});
    onPress();
  };

  return (
    <TouchableOpacity
      style={[styles.card, active && styles.cardActive]}
      onPress={handlePress}
      activeOpacity={0.82}
      testID={testID}
    >
      {badge ? (
        <View style={[styles.badgePill, active && styles.badgePillActive]}>
          <Text style={[styles.badgeText, active && styles.badgeTextActive]}>
            {badge}
          </Text>
        </View>
      ) : null}

      {customIcon ? (
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor:
                iconBg || (active ? "rgba(255, 94, 0, 0.12)" : "#F8FAFC"),
            },
          ]}
        >
          {customIcon}
        </View>
      ) : icon ? (
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor:
                iconBg || (active ? "rgba(255, 94, 0, 0.12)" : "#F8FAFC"),
            },
          ]}
        >
          <Ionicons
            name={icon}
            size={22}
            color={
              iconColor || (active ? colors.accent || "#FF5E00" : "#64748B")
            }
          />
        </View>
      ) : null}

      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text style={[styles.title, active && styles.titleActive]}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>

      <View style={[styles.radio, active && styles.radioActive]}>
        {active ? (
          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export function ChipToggle({
  label,
  icon,
  active,
  onPress,
  testID,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  active?: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const handlePress = () => {
    Haptics.selectionAsync().catch(() => {});
    onPress();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.85}
      style={[chipStyles.chip, active && chipStyles.chipActive]}
      testID={testID}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={16}
          color={active ? "#FFFFFF" : "#64748B"}
          style={{ marginRight: 6 }}
        />
      ) : null}
      <Text style={[chipStyles.label, active && chipStyles.labelActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    marginRight: 8,
    marginBottom: 10,
    ...Platform.select({
      ios: {
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  chipActive: {
    backgroundColor: "#0F172A",
    borderColor: "#0F172A",
    ...Platform.select({
      ios: {
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  label: {
    color: "#0F172A",
    fontWeight: "700",
    fontSize: 14,
    letterSpacing: -0.2,
  },
  labelActive: { color: "#FFFFFF" },
});

const styles = StyleSheet.create({
  card: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardActive: {
    borderColor: colors.accent || "#FF5E00",
    backgroundColor: "#FFF8F3",
    ...Platform.select({
      ios: {
        shadowColor: colors.accent || "#FF5E00",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.16,
        shadowRadius: 14,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  badgePill: {
    position: "absolute",
    top: -9,
    right: 18,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    zIndex: 2,
  },
  badgePillActive: {
    backgroundColor: colors.accent || "#FF5E00",
    borderColor: colors.accent || "#FF5E00",
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.8,
  },
  badgeTextActive: {
    color: "#FFFFFF",
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  titleActive: {
    color: "#0F172A",
  },
  subtitle: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 3,
    lineHeight: 18,
    fontWeight: "500",
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  radioActive: {
    borderColor: colors.accent || "#FF5E00",
    backgroundColor: colors.accent || "#FF5E00",
  },
});
