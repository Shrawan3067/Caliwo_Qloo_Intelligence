import React, { useRef, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
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
  unit: "cm" | "ft";
  heightCm: number;
  onChangeCm: (cm: number) => void;
  testID?: string;
};

// CM Range: 100cm to 240cm
const MIN_CM = 100;
const MAX_CM = 240;
const CM_DATA: number[] = [];
for (let c = MIN_CM; c <= MAX_CM; c++) {
  CM_DATA.push(c);
}

// Feet: 3 to 7
const FEET_DATA = [3, 4, 5, 6, 7];
// Inches: 0 to 11
const INCHES_DATA = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export function VerticalHeightPicker({
  unit,
  heightCm,
  onChangeCm,
  testID,
}: Props) {
  // Current values
  const currentCm = Math.max(MIN_CM, Math.min(MAX_CM, heightCm || 170));
  const totalInches = Math.round(currentCm / 2.54);
  const currentFeet = Math.max(3, Math.min(7, Math.floor(totalInches / 12)));
  const currentInches = Math.max(0, Math.min(11, totalInches % 12));

  // Refs for scrolling
  const cmListRef = useRef<FlatList>(null);
  const feetListRef = useRef<FlatList>(null);
  const inchesListRef = useRef<FlatList>(null);

  // Scroll to initial index on mount or unit switch
  useEffect(() => {
    if (unit === "cm") {
      const idx = CM_DATA.indexOf(currentCm);
      if (idx !== -1) {
        setTimeout(() => {
          cmListRef.current?.scrollToOffset({
            offset: idx * ITEM_HEIGHT,
            animated: false,
          });
        }, 60);
      }
    } else {
      const fIdx = FEET_DATA.indexOf(currentFeet);
      const iIdx = INCHES_DATA.indexOf(currentInches);
      setTimeout(() => {
        if (fIdx !== -1) {
          feetListRef.current?.scrollToOffset({
            offset: fIdx * ITEM_HEIGHT,
            animated: false,
          });
        }
        if (iIdx !== -1) {
          inchesListRef.current?.scrollToOffset({
            offset: iIdx * ITEM_HEIGHT,
            animated: false,
          });
        }
      }, 60);
    }
  }, [unit]);

  const handleCmScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = e.nativeEvent.contentOffset.y;
      const idx = Math.round(offset / ITEM_HEIGHT);
      const clampedIdx = Math.max(0, Math.min(CM_DATA.length - 1, idx));
      const newCm = CM_DATA[clampedIdx];
      if (newCm !== currentCm) {
        Haptics.selectionAsync().catch(() => {});
        onChangeCm(newCm);
      }
    },
    [currentCm, onChangeCm]
  );

  const handleFeetScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = e.nativeEvent.contentOffset.y;
      const idx = Math.round(offset / ITEM_HEIGHT);
      const clampedIdx = Math.max(0, Math.min(FEET_DATA.length - 1, idx));
      const newFeet = FEET_DATA[clampedIdx];
      if (newFeet !== currentFeet) {
        Haptics.selectionAsync().catch(() => {});
        const newCm = Math.round((newFeet * 12 + currentInches) * 2.54);
        onChangeCm(Math.max(MIN_CM, Math.min(MAX_CM, newCm)));
      }
    },
    [currentFeet, currentInches, onChangeCm]
  );

  const handleInchesScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = e.nativeEvent.contentOffset.y;
      const idx = Math.round(offset / ITEM_HEIGHT);
      const clampedIdx = Math.max(0, Math.min(INCHES_DATA.length - 1, idx));
      const newInches = INCHES_DATA[clampedIdx];
      if (newInches !== currentInches) {
        Haptics.selectionAsync().catch(() => {});
        const newCm = Math.round((currentFeet * 12 + newInches) * 2.54);
        onChangeCm(Math.max(MIN_CM, Math.min(MAX_CM, newCm)));
      }
    },
    [currentFeet, currentInches, onChangeCm]
  );

  return (
    <View style={styles.container} testID={testID}>
      {/* Prominent Header Display */}
      <View style={styles.displayCard}>
        {unit === "cm" ? (
          <View style={styles.valueRow}>
            <Text style={styles.mainValue}>{currentCm}</Text>
            <Text style={styles.unitText}>cm</Text>
            <Text style={styles.secondaryValue}>
              ({currentFeet}&apos;{currentInches}&quot;)
            </Text>
          </View>
        ) : (
          <View style={styles.valueRow}>
            <Text style={styles.mainValue}>
              {currentFeet}&apos; {currentInches}&quot;
            </Text>
            <Text style={styles.secondaryValue}>({currentCm} cm)</Text>
          </View>
        )}
      </View>

      {/* Wheel Selector Frame */}
      <View style={styles.pickerWrapper}>
        {/* Selection Center Highlight Bar */}
        <View style={styles.selectionHighlight} pointerEvents="none" />

        {unit === "cm" ? (
          /* Single Column CM Picker */
          <View style={styles.singleColumnWrap}>
            <FlatList
              ref={cmListRef}
              data={CM_DATA}
              keyExtractor={(item) => `cm-${item}`}
              showsVerticalScrollIndicator={false}
              snapToInterval={ITEM_HEIGHT}
              decelerationRate="fast"
              initialScrollIndex={Math.max(0, CM_DATA.indexOf(currentCm))}
              getItemLayout={(_, index) => ({
                length: ITEM_HEIGHT,
                offset: ITEM_HEIGHT * index,
                index,
              })}
              contentContainerStyle={{ paddingVertical: PADDING_VERT }}
              onMomentumScrollEnd={handleCmScrollEnd}
              renderItem={({ item }) => {
                const isSelected = item === currentCm;
                const dist = Math.abs(item - currentCm);
                return (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                      const idx = CM_DATA.indexOf(item);
                      cmListRef.current?.scrollToOffset({
                        offset: idx * ITEM_HEIGHT,
                        animated: true,
                      });
                      Haptics.selectionAsync().catch(() => {});
                      onChangeCm(item);
                    }}
                    style={styles.wheelItem}
                  >
                    <View style={styles.cmItemRow}>
                      <Text
                        style={[
                          styles.cmText,
                          isSelected && styles.selectedText,
                          dist === 1 && styles.nearText,
                          dist >= 2 && styles.farText,
                        ]}
                      >
                        {item}
                      </Text>
                      <Text
                        style={[
                          styles.cmUnit,
                          isSelected && styles.selectedUnit,
                          dist >= 1 && styles.farUnit,
                        ]}
                      >
                        cm
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        ) : (
          /* Dual Column Feet & Inches Picker */
          <View style={styles.dualColumnWrap}>
            {/* Feet Column */}
            <View style={styles.columnHalf}>
              <Text style={styles.columnLabel}>FEET</Text>
              <FlatList
                ref={feetListRef}
                data={FEET_DATA}
                keyExtractor={(item) => `feet-${item}`}
                showsVerticalScrollIndicator={false}
                snapToInterval={ITEM_HEIGHT}
                decelerationRate="fast"
                initialScrollIndex={Math.max(0, FEET_DATA.indexOf(currentFeet))}
                getItemLayout={(_, index) => ({
                  length: ITEM_HEIGHT,
                  offset: ITEM_HEIGHT * index,
                  index,
                })}
                contentContainerStyle={{ paddingVertical: PADDING_VERT }}
                onMomentumScrollEnd={handleFeetScrollEnd}
                renderItem={({ item }) => {
                  const isSelected = item === currentFeet;
                  const dist = Math.abs(item - currentFeet);
                  return (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => {
                        const idx = FEET_DATA.indexOf(item);
                        feetListRef.current?.scrollToOffset({
                          offset: idx * ITEM_HEIGHT,
                          animated: true,
                        });
                        Haptics.selectionAsync().catch(() => {});
                        const newCm = Math.round(
                          (item * 12 + currentInches) * 2.54
                        );
                        onChangeCm(Math.max(MIN_CM, Math.min(MAX_CM, newCm)));
                      }}
                      style={styles.wheelItem}
                    >
                      <View style={styles.ftItemRow}>
                        <Text
                          style={[
                            styles.ftNumber,
                            isSelected && styles.selectedText,
                            dist === 1 && styles.nearText,
                            dist >= 2 && styles.farText,
                          ]}
                        >
                          {item}
                        </Text>
                        <Text
                          style={[
                            styles.ftSuffix,
                            isSelected && styles.selectedUnit,
                            dist >= 1 && styles.farUnit,
                          ]}
                        >
                          ft
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            </View>

            {/* Column Separator */}
            <View style={styles.columnDivider} />

            {/* Inches Column */}
            <View style={styles.columnHalf}>
              <Text style={styles.columnLabel}>INCHES</Text>
              <FlatList
                ref={inchesListRef}
                data={INCHES_DATA}
                keyExtractor={(item) => `inches-${item}`}
                showsVerticalScrollIndicator={false}
                snapToInterval={ITEM_HEIGHT}
                decelerationRate="fast"
                initialScrollIndex={Math.max(
                  0,
                  INCHES_DATA.indexOf(currentInches)
                )}
                getItemLayout={(_, index) => ({
                  length: ITEM_HEIGHT,
                  offset: ITEM_HEIGHT * index,
                  index,
                })}
                contentContainerStyle={{ paddingVertical: PADDING_VERT }}
                onMomentumScrollEnd={handleInchesScrollEnd}
                renderItem={({ item }) => {
                  const isSelected = item === currentInches;
                  const dist = Math.abs(item - currentInches);
                  return (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => {
                        const idx = INCHES_DATA.indexOf(item);
                        inchesListRef.current?.scrollToOffset({
                          offset: idx * ITEM_HEIGHT,
                          animated: true,
                        });
                        Haptics.selectionAsync().catch(() => {});
                        const newCm = Math.round(
                          (currentFeet * 12 + item) * 2.54
                        );
                        onChangeCm(Math.max(MIN_CM, Math.min(MAX_CM, newCm)));
                      }}
                      style={styles.wheelItem}
                    >
                      <View style={styles.ftItemRow}>
                        <Text
                          style={[
                            styles.ftNumber,
                            isSelected && styles.selectedText,
                            dist === 1 && styles.nearText,
                            dist >= 2 && styles.farText,
                          ]}
                        >
                          {item}
                        </Text>
                        <Text
                          style={[
                            styles.ftSuffix,
                            isSelected && styles.selectedUnit,
                            dist >= 1 && styles.farUnit,
                          ]}
                        >
                          in
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            </View>
          </View>
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
  singleColumnWrap: {
    flex: 1,
    width: "100%",
  },
  dualColumnWrap: {
    flex: 1,
    flexDirection: "row",
    width: "100%",
  },
  columnHalf: {
    flex: 1,
    height: "100%",
    position: "relative",
  },
  columnLabel: {
    position: "absolute",
    top: 8,
    alignSelf: "center",
    fontSize: 9,
    fontWeight: "800",
    color: colors.textTertiary,
    letterSpacing: 1,
    zIndex: 5,
  },
  columnDivider: {
    width: 1,
    height: "70%",
    alignSelf: "center",
    backgroundColor: "#E2E8F0",
    zIndex: 2,
  },

  /* Wheel Item */
  wheelItem: {
    height: ITEM_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  cmItemRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  cmText: {
    fontSize: 22,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  cmUnit: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textTertiary,
  },
  ftItemRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  ftNumber: {
    fontSize: 24,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  ftSuffix: {
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
