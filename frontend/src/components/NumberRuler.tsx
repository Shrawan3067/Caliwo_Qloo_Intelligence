import React, { useRef } from "react";
import { View, Text, StyleSheet, FlatList, Dimensions } from "react-native";
import { colors } from "@/src/theme";

type Props = {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  testID?: string;
  formatValue?: (v: number) => string;
};

const ITEM_WIDTH = 12;
const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Simple horizontal ruler picker
export function NumberRuler({ min, max, step = 1, value, onChange, unit, testID, formatValue }: Props) {
  const listRef = useRef<FlatList>(null);
  const data = React.useMemo(() => {
    const out: number[] = [];
    for (let n = min; n <= max; n += step) out.push(n);
    return out;
  }, [min, max, step]);

  const initialIndex = Math.max(0, data.indexOf(value));
  const padSide = SCREEN_WIDTH / 2 - ITEM_WIDTH / 2;

  return (
    <View style={styles.wrap} testID={testID}>
      <View style={styles.valueRow}>
        <Text style={styles.value}>{formatValue ? formatValue(value) : value}</Text>
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>
      <View style={styles.rulerWrap}>
        <View style={styles.centerLine} />
        <FlatList
          ref={listRef}
          horizontal
          data={data}
          keyExtractor={(i) => String(i)}
          showsHorizontalScrollIndicator={false}
          snapToInterval={ITEM_WIDTH}
          decelerationRate="fast"
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({ length: ITEM_WIDTH, offset: ITEM_WIDTH * index, index })}
          contentContainerStyle={{ paddingHorizontal: padSide }}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / ITEM_WIDTH);
            const v = data[Math.max(0, Math.min(data.length - 1, idx))];
            if (v !== undefined) onChange(v);
          }}
          renderItem={({ item }) => {
            const isMajor = item % (step === 1 ? 5 : 1) === 0;
            return (
              <View style={styles.tickSlot}>
                <View style={[styles.tick, isMajor ? styles.tickMajor : styles.tickMinor]} />
                {isMajor ? <Text style={styles.tickLabel}>{item}</Text> : null}
              </View>
            );
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center" },
  valueRow: { flexDirection: "row", alignItems: "flex-end", marginBottom: 16 },
  value: { fontSize: 68, fontWeight: "900", color: colors.textPrimary, letterSpacing: -1 },
  unit: { fontSize: 22, color: colors.textSecondary, marginLeft: 6, marginBottom: 12, fontWeight: "700" },
  rulerWrap: {
    height: 90,
    width: "100%",
    justifyContent: "center",
  },
  centerLine: {
    position: "absolute",
    left: "50%",
    marginLeft: -1,
    top: 6,
    bottom: 30,
    width: 2,
    backgroundColor: colors.accent,
    borderRadius: 1,
    zIndex: 5,
  },
  tickSlot: {
    width: ITEM_WIDTH,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 8,
  },
  tick: { width: 1.5, backgroundColor: colors.textSecondary, borderRadius: 1 },
  tickMajor: { height: 30, backgroundColor: colors.black },
  tickMinor: { height: 14, backgroundColor: colors.textTertiary },
  tickLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 6,
    fontWeight: "600",
  },
});
