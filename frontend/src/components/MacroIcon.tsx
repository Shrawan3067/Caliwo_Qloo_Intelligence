import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export type MacroType = "protein" | "carbs" | "fats" | "fat" | "fiber" | "sugar" | "sodium" | "magnesium";

export type MacroConfig = {
  key: MacroType;
  label: string;
  unit: string;
  color: string;
  bgColor: string;
  iconName: keyof typeof Ionicons.glyphMap;
  badgeSymbol: string;
};

export const MACRO_CONFIGS: Record<string, MacroConfig> = {
  protein: {
    key: "protein",
    label: "Protein",
    unit: "g",
    color: "#FF5E00",
    bgColor: "#FFF0E5",
    iconName: "fitness",
    badgeSymbol: "🥩",
  },
  carbs: {
    key: "carbs",
    label: "Carbs",
    unit: "g",
    color: "#F59E0B",
    bgColor: "#FEF3C7",
    iconName: "leaf",
    badgeSymbol: "🌾",
  },
  fats: {
    key: "fats",
    label: "Fats",
    unit: "g",
    color: "#0284C7",
    bgColor: "#E0F2FE",
    iconName: "water",
    badgeSymbol: "🥑",
  },
  fat: {
    key: "fat",
    label: "Fats",
    unit: "g",
    color: "#0284C7",
    bgColor: "#E0F2FE",
    iconName: "water",
    badgeSymbol: "🥑",
  },
  fiber: {
    key: "fiber",
    label: "Fiber",
    unit: "g",
    color: "#10B981",
    bgColor: "#ECFDF5",
    iconName: "nutrition",
    badgeSymbol: "🥦",
  },
  sugar: {
    key: "sugar",
    label: "Sugar",
    unit: "g",
    color: "#EC4899",
    bgColor: "#FCE7F3",
    iconName: "cube",
    badgeSymbol: "🍬",
  },
  sodium: {
    key: "sodium",
    label: "Sodium",
    unit: "mg",
    color: "#8B5CF6",
    bgColor: "#F3E8FF",
    iconName: "color-fill",
    badgeSymbol: "🧂",
  },
  magnesium: {
    key: "magnesium",
    label: "Magnesium",
    unit: "mg",
    color: "#A78BFA",
    bgColor: "#EDE9FE",
    iconName: "sparkles",
    badgeSymbol: "✨",
  },
};

type MacroIconProps = {
  type: MacroType;
  size?: number;
  showBadge?: boolean;
};

export function MacroIcon({ type, size = 32, showBadge = true }: MacroIconProps) {
  const config = MACRO_CONFIGS[type] || MACRO_CONFIGS.protein;
  const iconSize = Math.round(size * 0.52);

  return (
    <View
      style={[
        styles.iconWrap,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.35),
          backgroundColor: config.bgColor,
        },
      ]}
    >
      <Ionicons name={config.iconName} size={iconSize} color={config.color} />
      {showBadge && (
        <View style={[styles.miniBadge, { backgroundColor: config.color }]}>
          <Text style={styles.badgeText}>{config.badgeSymbol}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  miniBadge: {
    position: "absolute",
    bottom: -3,
    right: -3,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 8,
    lineHeight: 10,
  },
});
