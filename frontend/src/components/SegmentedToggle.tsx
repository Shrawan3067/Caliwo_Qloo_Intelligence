import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
import * as Haptics from "expo-haptics";

type SegmentedToggleProps<T extends string> = {
  options: { label: string; value: T; testID?: string }[];
  value: T;
  onChange: (value: T) => void;
  style?: any;
};

export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  style,
}: SegmentedToggleProps<T>) {
  const handleSelect = (val: T) => {
    if (val !== value) {
      Haptics.selectionAsync().catch(() => {});
      onChange(val);
    }
  };

  return (
    <View style={[styles.container, style]}>
      {options.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => handleSelect(opt.value)}
            style={[styles.segment, isSelected && styles.segmentActive]}
            activeOpacity={0.8}
            testID={opt.testID}
          >
            <Text style={[styles.label, isSelected && styles.labelActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 999,
    padding: 4,
    alignSelf: "center",
    marginBottom: 24,
    width: 180,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
  segmentActive: {
    backgroundColor: "#FFFFFF",
    ...Platform.select({
      ios: {
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748B",
  },
  labelActive: {
    color: "#0F172A",
    fontWeight: "800",
  },
});
