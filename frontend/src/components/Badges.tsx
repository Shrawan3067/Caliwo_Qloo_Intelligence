import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import Svg, {
  Polygon,
  Defs,
  LinearGradient,
  Stop,
  Circle,
} from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";

// 3D Hexagon coordinates
const HEX_OUTER = "50,0 93.3,25 93.3,75 50,100 6.7,75 6.7,25";
const HEX_INNER = "50,6 88,28 88,72 50,94 12,72 12,28";
const HEX_GLOSS = "50,6 88,28 88,45 50,30 12,45 12,28"; // A highlight shape for the top half

type BadgeProps = {
  id: string;
  kind: string;
  unlocked: boolean;
  value: number;
};

// Map categories to vibrant 3D gradients
function getCategoryGradients(kind: string) {
  const map: Record<string, { bg1: string; bg2: string; border1: string; border2: string }> = {
    streak: { bg1: "#FFB74D", bg2: "#F57C00", border1: "#FFE082", border2: "#E65100" },
    target: { bg1: "#BA68C8", bg2: "#7B1FA2", border1: "#E1BEE7", border2: "#4A148C" },
    loyalty: { bg1: "#4DD0E1", bg2: "#0097A6", border1: "#B2EBF2", border2: "#006064" },
    people2: { bg1: "#4DB6AC", bg2: "#00796B", border1: "#B2DFDB", border2: "#004D40" },
    people3: { bg1: "#4DB6AC", bg2: "#00796B", border1: "#B2DFDB", border2: "#004D40" },
    people5: { bg1: "#4DB6AC", bg2: "#00796B", border1: "#B2DFDB", border2: "#004D40" },
    drop: { bg1: "#4FC3F7", bg2: "#0288D1", border1: "#B3E5FC", border2: "#01579B" },
    cup: { bg1: "#4FC3F7", bg2: "#0288D1", border1: "#B3E5FC", border2: "#01579B" },
    jug: { bg1: "#4FC3F7", bg2: "#0288D1", border1: "#B3E5FC", border2: "#01579B" },
    skull: { bg1: "#E57373", bg2: "#C62828", border1: "#FFCDD2", border2: "#b71c1c" },
    bolt: { bg1: "#E57373", bg2: "#C62828", border1: "#FFCDD2", border2: "#b71c1c" },
    leaf: { bg1: "#AED581", bg2: "#558B2F", border1: "#DCEDC8", border2: "#33691E" },
    nut: { bg1: "#AED581", bg2: "#558B2F", border1: "#DCEDC8", border2: "#33691E" },
    berry: { bg1: "#AED581", bg2: "#558B2F", border1: "#DCEDC8", border2: "#33691E" },
    wings: { bg1: "#9575CD", bg2: "#4527A0", border1: "#D1C4E9", border2: "#311B92" },
    owl: { bg1: "#9575CD", bg2: "#4527A0", border1: "#D1C4E9", border2: "#311B92" },
    trash: { bg1: "#9575CD", bg2: "#4527A0", border1: "#D1C4E9", border2: "#311B92" },
    twin: { bg1: "#9575CD", bg2: "#4527A0", border1: "#D1C4E9", border2: "#311B92" },
    bowl: { bg1: "#FFCA28", bg2: "#FF8F00", border1: "#FFECB3", border2: "#FF6F00" },
    omega: { bg1: "#FFCA28", bg2: "#FF8F00", border1: "#FFECB3", border2: "#FF6F00" },
    sweep: { bg1: "#FFCA28", bg2: "#FF8F00", border1: "#FFECB3", border2: "#FF6F00" },
    protein: { bg1: "#90A4AE", bg2: "#455A64", border1: "#CFD8DC", border2: "#263238" },
  };

  return (
    map[kind] || {
      bg1: "#FFD54F",
      bg2: "#FF8F00",
      border1: "#FFF9C4",
      border2: "#FF6F00",
    }
  );
}

// Inner custom SVG icons tailored for the badges
function RenderCustomIcon({ kind, value, unlocked }: { kind: string; value: number; unlocked: boolean }) {
  const c = unlocked ? "#FFFFFF" : "#9CA3AF";
  
  if (kind === "streak") {
    const num = value >= 1000 ? `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k` : `${value}`;
    return (
      <View style={{ alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 24, fontWeight: "900", color: c }}>
          {num}
        </Text>
        <Text style={{ fontSize: 9, fontWeight: "900", color: c, letterSpacing: 1.5 }}>DAYS</Text>
      </View>
    );
  }
  
  if (kind === "loyalty" || kind === "target") {
    return (
      <View style={{ alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 26, fontWeight: "900", color: c }}>
          {value}{kind === "loyalty" ? "x" : ""}
        </Text>
      </View>
    );
  }

  if (kind === "omega") {
    return (
      <Text style={{ fontSize: 36, fontWeight: "900", color: c, marginTop: -4 }}>
        Ω
      </Text>
    );
  }

  // Fallbacks to Ionicons but styled brightly inside the new 3D frame
  const iconMap: any = {
    bowl: "restaurant",
    people2: "people",
    people3: "people",
    people5: "earth",
    drop: "water",
    cup: "cafe",
    jug: "wine",
    skull: "skull",
    bolt: "flash",
    leaf: "leaf",
    nut: "nutrition",
    berry: "color-palette",
    wings: "paper-plane",
    owl: "moon",
    trash: "trash",
    twin: "copy",
    sweep: "star",
    protein: "barbell",
  };

  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <Ionicons name={iconMap[kind] || "ribbon"} size={36} color={c} />
      {value > 1 && kind !== "skull" && kind !== "berry" && kind !== "leaf" && kind !== "nut" && kind !== "sweep" && (
        <View style={{ position: "absolute", bottom: -8, backgroundColor: "rgba(0,0,0,0.25)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 }}>
          <Text style={{ color: "#FFF", fontSize: 10, fontWeight: "800" }}>{value >= 1000 ? `${(value/1000).toFixed(0)}k` : value}</Text>
        </View>
      )}
    </View>
  );
}

export function PremiumBadge({ id, kind, unlocked, value }: BadgeProps) {
  const g = getCategoryGradients(kind);

  // Locked states use flat grayscale
  const bg1 = unlocked ? g.bg1 : "#F3F4F6";
  const bg2 = unlocked ? g.bg2 : "#D1D5DB";
  const border1 = unlocked ? g.border1 : "#E5E7EB";
  const border2 = unlocked ? g.border2 : "#9CA3AF";

  return (
    <View style={styles.container}>
      {/* Dynamic Glow Shadow */}
      {unlocked && (
        <View
          style={[
            styles.glow,
            { shadowColor: g.bg2 },
          ]}
        />
      )}

      {/* Main Vector Medallion */}
      <View style={{ width: 100, height: 100, alignItems: "center", justifyContent: "center" }}>
        <Svg width={100} height={100} viewBox="0 0 100 100">
          <Defs>
            {/* Outer border gradient (metallic effect) */}
            <LinearGradient id={`borderGrad-${id}`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={border1} stopOpacity="1" />
              <Stop offset="0.5" stopColor={border2} stopOpacity="1" />
              <Stop offset="1" stopColor={border1} stopOpacity="1" />
            </LinearGradient>

            {/* Inner background gradient */}
            <LinearGradient id={`bgGrad-${id}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={bg1} stopOpacity="1" />
              <Stop offset="1" stopColor={bg2} stopOpacity="1" />
            </LinearGradient>
            
            {/* Gloss gradient */}
            <LinearGradient id={`glossGrad-${id}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.4" />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0.0" />
            </LinearGradient>
          </Defs>

          {/* 1. Outer Border / Shadow Edge */}
          <Polygon points={HEX_OUTER} fill={`url(#borderGrad-${id})`} />

          {/* 2. Inner Colored Base */}
          <Polygon points={HEX_INNER} fill={`url(#bgGrad-${id})`} />

          {/* 3. Top Glossy Highlight Overlay */}
          {unlocked && <Polygon points={HEX_GLOSS} fill={`url(#glossGrad-${id})`} />}
          
          {/* 4. Inner Ring (Decorative) */}
          <Circle cx="50" cy="50" r="32" stroke="rgba(255,255,255,0.15)" strokeWidth="2" fill="none" />
          <Circle cx="50" cy="50" r="34" stroke="rgba(0,0,0,0.1)" strokeWidth="1" fill="none" />
        </Svg>

        {/* 5. Center Icon / Content */}
        <View style={{ position: "absolute", zIndex: 10, width: 64, height: 64, alignItems: "center", justifyContent: "center" }}>
          <RenderCustomIcon kind={kind} value={value} unlocked={unlocked} />
        </View>
        
        {/* Unlocked Particles (just visual flair) */}
        {unlocked && (
          <View style={{ position: "absolute", width: "100%", height: "100%", zIndex: 5 }}>
            <View style={[styles.star, { top: 18, left: 24, transform: [{ scale: 0.6 }], opacity: 0.6 }]}><Ionicons name="sparkles" size={12} color="#FFF" /></View>
            <View style={[styles.star, { bottom: 20, right: 22, transform: [{ scale: 0.8 }], opacity: 0.4 }]}><Ionicons name="sparkles" size={12} color="#FFF" /></View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 100,
    height: 100,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  glow: {
    position: "absolute",
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: "transparent",
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 16,
      },
      android: {
        elevation: 10,
      },
      default: {},
    }),
  },
  star: {
    position: "absolute",
  }
});
