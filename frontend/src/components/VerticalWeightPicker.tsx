import React, { useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Platform,
  TouchableOpacity,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { colors } from "@/src/theme";

const ITEM_HEIGHT = 50;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const PADDING_VERT = (PICKER_HEIGHT - ITEM_HEIGHT) / 2;

type Props = {
  unit: "kg" | "lb";
  weightKg: number;
  onChangeKg: (kg: number) => void;
  testID?: string;
};

// KG Range: 30kg to 250kg
const MIN_KG = 30;
const MAX_KG = 250;
const KG_DATA: number[] = [];
for (let k = MIN_KG; k <= MAX_KG; k++) {
  KG_DATA.push(k);
}

// LB Range: 66lb to 550lb
const MIN_LB = 66;
const MAX_LB = 550;
const LB_DATA: number[] = [];
for (let l = MIN_LB; l <= MAX_LB; l++) {
  LB_DATA.push(l);
}

export function VerticalWeightPicker({
  unit,
  weightKg,
  onChangeKg,
  testID,
}: Props) {
  const currentKg = Math.max(MIN_KG, Math.min(MAX_KG, Math.round(weightKg || 70)));
  const currentLb = Math.max(
    MIN_LB,
    Math.min(MAX_LB, Math.round(currentKg * 2.20462))
  );

  const kgListRef = useRef<FlatList>(null);
  const lbListRef = useRef<FlatList>(null);

  // Scroll to index on mount or unit switch
  useEffect(() => {
    if (unit === "kg") {
      const idx = KG_DATA.indexOf(currentKg);
      if (idx !== -1) {
        setTimeout(() => {
          kgListRef.current?.scrollToOffset({
            offset: idx * ITEM_HEIGHT,
            animated: false,
          });
        }, 60);
      }
    } else {
      const idx = LB_DATA.indexOf(currentLb);
      if (idx !== -1) {
        setTimeout(() => {
          lbListRef.current?.scrollToOffset({
            offset: idx * ITEM_HEIGHT,
            animated: false,
          });
        }, 60);
      }
    }
  }, [unit]);

  const handleKgScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = e.nativeEvent.contentOffset.y;
      const idx = Math.round(offset / ITEM_HEIGHT);
      const clampedIdx = Math.max(0, Math.min(KG_DATA.length - 1, idx));
      const newKg = KG_DATA[clampedIdx];
      if (newKg !== currentKg) {
        Haptics.selectionAsync().catch(() => {});
        onChangeKg(newKg);
      }
    },
    [currentKg, onChangeKg]
  );

  const handleLbScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = e.nativeEvent.contentOffset.y;
      const idx = Math.round(offset / ITEM_HEIGHT);
      const clampedIdx = Math.max(0, Math.min(LB_DATA.length - 1, idx));
      const newLb = LB_DATA[clampedIdx];
      const newKg = Math.round(newLb / 2.20462);
      if (newKg !== currentKg) {
        Haptics.selectionAsync().catch(() => {});
        onChangeKg(newKg);
      }
    },
    [currentKg, onChangeKg]
  );

  return (
    <View style={styles.container} testID={testID}>
      {/* Prominent Header Display */}
      <View style={styles.displayCard}>
        {unit === "kg" ? (
          <View style={styles.valueRow}>
            <Text style={styles.mainValue}>{currentKg}</Text>
            <Text style={styles.unitText}>kg</Text>
            <Text style={styles.secondaryValue}>({currentLb} lbs)</Text>
          </View>
        ) : (
          <View style={styles.valueRow}>
            <Text style={styles.mainValue}>{currentLb}</Text>
            <Text style={styles.unitText}>lb</Text>
            <Text style={styles.secondaryValue}>({currentKg} kg)</Text>
          </View>
        )}
      </View>

      {/* Wheel Selector Frame */}
      <View style={styles.pickerWrapper}>
        {/* Selection Center Highlight Bar */}
        <View style={styles.selectionHighlight} pointerEvents="none" />

        {unit === "kg" ? (
          /* KG Wheel */
          <FlatList
            ref={kgListRef}
            data={KG_DATA}
            keyExtractor={(item) => `kg-${item}`}
            showsVerticalScrollIndicator={false}
            snapToInterval={ITEM_HEIGHT}
            decelerationRate="fast"
            initialScrollIndex={Math.max(0, KG_DATA.indexOf(currentKg))}
            getItemLayout={(_, index) => ({
              length: ITEM_HEIGHT,
              offset: ITEM_HEIGHT * index,
              index,
            })}
            contentContainerStyle={{ paddingVertical: PADDING_VERT }}
            onMomentumScrollEnd={handleKgScrollEnd}
            renderItem={({ item }) => {
              const isSelected = item === currentKg;
              const dist = Math.abs(item - currentKg);
              return (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    const idx = KG_DATA.indexOf(item);
                    kgListRef.current?.scrollToOffset({
                      offset: idx * ITEM_HEIGHT,
                      animated: true,
                    });
                    Haptics.selectionAsync().catch(() => {});
                    onChangeKg(item);
                  }}
                  style={styles.wheelItem}
                >
                  <View style={styles.itemRow}>
                    <Text
                      style={[
                        styles.numberText,
                        isSelected && styles.selectedText,
                        dist === 1 && styles.nearText,
                        dist >= 2 && styles.farText,
                      ]}
                    >
                      {item}
                    </Text>
                    <Text
                      style={[
                        styles.unitSuffix,
                        isSelected && styles.selectedUnit,
                        dist >= 1 && styles.farUnit,
                      ]}
                    >
                      kg
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        ) : (
          /* LB Wheel */
          <FlatList
            ref={lbListRef}
            data={LB_DATA}
            keyExtractor={(item) => `lb-${item}`}
            showsVerticalScrollIndicator={false}
            snapToInterval={ITEM_HEIGHT}
            decelerationRate="fast"
            initialScrollIndex={Math.max(0, LB_DATA.indexOf(currentLb))}
            getItemLayout={(_, index) => ({
              length: ITEM_HEIGHT,
              offset: ITEM_HEIGHT * index,
              index,
            })}
            contentContainerStyle={{ paddingVertical: PADDING_VERT }}
            onMomentumScrollEnd={handleLbScrollEnd}
            renderItem={({ item }) => {
              const isSelected = item === currentLb;
              const dist = Math.abs(item - currentLb);
              return (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    const idx = LB_DATA.indexOf(item);
                    lbListRef.current?.scrollToOffset({
                      offset: idx * ITEM_HEIGHT,
                      animated: true,
                    });
                    Haptics.selectionAsync().catch(() => {});
                    const newKg = Math.round(item / 2.20462);
                    onChangeKg(newKg);
                  }}
                  style={styles.wheelItem}
                >
                  <View style={styles.itemRow}>
                    <Text
                      style={[
                        styles.numberText,
                        isSelected && styles.selectedText,
                        dist === 1 && styles.nearText,
                        dist >= 2 && styles.farText,
                      ]}
                    >
                      {item}
                    </Text>
                    <Text
                      style={[
                        styles.unitSuffix,
                        isSelected && styles.selectedUnit,
                        dist >= 1 && styles.farUnit,
                      ]}
                    >
                      lb
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}

        {/* Top Gradient Fade */}
        <LinearGradient
          colors={["#FFFFFF", "rgba(255, 255, 255, 0.8)", "rgba(255, 255, 255, 0)"]}
          style={styles.topGradient}
          pointerEvents="none"
        />

        {/* Bottom Gradient Fade */}
        <LinearGradient
          colors={["rgba(255, 255, 255, 0)", "rgba(255, 255, 255, 0.8)", "#FFFFFF"]}
          style={styles.bottomGradient}
          pointerEvents="none"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    width: "100%",
    marginTop: 6,
  },
  displayCard: {
    alignItems: "center",
    marginBottom: 20,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  mainValue: {
    fontSize: 54,
    fontWeight: "900",
    color: colors.textPrimary,
    letterSpacing: -1.5,
  },
  unitText: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.accent,
  },
  secondaryValue: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textSecondary,
    marginLeft: 4,
  },

  /* Wheel Container */
  pickerWrapper: {
    width: "100%",
    height: PICKER_HEIGHT,
    backgroundColor: colors.white,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    overflow: "hidden",
    position: "relative",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  selectionHighlight: {
    position: "absolute",
    top: PADDING_VERT,
    left: 12,
    right: 12,
    height: ITEM_HEIGHT,
    backgroundColor: "rgba(255, 103, 56, 0.08)",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.accent,
    zIndex: 1,
  },

  /* Wheel Item */
  wheelItem: {
    height: ITEM_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  numberText: {
    fontSize: 22,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  unitSuffix: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textTertiary,
  },

  /* States */
  selectedText: {
    fontSize: 28,
    fontWeight: "900",
    color: colors.accent,
    letterSpacing: -0.5,
  },
  selectedUnit: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.accent,
  },
  nearText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#64748B",
    opacity: 0.65,
  },
  farText: {
    fontSize: 18,
    fontWeight: "500",
    color: "#94A3B8",
    opacity: 0.35,
  },
  farUnit: {
    opacity: 0.3,
  },

  /* Gradient Fades */
  topGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 70,
    zIndex: 3,
  },
  bottomGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
    zIndex: 3,
  },
});
