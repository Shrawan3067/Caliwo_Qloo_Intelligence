import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { colors } from "@/src/theme";

type RingProps = {
  size: number;
  stroke: number;
  progress: number; // 0 - 1
  color?: string;
  trackColor?: string;
  children?: React.ReactNode;
  testID?: string;
};

export function Ring({
  size,
  stroke,
  progress,
  color = colors.accent,
  trackColor = "#F0F0F0",
  children,
  testID,
}: RingProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));
  const dash = c * p;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }} testID={testID}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={trackColor}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${dash} ${c - dash}`}
          strokeDashoffset={c * 0.25}
          strokeLinecap="round"
        />
      </Svg>
      <View style={{ alignItems: "center", justifyContent: "center" }}>{children}</View>
    </View>
  );
}

import { MacroIcon, MacroType, MACRO_CONFIGS } from "./MacroIcon";

type MacroRingProps = {
  label: string;
  value: number;
  goal: number;
  color?: string;
  unit?: string;
  macroType?: MacroType;
};

export function MacroRing({ label, value, goal, color, unit, macroType }: MacroRingProps) {
  const normKey = (macroType || label.toLowerCase()) as string;
  const config = MACRO_CONFIGS[normKey] || MACRO_CONFIGS.protein;

  const ringColor = color || config.color;
  const effectiveUnit = unit || config.unit;
  const progress = goal > 0 ? value / goal : 0;
  const left = Math.max(0, goal - value);

  return (
    <View style={macroStyles.card}>
      <Ring size={68} stroke={6.5} progress={progress} color={ringColor}>
        <MacroIcon type={(macroType || normKey) as MacroType} size={28} showBadge={false} />
      </Ring>

      <Text style={macroStyles.label}>{config.label}</Text>
      <Text style={macroStyles.value}>
        {Math.round(value)}{effectiveUnit} / {Math.round(goal)}{effectiveUnit}
      </Text>
      <Text style={macroStyles.subLeft}>{Math.round(left)} {effectiveUnit} left</Text>
    </View>
  );
}

const shadowSm = Platform.select({
  ios: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  android: { elevation: 2 },
  default: {},
});

const macroStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...shadowSm,
  },
  label: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.textPrimary,
    marginTop: 8,
  },
  value: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.textPrimary,
    marginTop: 2,
  },
  subLeft: {
    fontSize: 9,
    fontWeight: "600",
    color: colors.textSecondary,
    marginTop: 1,
  },
});
