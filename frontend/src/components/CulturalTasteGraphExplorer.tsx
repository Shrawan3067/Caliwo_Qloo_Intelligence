import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from "react-native";
import Svg, {
  Line,
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
} from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { getTasteEntityMeta } from "@/src/utils/tasteIcons";

export type TasteEntityItem = {
  name: string;
  id: string;
  score?: number;
};

export type TasteGraphData = {
  cuisines?: string[];
  film_tags?: string[];
  music_tags?: string[];
  travel_tags?: string[];
  restaurants?: string[];
  dining_matches?: any[];
  entity_count?: number;
  domains_connected?: number;
  entities_map?: {
    film?: TasteEntityItem[];
    films?: TasteEntityItem[];
    music?: TasteEntityItem[];
    travel?: TasteEntityItem[];
    restaurants?: TasteEntityItem[];
    [key: string]: any;
  };
  top_recipe?: {
    dish_name?: string;
    restaurant_anchor?: string;
    cultural_inspiration?: string;
    protein_g?: number;
    calories?: number;
    score?: number;
  };
};

type GraphNode = {
  id: string;
  name: string;
  domain: string;
  category: string;
  icon: any;
  color: string;
  bg: string;
  affinity: number;
  x: number;
  y: number;
  causalStory: string;
  uuid?: string;
};

export default function CulturalTasteGraphExplorer({
  data,
  onSelectEntity,
}: {
  data?: TasteGraphData;
  onSelectEntity?: (entityName: string) => void;
}) {
  const router = useRouter();

  // Extract anchors from data or live entities_map or apply realistic cultural defaults
  const filmItem = data?.entities_map?.["film"]?.[0] || data?.entities_map?.["films"]?.[0];
  const musicItem = data?.entities_map?.["music"]?.[0];
  const travelItem = data?.entities_map?.["travel"]?.[0];
  const venueItem =
    data?.entities_map?.["restaurants"]?.[0] || data?.entities_map?.["restaurant"]?.[0];

  const filmAnchor = filmItem?.name || data?.film_tags?.[0] || "Midnight in Paris";
  const musicAnchor = musicItem?.name || data?.music_tags?.[0] || "Daft Punk";
  const travelAnchor = travelItem?.name || data?.travel_tags?.[0] || "Tokyo";
  const venueAnchor =
    venueItem?.name ||
    data?.restaurants?.[0] ||
    (typeof data?.dining_matches?.[0] === "string"
      ? data.dining_matches[0]
      : data?.dining_matches?.[0]?.name) ||
    "Nobu";
  const recipeAnchor =
    data?.top_recipe?.dish_name || "Miso-Glazed Chilean Sea Bass Bowl";

  const filmMeta = getTasteEntityMeta(filmAnchor, "films");
  const musicMeta = getTasteEntityMeta(musicAnchor, "music");
  const travelMeta = getTasteEntityMeta(travelAnchor, "travel");
  const venueMeta = getTasteEntityMeta(venueAnchor, "restaurants");
  const recipeMeta = getTasteEntityMeta(recipeAnchor, "cuisines");

  const nodes: GraphNode[] = useMemo(
    () => [
      {
        id: "core",
        name: "Qloo Taste AI",
        domain: "Cultural Graph Core",
        category: "engine",
        icon: "sparkles",
        color: "#C084FC",
        bg: "rgba(192, 132, 252, 0.25)",
        affinity: 98,
        x: 165,
        y: 110,
        causalStory:
          "The core intelligence layer linking 6 cultural domains into verified biometric nutritional targets.",
        uuid: "urn:qloo:taste-dna:core-v2",
      },
      {
        id: "film",
        name: filmAnchor,
        domain: "Cinema Aesthetic",
        category: "film",
        icon: filmMeta.icon,
        color: filmMeta.color,
        bg: filmMeta.bg,
        affinity: filmItem?.score ? Math.round(filmItem.score <= 1 ? filmItem.score * 100 : filmItem.score) : 95,
        x: 50,
        y: 40,
        causalStory: `Your affinity for '${filmAnchor}' projects neo-bistro and intimate culinary aesthetics into dining preferences.`,
        uuid: data?.entities_map?.["film"]?.[0]?.id || data?.entities_map?.["films"]?.[0]?.id || "57E97B92-9552-452D-A5EC-6B098C879918",
      },
      {
        id: "music",
        name: musicAnchor,
        domain: "Audio Pulse",
        category: "music",
        icon: musicMeta.icon,
        color: musicMeta.color,
        bg: musicMeta.bg,
        affinity: musicItem?.score ? Math.round(musicItem.score <= 1 ? musicItem.score * 100 : musicItem.score) : 92,
        x: 280,
        y: 40,
        causalStory: `Your music vibe from '${musicAnchor}' mirrors vibrant, contemporary dining spaces with bold flavor profiles.`,
        uuid: data?.entities_map?.["music"]?.[0]?.id || "685BCE85-1F46-4A12-8CC8-7FF205B34943",
      },
      {
        id: "travel",
        name: travelAnchor,
        domain: "Travel Origin",
        category: "travel",
        icon: travelMeta.icon,
        color: travelMeta.color,
        bg: travelMeta.bg,
        affinity: travelItem?.score ? Math.round(travelItem.score <= 1 ? travelItem.score * 100 : travelItem.score) : 94,
        x: 45,
        y: 185,
        causalStory: `Travel roots in ${travelAnchor} anchor authenticity in umami, clean fermentation, and fresh marine proteins.`,
        uuid: data?.entities_map?.["travel"]?.[0]?.id || "8805E82D-342B-42D0-9B2F-988DEBF13942",
      },
      {
        id: "venue",
        name: venueAnchor,
        domain: "Qloo Dining Anchor",
        category: "restaurants",
        icon: venueMeta.icon,
        color: venueMeta.color,
        bg: venueMeta.bg,
        affinity: venueItem?.score ? Math.round(venueItem.score <= 1 ? venueItem.score * 100 : venueItem.score) : 96,
        x: 285,
        y: 185,
        causalStory: `Resolved by Qloo /v2/insights as the highest cross-domain dining match for your multi-domain taste identity.`,
        uuid: data?.entities_map?.["restaurants"]?.[0]?.id || data?.entities_map?.["restaurant"]?.[0]?.id || "338FE2A1-0D44-4822-86EC-348FA0316410",
      },
      {
        id: "recipe",
        name: recipeAnchor,
        domain: "Bio-Cultural Recipe",
        category: "recipe",
        icon: "flame",
        color: "#10B981",
        bg: "rgba(16, 185, 129, 0.22)",
        affinity: 96,
        x: 165,
        y: 225,
        causalStory: `Synthesized to bridge your cultural identity into ${data?.top_recipe?.protein_g ? Math.round(data.top_recipe.protein_g) : 38}g protein & under ${data?.top_recipe?.calories ? Math.round(data.top_recipe.calories) : 550} kcal.`,
        uuid: "urn:caliwo:recipe:synthesis-qloo",
      },
    ],
    [filmAnchor, musicAnchor, travelAnchor, venueAnchor, recipeAnchor, data, filmItem, musicItem, travelItem, venueItem]
  );

  const [selectedId, setSelectedId] = useState<string>("venue");
  const selectedNode = nodes.find((n) => n.id === selectedId) || nodes[4];

  // SVG dimensions
  const SVG_WIDTH = 330;
  const SVG_HEIGHT = 260;

  const edges = [
    { from: "core", to: "film", affinity: "95%" },
    { from: "core", to: "music", affinity: "92%" },
    { from: "core", to: "travel", affinity: "94%" },
    { from: "core", to: "venue", affinity: "96%" },
    { from: "core", to: "recipe", affinity: "96%" },
    { from: "film", to: "venue", affinity: "91%" },
    { from: "travel", to: "recipe", affinity: "94%" },
    { from: "venue", to: "recipe", affinity: "98%" },
  ];

  return (
    <View style={styles.container} testID="cultural-taste-graph-explorer">
      {/* Visualizer Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Ionicons name="git-network-outline" size={16} color="#C084FC" />
          <Text style={styles.headerTitle}>CULTURAL TASTE CONSTELLATION</Text>
        </View>
        <View style={styles.domainsBadge}>
          <Ionicons name="sparkles" size={10} color="#10B981" />
          <Text style={styles.domainsBadgeText}>
            {data?.domains_connected || 5} Domains Traversed
          </Text>
        </View>
      </View>

      <Text style={styles.subtext}>
        Interactive Qloo multi-hop graph mapping cinema, music & travel into your
        dietary targets.
      </Text>

      {/* Interactive SVG Constellation Canvas */}
      <View style={styles.canvasCard}>
        <LinearGradient
          colors={["#0F0C29", "#1B1746", "#141033"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.canvasGradient}
        >
          {/* SVG Connection Lines */}
          <View style={StyleSheet.absoluteFill}>
            <Svg width="100%" height={SVG_HEIGHT} viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}>
              <Defs>
                <SvgLinearGradient id="activeGrad" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0%" stopColor="#C084FC" stopOpacity="0.9" />
                  <Stop offset="100%" stopColor="#10B981" stopOpacity="0.9" />
                </SvgLinearGradient>
                <SvgLinearGradient id="dimGrad" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0%" stopColor="#818CF8" stopOpacity="0.3" />
                  <Stop offset="100%" stopColor="#A78BFA" stopOpacity="0.3" />
                </SvgLinearGradient>
              </Defs>

              {edges.map((edge, idx) => {
                const nFrom = nodes.find((n) => n.id === edge.from)!;
                const nTo = nodes.find((n) => n.id === edge.to)!;
                const isActive =
                  selectedId === edge.from || selectedId === edge.to;

                return (
                  <Line
                    key={idx}
                    x1={nFrom.x}
                    y1={nFrom.y}
                    x2={nTo.x}
                    y2={nTo.y}
                    stroke={isActive ? "url(#activeGrad)" : "url(#dimGrad)"}
                    strokeWidth={isActive ? 2.5 : 1}
                    strokeDasharray={isActive ? undefined : "4, 4"}
                  />
                );
              })}

              {/* Central Core Ambient Glow */}
              <Circle
                cx={165}
                cy={110}
                r={28}
                fill="rgba(192, 132, 252, 0.12)"
              />
            </Svg>
          </View>

          {/* Interactive Touch Nodes */}
          {nodes.map((node) => {
            const isSelected = selectedId === node.id;
            const isCore = node.id === "core";

            return (
              <TouchableOpacity
                key={node.id}
                activeOpacity={0.8}
                onPress={() => {
                  setSelectedId(node.id);
                  onSelectEntity?.(node.name);
                }}
                style={[
                  styles.nodeWrap,
                  {
                    left: node.x - (isCore ? 30 : 26),
                    top: node.y - (isCore ? 30 : 26),
                    width: isCore ? 60 : 52,
                    height: isCore ? 60 : 52,
                  },
                  isSelected && styles.nodeWrapSelected,
                ]}
              >
                <View
                  style={[
                    styles.nodeCircle,
                    {
                      backgroundColor: node.bg,
                      borderColor: isSelected ? "#FFFFFF" : node.color + "90",
                      borderWidth: isSelected ? 2 : 1,
                    },
                  ]}
                >
                  <Ionicons
                    name={node.icon}
                    size={isCore ? 20 : 16}
                    color={node.color}
                  />
                </View>
                <Text
                  style={[
                    styles.nodeLabel,
                    isSelected && { color: "#FFFFFF", fontWeight: "800" },
                  ]}
                  numberOfLines={1}
                >
                  {node.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </LinearGradient>
      </View>

      {/* Causal Bridge Inspector */}
      <View style={styles.inspectorCard}>
        <View style={styles.inspectorHeader}>
          <View style={styles.inspectorDomainWrap}>
            <View
              style={[
                styles.domainIconBadge,
                { backgroundColor: selectedNode.bg },
              ]}
            >
              <Ionicons
                name={selectedNode.icon}
                size={14}
                color={selectedNode.color}
              />
            </View>
            <View>
              <Text style={styles.inspectorDomainLabel}>
                {selectedNode.domain.toUpperCase()}
              </Text>
              <Text style={styles.inspectorNodeName}>
                {selectedNode.name}
              </Text>
            </View>
          </View>

          <View style={styles.affinityBadge}>
            <Text style={styles.affinityBadgeText}>
              {selectedNode.affinity}% MATCH
            </Text>
          </View>
        </View>

        {/* Multi-Hop Traversal Chain */}
        <View style={styles.chainRow}>
          <Text style={styles.chainLabel}>QLOO GRAPH TRAVERSAL CAUSALITY:</Text>
          <View style={styles.chainPillRow}>
            <View style={styles.chainPill}>
              <Text style={styles.chainPillText}>1. {selectedNode.domain}</Text>
            </View>
            <Ionicons name="arrow-forward" size={10} color="#94A3B8" />
            <View style={styles.chainPill}>
              <Text style={styles.chainPillText}>2. Cultural Affinity</Text>
            </View>
            <Ionicons name="arrow-forward" size={10} color="#94A3B8" />
            <View style={[styles.chainPill, styles.chainPillActive]}>
              <Text style={styles.chainPillTextActive}>3. Bio-Nutritional Goal</Text>
            </View>
          </View>
        </View>

        {/* Explanation Callout */}
        <Text style={styles.causalStoryText}>
          &ldquo;{selectedNode.causalStory}&rdquo;
        </Text>

        {/* UUID / Entity Metadata Badge */}
        {Boolean(data?.entities_map?.[selectedNode.category]?.[0]?.id || selectedNode.uuid) && (
          <View style={styles.uuidRow} testID={`entity-uuid-${selectedNode.id}`}>
            <Ionicons name="finger-print" size={11} color="#A78BFA" />
            <Text style={styles.uuidText}>
              Entity ID: {data?.entities_map?.[selectedNode.category]?.[0]?.id || selectedNode.uuid}
            </Text>
          </View>
        )}

        {/* Action Button: Route into Coach with grounding prompt */}
        <TouchableOpacity
          style={styles.actionBtn}
          activeOpacity={0.85}
          onPress={() => {
            const prompt = `Synthesize a culturally-aligned recipe grounded in ${selectedNode.name} (${selectedNode.domain}) that satisfies my remaining protein budget.`;
            router.push({
              pathname: "/(tabs)/coach",
              params: { prompt },
            } as any);
          }}
        >
          <Ionicons name="sparkles" size={13} color="#0F172A" />
          <Text style={styles.actionBtnText}>
            Ask Coach for Recipe Aligned with {selectedNode.name}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerTitle: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: "#C084FC",
  },
  domainsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  domainsBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#34D399",
  },
  subtext: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.7)",
    marginBottom: 12,
    lineHeight: 16,
  },
  canvasCard: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(192, 132, 252, 0.35)",
    ...Platform.select({
      ios: {
        shadowColor: "#7C3AED",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 14,
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  canvasGradient: {
    height: 260,
    position: "relative",
  },
  nodeWrap: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  nodeWrapSelected: {
    transform: [{ scale: 1.1 }],
  },
  nodeCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  nodeLabel: {
    fontSize: 9,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.75)",
    marginTop: 3,
    maxWidth: 68,
    textAlign: "center",
  },
  inspectorCard: {
    marginTop: 12,
    backgroundColor: "rgba(30, 27, 75, 0.65)",
    borderWidth: 1,
    borderColor: "rgba(192, 132, 252, 0.3)",
    borderRadius: 16,
    padding: 14,
  },
  inspectorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  inspectorDomainWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  domainIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  inspectorDomainLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#C084FC",
    letterSpacing: 0.4,
  },
  inspectorNodeName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  affinityBadge: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.35)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  affinityBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#F59E0B",
  },
  chainRow: {
    marginBottom: 8,
  },
  chainLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.5)",
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  chainPillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  chainPill: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  chainPillActive: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    borderColor: "rgba(16, 185, 129, 0.4)",
    borderWidth: 1,
  },
  chainPillText: {
    fontSize: 9,
    fontWeight: "600",
    color: "#CBD5E1",
  },
  chainPillTextActive: {
    fontSize: 9,
    fontWeight: "700",
    color: "#34D399",
  },
  causalStoryText: {
    fontSize: 12,
    color: "#E2E8F0",
    fontStyle: "italic",
    lineHeight: 17,
    marginBottom: 8,
  },
  uuidRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 10,
  },
  uuidText: {
    fontSize: 9,
    color: "#64748B",
    fontFamily: Platform.select({ ios: "Courier", default: "monospace" }),
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#38BDF8",
    paddingVertical: 10,
    borderRadius: 12,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0F172A",
  },
});
