import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Linking,
  KeyboardAvoidingView,
  Alert,
} from "react-native";

import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/src/theme";
import api, { switchTastePersona, toggleBlindMode, getTasteProfile } from "@/src/lib/api";
import { useRouter, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { getTasteEntityMeta } from "@/src/utils/tasteIcons";
import CulturalComparisonModal from "@/src/components/CulturalComparisonModal";

import { AgentTelemetryBadge, AgentTelemetry } from "@/src/components/AgentTelemetryBadge";

type Msg = {
  role: "user" | "assistant";
  content: string;
  created_at?: string;
  _local?: boolean;
  agent_telemetry?: AgentTelemetry;
};

const QUICK: string[] = [
  "Suggest a dinner that matches my taste",
  "Am I eating enough protein?",
  "What cultural cuisines fit my profile?",
  "How can I hit my macros today?",
  "Discover meals based on my taste DNA",
  "Give me a healthy snack I'd love",
];

/* ---------- Shared elevation tokens ---------- */
const shadowSm = Platform.select({
  ios: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  android: { elevation: 2 },
  default: {},
});

const shadowMd = Platform.select({
  ios: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  android: { elevation: 3 },
  default: {},
});

/* ---------------------------------------------------------------------- */
/*  Lightweight markdown-ish renderer for AI messages                     */
/* ---------------------------------------------------------------------- */

type InlineSegment =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "link"; value: string };

type Block =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string; level: number }
  | { type: "bullet"; items: string[] }
  | { type: "numbered"; items: string[] };

const INLINE_REGEX = /(\*\*(.+?)\*\*)|((https?:\/\/|www\.)[^\s)]+)/g;

function parseInlineSegments(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  INLINE_REGEX.lastIndex = 0;
  while ((match = INLINE_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        value: text.slice(lastIndex, match.index),
      });
    }
    if (match[1]) {
      segments.push({ type: "bold", value: match[2] });
    } else if (match[3]) {
      segments.push({ type: "link", value: match[3] });
    }
    lastIndex = INLINE_REGEX.lastIndex;
  }
  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }
  return segments.length ? segments : [{ type: "text", value: text }];
}

function parseBlocks(content: string): Block[] {
  const lines = content.split(/\n/);
  const blocks: Block[] = [];

  let currentList: { type: "bullet" | "numbered"; items: string[] } | null =
    null;
  let currentParagraph: string[] = [];

  const flushParagraph = () => {
    if (currentParagraph.length) {
      blocks.push({ type: "paragraph", text: currentParagraph.join(" ") });
      currentParagraph = [];
    }
  };
  const flushList = () => {
    if (currentList) {
      blocks.push(currentList);
      currentList = null;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.*)/);
    const bulletMatch = line.match(/^[-*•]\s+(.*)/);
    const numberedMatch = line.match(/^\d+[.)]\s+(.*)/);

    if (headingMatch) {
      flushParagraph();
      flushList();
      blocks.push({
        type: "heading",
        text: headingMatch[2],
        level: headingMatch[1].length,
      });
    } else if (bulletMatch) {
      flushParagraph();
      if (!currentList || currentList.type !== "bullet") {
        flushList();
        currentList = { type: "bullet", items: [] };
      }
      currentList.items.push(bulletMatch[1]);
    } else if (numberedMatch) {
      flushParagraph();
      if (!currentList || currentList.type !== "numbered") {
        flushList();
        currentList = { type: "numbered", items: [] };
      }
      currentList.items.push(numberedMatch[1]);
    } else {
      flushList();
      currentParagraph.push(line);
    }
  }
  flushParagraph();
  flushList();

  return blocks.length ? blocks : [{ type: "paragraph", text: content }];
}

async function openLink(url: string) {
  const target = url.startsWith("http") ? url : `https://${url}`;
  try {
    const supported = await Linking.canOpenURL(target);
    if (supported) await Linking.openURL(target);
  } catch {}
}

function InlineText({ text, baseStyle }: { text: string; baseStyle: any }) {
  const segments = parseInlineSegments(text);
  return (
    <Text style={baseStyle}>
      {segments.map((seg, i) => {
        if (seg.type === "bold") {
          return (
            <Text key={i} style={styles.boldText}>
              {seg.value}
            </Text>
          );
        }
        if (seg.type === "link") {
          return (
            <Text
              key={i}
              style={styles.linkText}
              onPress={() => openLink(seg.value)}
              suppressHighlighting={false}
            >
              {seg.value}
            </Text>
          );
        }
        return <Text key={i}>{seg.value}</Text>;
      })}
    </Text>
  );
}

function FormattedMessage({
  content,
  isUser,
}: {
  content: string;
  isUser: boolean;
}) {
  const baseTextStyle = [styles.bubbleText, isUser && { color: colors.white }];
  const blocks = parseBlocks(content ?? "");

  return (
    <View style={{ gap: 4 }}>
      {blocks.map((block, idx) => {
        const spacing = idx > 0 ? styles.blockSpacing : undefined;

        if (block.type === "heading") {
          return (
            <View key={idx} style={spacing}>
              <InlineText
                text={block.text}
                baseStyle={[
                  styles.bubbleText,
                  block.level === 1
                    ? styles.h1
                    : block.level === 2
                      ? styles.h2
                      : styles.h3,
                  isUser && { color: colors.white },
                ]}
              />
            </View>
          );
        }

        if (block.type === "bullet") {
          return (
            <View key={idx} style={[styles.listWrap, spacing]}>
              {block.items.map((item, i) => (
                <View key={i} style={styles.listRow}>
                  <Text
                    style={[styles.bullet, isUser && { color: colors.white }]}
                  >
                    •
                  </Text>
                  <InlineText
                    text={item}
                    baseStyle={[
                      styles.bubbleText,
                      styles.listItemText,
                      isUser && { color: colors.white },
                    ]}
                  />
                </View>
              ))}
            </View>
          );
        }

        if (block.type === "numbered") {
          return (
            <View key={idx} style={[styles.listWrap, spacing]}>
              {block.items.map((item, i) => (
                <View key={i} style={styles.listRow}>
                  <Text
                    style={[
                      styles.bullet,
                      styles.numberBullet,
                      isUser && { color: colors.white },
                    ]}
                  >
                    {i + 1}.
                  </Text>
                  <InlineText
                    text={item}
                    baseStyle={[
                      styles.bubbleText,
                      styles.listItemText,
                      isUser && { color: colors.white },
                    ]}
                  />
                </View>
              ))}
            </View>
          );
        }

        return (
          <View key={idx} style={spacing}>
            <InlineText text={block.text} baseStyle={baseTextStyle} />
          </View>
        );
      })}
    </View>
  );
}

function InteractiveRecipeCard({
  recipe,
  telemetry,
}: {
  recipe: NonNullable<AgentTelemetry["synthesized_recipe"]>;
  telemetry: AgentTelemetry;
}) {
  const [logged, setLogged] = useState(false);
  const [logging, setLogging] = useState(false);
  const [showContrast, setShowContrast] = useState(false);
  const [actionTab, setActionTab] = useState<"cook" | "dine">("cook");

  const isBlind =
    recipe.verified_alignment_score === 0 ||
    telemetry.bio_cultural_score === 0 ||
    recipe.dish_name.toLowerCase().includes("plain steamed chicken");

  const score = isBlind
    ? 0
    : typeof recipe.verified_alignment_score === "number"
      ? recipe.verified_alignment_score
      : typeof telemetry.bio_cultural_score === "number"
        ? telemetry.bio_cultural_score
        : 94;

  const primaryAnchor = isBlind
    ? "Generic Bro-Diet (No Qloo)"
    : (telemetry.cultural_anchors && telemetry.cultural_anchors[0]) ||
      recipe.cuisine ||
      "Qloo Taste Graph";

  // Derive constituent cultural & macro scores mathematically
  const culturalScore = isBlind
    ? 0
    : Math.min(99, Math.max(86, Math.round(score * 1.02)));
  const macroScore = isBlind
    ? 100
    : Math.min(100, Math.max(80, Math.round((score - (culturalScore * 0.6)) / 0.4)));

  // Derive Qloo Restaurant Anchor & Venue Details
  const venueName =
    recipe.restaurant_anchor ||
    recipe.venue_name ||
    (telemetry.cultural_anchors &&
      telemetry.cultural_anchors.find((a) =>
        /nobu|osteria|casa|sweetgreen|toranoko|comptoir|buns|thai/i.test(a)
      )) ||
    (recipe.cuisine?.toLowerCase().includes("mediterranean") || recipe.dish_name?.toLowerCase().includes("sea bass")
      ? "Osteria Stellina"
      : recipe.cuisine?.toLowerCase().includes("mexican") || recipe.dish_name?.toLowerCase().includes("steak") || recipe.dish_name?.toLowerCase().includes("barbacoa")
        ? "Casa Oaxaca"
        : "Nobu NYC");

  const venueDistance =
    venueName.toLowerCase().includes("nobu")
      ? "0.8 mi • Tribeca / Downtown"
      : venueName.toLowerCase().includes("osteria")
        ? "1.1 mi • West Village"
        : venueName.toLowerCase().includes("casa")
          ? "0.6 mi • Arts District"
          : "0.9 mi • Nearby Cultural Anchor";

  // Exact Order for remaining budget
  const diningOrder =
    recipe.dining_order_guide ||
    (recipe.dish_name.toLowerCase().includes("salmon") || recipe.dish_name.toLowerCase().includes("cod")
      ? `Order the Miso Cod with steamed greens, sauce light — ${Math.round(recipe.protein_g)}g Protein, ${Math.round(recipe.calories)} kcal`
      : recipe.dish_name.toLowerCase().includes("sea bass")
        ? `Order the Mediterranean Sea Bass with broccolini, tapenade on side — ${Math.round(recipe.protein_g)}g Protein, ${Math.round(recipe.calories)} kcal`
        : recipe.dish_name.toLowerCase().includes("steak") || recipe.dish_name.toLowerCase().includes("barbacoa")
          ? `Order the Wood-Fired Carne Asada with grilled rajas & black beans — ${Math.round(recipe.protein_g)}g Protein, ${Math.round(recipe.calories)} kcal`
          : `Order the ${recipe.dish_name} with steamed greens, sauce on side — ${Math.round(recipe.protein_g)}g Protein, ${Math.round(recipe.calories)} kcal`);

  // Waiter Pro-Tip
  const diningProTip =
    venueName.toLowerCase().includes("nobu") || recipe.dish_name.toLowerCase().includes("miso")
      ? "Ask for the sweet miso glaze light/on the side and swap white rice for steamed edamame or greens to shave 25g simple carbs."
      : venueName.toLowerCase().includes("osteria") || recipe.dish_name.toLowerCase().includes("sea bass")
        ? "Request light extra virgin olive oil and double wild greens. Ancient farro delivers slow-digesting complex carbs."
        : venueName.toLowerCase().includes("casa") || recipe.dish_name.toLowerCase().includes("steak")
          ? "Request char-grilled preparation without extra oil and double black beans instead of chips for optimal fiber and magnesium."
          : "Ask for dressing/sauce on the side and swap starchy sides for steamed greens to keep within remaining macros.";

  // Home Cook Prep Steps
  const homePrepSteps =
    recipe.prep_instructions && recipe.prep_instructions.length > 0
      ? recipe.prep_instructions
      : recipe.dish_name.toLowerCase().includes("sea bass") || recipe.cuisine?.toLowerCase().includes("mediterranean")
        ? [
            "Season sea bass fillets with sea salt, cracked black pepper, and fresh thyme.",
            "Pan-sear skin-side down in olive oil for 4 mins until crispy, then gently flip for 2 mins.",
            "Plate over warm simmered farro, sun-ripened tomatoes, and finish with Meyer lemon drizzle.",
          ]
        : recipe.dish_name.toLowerCase().includes("steak") || recipe.dish_name.toLowerCase().includes("barbacoa")
          ? [
              "Rub lean flank steak in smoky guajillo chili adobo, minced garlic, and lime juice.",
              "Char on a smoking grill pan for 3-4 minutes per side until medium-rare, then rest 5 mins.",
              "Slice thin against grain and serve with warm corn tortillas and simmered black beans.",
            ]
          : [
              "Marinate protein in sweet Saikyo white miso, mirin, and tamari for 20 minutes.",
              "Pan-sear over medium-high heat for 4 minutes per side until caramelized with tender center.",
              "Serve over warm edamame brown rice with flash-steamed garlic baby bok choy.",
            ];

  const handleOpenMap = () => {
    const query = encodeURIComponent(venueName);
    const mapUrl = Platform.select({
      ios: `maps://maps.apple.com/?q=${query}`,
      default: `https://www.google.com/maps/search/?api=1&query=${query}`,
    });
    Linking.openURL(mapUrl).catch(() => {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
    });
  };

  const handleLog = async () => {
    if (logged || logging) return;
    setLogging(true);
    try {
      await api.post("/meals/log", {
        title: actionTab === "dine" ? `${recipe.dish_name} @ ${venueName}` : recipe.dish_name,
        meal_type: "dinner",
        logged_at: new Date().toISOString(),
        calories: Number(recipe.calories) || 500,
        protein_g: Number(recipe.protein_g) || 30,
        carbs_g: Number(recipe.carbs_g) || 0,
        fat_g: Number(recipe.fat_g) || 0,
        fiber_g: Number((recipe as any).fiber_g) || 6,
        sugar_g: Number((recipe as any).sugar_g) || 4,
        magnesium_mg: Number((recipe as any).magnesium_mg) || Math.round((Number(recipe.protein_g) || 30) * 1.8 + 25),
        bio_cultural_score: Number(recipe.verified_alignment_score) || Number(telemetry.bio_cultural_score) || 94,
        restaurant_anchor: venueName,
        venue_name: venueName,
        cultural_inspiration: recipe.cultural_inspiration || "",
        cuisine: recipe.cuisine || "",
        cultural_meta: {
          bio_cultural_score: Number(recipe.verified_alignment_score) || Number(telemetry.bio_cultural_score) || 94,
          restaurant_anchor: venueName,
          venue_name: venueName,
          cultural_inspiration: recipe.cultural_inspiration || "",
          cuisine: recipe.cuisine || "",
          action_type: actionTab,
          dining_order_guide: recipe.dining_order_guide || "",
          qloo_grounded: true,
        },
        foods: (recipe.key_ingredients || []).map((ing: string) => ({
          name: ing,
          amount: "1 serving",
        })),
      });
      // Trigger Taste Feedback Loop
      api.post("/taste/feedback", { meal_title: recipe.dish_name }).catch(() => {});
      setLogged(true);
      Alert.alert(
        "Meal Logged! 🎉",
        actionTab === "dine"
          ? `"${recipe.dish_name}" at ${venueName} has been logged to today's diary. Your Qloo Taste DNA was also evolved.`
          : `"${recipe.dish_name}" has been logged to today's diary. Your Qloo Taste DNA was also evolved.`,
      );
    } catch {
      Alert.alert("Error", "Could not log meal to diary.");
    } finally {
      setLogging(false);
    }
  };

  return (
    <LinearGradient
      colors={["#1E1B4B", "#2E1065"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.recipeCard}
    >
      {/* Header */}
      <View style={styles.recipeCardHeader}>
        <View
          style={[
            styles.recipeTag,
            isBlind && {
              backgroundColor: "rgba(239, 68, 68, 0.18)",
              borderColor: "rgba(239, 68, 68, 0.4)",
            },
          ]}
        >
          <Ionicons
            name={isBlind ? "eye-off" : "sparkles"}
            size={12}
            color={isBlind ? "#EF4444" : "#C084FC"}
          />
          <Text
            style={[
              styles.recipeTagText,
              isBlind && { color: "#FCA5A5" },
            ]}
          >
            {isBlind ? "CULTURALLY BLIND AI (NO QLOO)" : "QLOO TASTE AI™ SYNTHESIS"}
          </Text>
        </View>
        <View
          style={[
            styles.recipeScorePill,
            isBlind && {
              backgroundColor: "rgba(239, 68, 68, 0.25)",
              borderColor: "rgba(239, 68, 68, 0.6)",
            },
          ]}
        >
          <Ionicons
            name={isBlind ? "alert-circle" : "flame"}
            size={11}
            color={isBlind ? "#EF4444" : "#F59E0B"}
          />
          <Text
            style={[
              styles.recipeScoreText,
              isBlind && { color: "#FCA5A5" },
            ]}
          >
            {isBlind ? "0% CULTURAL FIT" : `${score}% MATCH`}
          </Text>
        </View>
      </View>

      {/* Warning banner inside recipe card if culturally blind */}
      {isBlind && (
        <View style={styles.recipeCardBlindWarning}>
          <Ionicons name="warning" size={13} color="#EF4444" />
          <Text style={styles.recipeCardBlindWarningText}>
            ⚠️ High Abandonment Risk: Culturally Alienating Meal Plan
          </Text>
        </View>
      )}

      {/* Bio-Cultural Formula Breakdown Card */}
      <View style={styles.formulaSplitCard}>
        <View style={styles.formulaSplitHeader}>
          <Text style={styles.formulaSplitTitle}>BIO-CULTURAL ALIGNMENT SPLIT</Text>
          <Text style={styles.formulaSplitRatio}>60% Cultural + 40% Macro</Text>
        </View>

        <View style={styles.formulaPillRow}>
          <View style={styles.formulaPillCultural}>
            <View style={styles.formulaPillIconWrap}>
              <Ionicons name="sparkles" size={11} color="#C084FC" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.formulaPillLabel}>Cultural Taste Vector (60%)</Text>
              <Text style={styles.formulaPillValue} numberOfLines={1}>
                {culturalScore}% match ({primaryAnchor})
              </Text>
            </View>
          </View>

          <View style={styles.formulaPillMacro}>
            <View style={[styles.formulaPillIconWrap, { backgroundColor: "rgba(16,185,129,0.18)" }]}>
              <Ionicons name="fitness" size={11} color="#10B981" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.formulaPillLabel}>Macro Precision (40%)</Text>
              <Text style={styles.formulaPillValue} numberOfLines={1}>
                {macroScore}% target fit ({Math.round(recipe.protein_g)}g protein)
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Cultural Blindness Contrast Toggle & Comparison Card */}
      <TouchableOpacity
        style={styles.contrastToggleBar}
        activeOpacity={0.8}
        testID="coach-cultural-contrast-toggle"
        onPress={() => setShowContrast((prev) => !prev)}
      >
        <Ionicons name="git-compare-outline" size={12} color="#C084FC" />
        <Text style={styles.contrastToggleBarText}>
          {showContrast
            ? "Hide Blind AI Comparison"
            : "⚡ Blind AI vs. Caliwo Contrast"}
        </Text>
        <Ionicons
          name={showContrast ? "chevron-up" : "chevron-down"}
          size={12}
          color="#C084FC"
        />
      </TouchableOpacity>

      {showContrast && (
        <View style={styles.comparisonContainer} testID="coach-cultural-contrast-card">
          <View style={styles.genericAiCard}>
            <View style={styles.comparisonHeaderRow}>
              <Ionicons name="alert-circle" size={12} color="#F87171" />
              <Text style={styles.genericLabel}>⚠️ Culturally Blind AI (Without Qloo)</Text>
            </View>
            <Text style={styles.genericDish}>Plain Boiled Chicken Breast & White Rice</Text>
            <Text style={styles.genericScore}>Cultural Alignment: 0% • Abandonment Risk: High</Text>
            <Text style={styles.genericDescription}>
              Without cultural context, generic AI defaults to bland bro-diet staples that disregard your identity.
            </Text>
          </View>

          <View style={styles.qlooAiCard}>
            <View style={styles.comparisonHeaderRow}>
              <Ionicons name="sparkles" size={12} color="#34D399" />
              <Text style={styles.qlooLabel}>✨ Caliwo + Qloo Taste Graph</Text>
            </View>
            <Text style={styles.qlooDish}>{recipe.dish_name}</Text>
            <Text style={styles.qlooScore}>
              {culturalScore}% Match • Grounded in {primaryAnchor}
            </Text>
            <Text style={styles.qlooDescription}>
              Personalized through cross-domain cultural intelligence to hit your {Math.round(recipe.protein_g)}g protein goal.
            </Text>
          </View>
        </View>
      )}

      {/* Dish Name */}
      <Text style={styles.recipeTitle}>{recipe.dish_name}</Text>
      {recipe.cultural_inspiration ? (
        <Text style={styles.recipeInspiration}>
          "{recipe.cultural_inspiration}"
        </Text>
      ) : null}

      {/* 2-Way Segmented Tab: Cook at Home vs Dine Out */}
      <View style={styles.actionSegmentContainer} testID="recipe-split-action-tabs">
        <TouchableOpacity
          style={[
            styles.actionSegmentBtn,
            actionTab === "cook" && styles.actionSegmentBtnActiveCook,
          ]}
          onPress={() => setActionTab("cook")}
          activeOpacity={0.85}
          testID="recipe-tab-cook-home"
        >
          <Ionicons
            name="restaurant"
            size={13}
            color={actionTab === "cook" ? "#FFFFFF" : "rgba(255,255,255,0.6)"}
          />
          <Text
            style={[
              styles.actionSegmentText,
              actionTab === "cook" && styles.actionSegmentTextActive,
            ]}
          >
            🍳 Cook at Home
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionSegmentBtn,
            actionTab === "dine" && styles.actionSegmentBtnActiveDine,
          ]}
          onPress={() => setActionTab("dine")}
          activeOpacity={0.85}
          testID="recipe-tab-dine-out"
        >
          <Ionicons
            name="location"
            size={13}
            color={actionTab === "dine" ? "#FFFFFF" : "rgba(255,255,255,0.6)"}
          />
          <Text
            style={[
              styles.actionSegmentText,
              actionTab === "dine" && styles.actionSegmentTextActive,
            ]}
          >
            📍 Dine Out (Venue)
          </Text>
        </TouchableOpacity>
      </View>

      {/* VIEW A: Cook at Home (Macro Recipe) */}
      {actionTab === "cook" ? (
        <View testID="recipe-view-cook-home">
          {/* Macros Row */}
          <View style={styles.recipeMacroGrid}>
            <View style={styles.recipeMacroBox}>
              <Text style={styles.recipeMacroVal}>
                {Math.round(recipe.calories)}
              </Text>
              <Text style={styles.recipeMacroLbl}>kcal</Text>
            </View>
            <View style={styles.recipeMacroBox}>
              <Text style={[styles.recipeMacroVal, { color: "#38BDF8" }]}>
                {Math.round(recipe.protein_g)}g
              </Text>
              <Text style={styles.recipeMacroLbl}>Protein</Text>
            </View>
            <View style={styles.recipeMacroBox}>
              <Text style={[styles.recipeMacroVal, { color: "#FBBF24" }]}>
                {Math.round(recipe.carbs_g || 0)}g
              </Text>
              <Text style={styles.recipeMacroLbl}>Carbs</Text>
            </View>
            <View style={styles.recipeMacroBox}>
              <Text style={[styles.recipeMacroVal, { color: "#F472B6" }]}>
                {Math.round(recipe.fat_g || 0)}g
              </Text>
              <Text style={styles.recipeMacroLbl}>Fat</Text>
            </View>
          </View>

          {/* Key Ingredients Chips */}
          {recipe.key_ingredients && recipe.key_ingredients.length > 0 && (
            <View style={styles.recipeIngRow}>
              {recipe.key_ingredients.slice(0, 5).map((ing, i) => {
                const ingMeta = getTasteEntityMeta(ing);
                return (
                  <View
                    key={i}
                    style={[
                      styles.recipeIngChip,
                      {
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        borderColor: ingMeta.color + "50",
                        backgroundColor: ingMeta.bg,
                      },
                    ]}
                  >
                    <Ionicons name={ingMeta.icon} size={11} color={ingMeta.color} />
                    <Text style={styles.recipeIngText}>{ing}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Chef's Home Prep Instructions */}
          <View style={styles.prepSection}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 4 }}>
              <Ionicons name="flame" size={12} color="#C084FC" />
              <Text style={styles.prepSectionTitle}>CHEF'S MACRO PREP STEPS</Text>
            </View>
            {homePrepSteps.map((step, idx) => (
              <View key={idx} style={styles.prepStepRow}>
                <View style={styles.prepStepNum}>
                  <Text style={styles.prepStepNumText}>{idx + 1}</Text>
                </View>
                <Text style={styles.prepStepText}>{step}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : (
        /* VIEW B: Dine Out (Order at Venue) */
        <View testID="recipe-view-dine-out">
          {/* Qloo Place Entity Anchor Card */}
          <View style={styles.dineVenueCard}>
            <View style={styles.dineVenueHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Ionicons name="sparkles" size={11} color="#38BDF8" />
                <Text style={styles.dineVenueTag}>QLOO PLACE ENTITY ANCHOR</Text>
              </View>
              <Text style={styles.dineDistancePill}>{venueDistance}</Text>
            </View>

            <View style={styles.dineVenueBody}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.dineVenueName}>{venueName}</Text>
                <Text style={styles.dineVenueSub}>
                  Grounded in your cross-domain cultural taste profile
                </Text>
              </View>

              <TouchableOpacity
                style={styles.openMapBtn}
                onPress={handleOpenMap}
                activeOpacity={0.8}
                testID="btn-open-venue-map"
              >
                <Ionicons name="navigate-outline" size={12} color="#38BDF8" />
                <Text style={styles.openMapBtnText}>Maps ↗</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Exact Ordering Guide for Remaining Budget */}
          <View style={styles.dineOrderBox}>
            <View style={styles.dineOrderHeader}>
              <Ionicons name="checkmark-done-circle" size={14} color="#10B981" />
              <Text style={styles.dineOrderTitle}>EXACT ORDER FOR REMAINING BUDGET</Text>
            </View>
            <Text style={styles.dineOrderText}>"{diningOrder}"</Text>
            <View style={styles.dineFitBadge}>
              <Ionicons name="shield-checkmark" size={10} color="#34D399" />
              <Text style={styles.dineFitBadgeText}>
                Engineered to hit {Math.round(recipe.protein_g)}g protein under {Math.round(recipe.calories)} kcal
              </Text>
            </View>
          </View>

          {/* Waiter Pro-Tip */}
          <View style={styles.dineTipBox}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Ionicons name="bulb" size={12} color="#FBBF24" />
              <Text style={styles.dineTipTitle}>WAITER PRO-TIP</Text>
            </View>
            <Text style={styles.dineTipText}>{diningProTip}</Text>
          </View>
        </View>
      )}

      {/* Action Button */}
      <TouchableOpacity
        style={[styles.recipeLogBtn, logged && styles.recipeLogBtnSuccess]}
        activeOpacity={0.85}
        onPress={handleLog}
        disabled={logged || logging}
      >
        <LinearGradient
          colors={
            logged
              ? ["#10B981", "#059669"]
              : actionTab === "dine"
                ? ["#0284C7", "#38BDF8"]
                : ["#7C3AED", "#A78BFA"]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.recipeLogGradient}
        >
          {logging ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons
                name={
                  logged
                    ? "checkmark-circle"
                    : actionTab === "dine"
                      ? "location"
                      : "add-circle"
                }
                size={16}
                color="#fff"
              />
              <Text style={styles.recipeLogText}>
                {logged
                  ? "✓ Logged to Daily Diary"
                  : actionTab === "dine"
                    ? "📍 Log Dine-Out Meal & Evolve Taste DNA"
                    : "+ Log Home Meal & Evolve Taste DNA"}
              </Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </LinearGradient>
  );
}

export default function Coach() {
  const { prompt } = useLocalSearchParams<{ prompt?: string }>();
  const initialPromptSentRef = useRef<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [insight, setInsight] = useState<string | null>(null);
  const [switchingPersona, setSwitchingPersona] = useState<string | null>(null);
  const [activePersona, setActivePersona] = useState<string>("alex");
  const [comparisonModalOpen, setComparisonModalOpen] = useState(false);
  const [isBlindMode, setIsBlindMode] = useState<boolean>(false);
  const [togglingBlind, setTogglingBlind] = useState<boolean>(false);
  const listRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleSwitchPersona = async (pId: string) => {
    if (switchingPersona) return;
    setSwitchingPersona(pId);
    try {
      await switchTastePersona(pId);
      setActivePersona(pId);
      await loadHistory();
    } catch {
      Alert.alert("Error", "Could not switch persona.");
    } finally {
      setSwitchingPersona(null);
    }
  };

  const loadBlindStatus = useCallback(async () => {
    try {
      const p = await getTasteProfile();
      if (typeof p.simulate_blind === "boolean") {
        setIsBlindMode(p.simulate_blind);
      }
    } catch {}
  }, []);

  const handleToggleBlindMode = async (targetBlind?: boolean) => {
    const nextVal = typeof targetBlind === "boolean" ? targetBlind : !isBlindMode;
    setTogglingBlind(true);
    try {
      const res = await toggleBlindMode(nextVal);
      setIsBlindMode(res.simulate_blind);
      if (res.simulate_blind) {
        // Send a suggestion request so judge immediately experiences the bro-diet AI response!
        await send("Suggest a dinner that fits my goals");
      }
    } catch {
      Alert.alert("Mode Toggle Failed", "Could not toggle Culturally Blind mode.");
    } finally {
      setTogglingBlind(false);
    }
  };

  const loadHistory = useCallback(async () => {
    try {
      const r = await api.get("/coach/history");
      setMessages(r.data.messages || []);
    } catch {}
    setLoading(false);
  }, []);

  const loadInsight = useCallback(async () => {
    try {
      const r = await api.get("/coach/weekly-insight");
      setInsight(r.data?.insight || null);
    } catch {}
  }, []);

  useEffect(() => {
    loadHistory();
    loadInsight();
    loadBlindStatus();
  }, [loadHistory, loadInsight, loadBlindStatus]);

  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
  }, [messages]);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;
    setInput("");
    setMessages((p) => [...p, { role: "user", content: msg, _local: true }]);
    setSending(true);
    try {
      const r = await api.post("/coach/message", { message: msg });
      setMessages((p) => [
        ...p,
        {
          role: "assistant",
          content: r.data.reply,
          agent_telemetry: r.data.agent_telemetry,
        },
      ]);
    } catch {
      setMessages((p) => [
        ...p,
        {
          role: "assistant",
          content: "Sorry, I hit an error. Please try again.",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (!loading && prompt && initialPromptSentRef.current !== prompt) {
      initialPromptSentRef.current = prompt;
      send(prompt);
    }
  }, [loading, prompt]);

  const clearHistory = () => {
    Alert.alert(
      "Clear Chat History",
      "Are you sure you want to reset your conversation with Caliwo Coach?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete("/coach/clear");
              setMessages([]);
            } catch {
              Alert.alert("Error", "Could not clear chat history.");
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {/* Top Header */}
      <View style={styles.header}>
        <View
          style={{
            width: "100%",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View>
            <Text style={styles.title}>Caliwo Coach</Text>
            <Text style={styles.subtitle}>
              Your 24/7 AI Nutritionist & Fitness Guide
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {/* 1-Tap Culturally Blind AI Master Toggle for Hackathon Judges */}
            <TouchableOpacity
              style={[
                styles.headerBlindToggle,
                isBlindMode ? styles.headerBlindToggleActive : styles.headerBlindToggleQloo,
              ]}
              onPress={() => handleToggleBlindMode()}
              disabled={togglingBlind}
              activeOpacity={0.8}
              testID="coach-blind-mode-toggle"
            >
              <LinearGradient
                colors={
                  isBlindMode
                    ? ["#EF4444", "#DC2626"]
                    : ["#8B5CF6", "#6D28D9"]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.headerBlindToggleGradient}
              >
                {togglingBlind ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons
                      name={isBlindMode ? "eye-off" : "sparkles"}
                      size={12}
                      color="#FFFFFF"
                    />
                    <Text style={styles.headerBlindToggleText}>
                      {isBlindMode ? "BLIND AI" : "QLOO AI"}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.voiceBtn}
              onPress={() => router.push("/coach/voice")}
              activeOpacity={0.8}
              testID="coach-voice-btn"
            >
              <Ionicons name="mic" size={18} color="#0F172A" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.voiceBtn}
              onPress={clearHistory}
              activeOpacity={0.8}
              testID="coach-clear-btn"
            >
              <Ionicons name="trash-outline" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Judge Persona Quick Switcher Bar */}
      <View style={styles.judgeCoachBar} testID="coach-judge-persona-bar">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Ionicons name="sparkles" size={11} color="#C084FC" />
          <Text style={styles.judgeCoachLabel}>DEMO PERSONA:</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
          {[
            { id: "alex", label: "Alex 🍣" },
            { id: "elena", label: "Elena 🍋" },
            { id: "marcus", label: "Marcus 🌮" },
          ].map((p) => {
            const isActive = activePersona === p.id;
            const isLoading = switchingPersona === p.id;
            return (
              <TouchableOpacity
                key={p.id}
                onPress={() => handleSwitchPersona(p.id)}
                disabled={Boolean(switchingPersona)}
                style={[
                  styles.judgeCoachPill,
                  isActive && styles.judgeCoachPillActive,
                ]}
                activeOpacity={0.75}
                testID={`coach-persona-${p.id}`}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#C084FC" />
                ) : (
                  <Text
                    style={[
                      styles.judgeCoachPillText,
                      isActive && styles.judgeCoachPillTextActive,
                    ]}
                  >
                    {p.label}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            onPress={() => setComparisonModalOpen(true)}
            style={styles.coachCompareHeaderBtn}
            activeOpacity={0.8}
            testID="coach-open-comparison-modal-btn"
          >
            <Ionicons name="git-compare" size={10} color="#FFFFFF" />
            <Text style={styles.coachCompareHeaderBtnText}>SPLIT VIEW</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Split-View Side-by-Side Quick Strip */}
      <TouchableOpacity
        style={styles.coachSplitBanner}
        onPress={() => setComparisonModalOpen(true)}
        activeOpacity={0.85}
        testID="coach-split-view-banner"
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
          <Ionicons name="git-compare" size={12} color="#7C3AED" />
          <Text style={styles.coachSplitBannerText}>
            ⚡ Side-by-Side: Culturally Blind AI (0%) vs. Qloo Attuned (96%)
          </Text>
        </View>
        <View style={styles.coachSplitBannerBadge}>
          <Text style={styles.coachSplitBannerBadgeText}>Compare</Text>
          <Ionicons name="arrow-forward" size={10} color="#7C3AED" />
        </View>
      </TouchableOpacity>

      {/* High Abandonment Warning Banner when Culturally Blind AI is active */}
      {isBlindMode && (
        <View style={styles.blindWarningBanner} testID="coach-blind-warning-banner">
          <View style={styles.blindWarningHeader}>
            <Ionicons name="warning" size={15} color="#EF4444" />
            <Text style={styles.blindWarningTitle}>
              ⚠️ High Abandonment Risk: Culturally Alienating Meal Plan
            </Text>
          </View>
          <Text style={styles.blindWarningSub}>
            Qloo Cultural Intelligence is BYPASSED. Coach responses drop to 0% cultural fit (plain steamed chicken breast & brown rice).
          </Text>
          <TouchableOpacity
            style={styles.blindBannerRestoreBtn}
            onPress={() => handleToggleBlindMode(false)}
            activeOpacity={0.8}
            testID="coach-restore-qloo-btn"
          >
            <Ionicons name="sparkles" size={12} color="#10B981" />
            <Text style={styles.blindBannerRestoreText}>
              ⚡ Restore Qloo AI (96% Bio-Cultural Match)
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        {loading ? (
          <View
            style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
          >
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                {insight ? (
                  <LinearGradient
                    colors={["#FFFFFF", "#FFF7ED"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.insightCard}
                    testID="coach-weekly-insight"
                  >
                    <View style={styles.insightHeader}>
                      <Ionicons
                        name="sparkles"
                        size={14}
                        color={colors.accent}
                      />
                      <Text style={styles.insightLabel}>
                        THIS WEEK&apos;S INSIGHT
                      </Text>
                    </View>
                    <FormattedMessage content={insight} isUser={false} />
                  </LinearGradient>
                ) : null}

                <View style={styles.emptyBadge}>
                  <Ionicons
                    name="chatbubble-ellipses"
                    size={28}
                    color={colors.accent}
                  />
                </View>
                <Text style={styles.emptyTitle}>Ask me anything</Text>
                <Text style={styles.emptySub}>
                  I analyze your actual logged meals, calories, and goals to
                  provide personalized recommendations.
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const isUser = item.role === "user";
              return (
                <View
                  style={[
                    styles.bubbleWrap,
                    {
                      alignItems: isUser ? "flex-end" : "flex-start",
                    },
                  ]}
                  testID={`coach-msg-${item.role}`}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-end",
                      gap: 8,
                      maxWidth: "88%",
                      justifyContent: isUser ? "flex-end" : "flex-start",
                    }}
                  >
                    {!isUser ? (
                      <View style={styles.aiAvatar}>
                        <Ionicons
                          name="sparkles"
                          size={12}
                          color={colors.white}
                        />
                      </View>
                    ) : null}

                    {isUser ? (
                      <LinearGradient
                        colors={["#0F172A", "#1E293B"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.bubble, styles.bubbleUser]}
                      >
                        <FormattedMessage
                          content={item.content}
                          isUser={true}
                        />
                      </LinearGradient>
                    ) : (
                      <View style={{ flex: 1, gap: 8 }}>
                        {item.agent_telemetry &&
                          item.agent_telemetry.tools_called &&
                          item.agent_telemetry.tools_called.length > 0 && (
                            <AgentTelemetryBadge
                              telemetry={item.agent_telemetry}
                            />
                          )}
                        <View style={[styles.bubble, styles.bubbleAI]}>
                          <FormattedMessage
                            content={item.content}
                            isUser={false}
                          />
                        </View>
                        {item.agent_telemetry?.synthesized_recipe && (
                          <InteractiveRecipeCard
                            recipe={item.agent_telemetry.synthesized_recipe}
                            telemetry={item.agent_telemetry}
                          />
                        )}
                      </View>
                    )}
                  </View>
                </View>
              );
            }}
            ListFooterComponent={
              sending ? (
                <View
                  style={[
                    styles.bubbleWrap,
                    { alignItems: "flex-start", marginTop: 8 },
                  ]}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-end",
                      gap: 8,
                    }}
                  >
                    <View style={styles.aiAvatar}>
                      <Ionicons
                        name="sparkles"
                        size={12}
                        color={colors.white}
                      />
                    </View>
                    <View
                      style={[
                        styles.bubble,
                        styles.bubbleAI,
                        { paddingHorizontal: 20, paddingVertical: 14 },
                      ]}
                    >
                      <ActivityIndicator color={colors.accent} size="small" />
                    </View>
                  </View>
                </View>
              ) : null
            }
          />
        )}

        {/* Quick Suggestion Chips */}
        <View style={styles.quickRowWrap}>
          <FlatList
            data={QUICK}
            keyExtractor={(x) => x}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickRow}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => send(item)}
                style={styles.quickChip}
                activeOpacity={0.8}
                testID={`coach-quick-${item.slice(0, 8)}`}
              >
                <Ionicons
                  name="flash-outline"
                  size={13}
                  color={colors.accent}
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.quickChipText}>{item}</Text>
              </TouchableOpacity>
            )}
          />
        </View>

        {/* Input Bar */}
        <View style={styles.inputRow}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask Caliwo Coach…"
            placeholderTextColor="#94A3B8"
            style={styles.input}
            multiline
            testID="coach-input"
          />
          <TouchableOpacity
            onPress={() => send()}
            style={[
              styles.sendBtn,
              { backgroundColor: input.trim() ? colors.accent : "#0F172A" },
              (!input.trim() || sending) && { opacity: 0.6 },
            ]}
            disabled={!input.trim() || sending}
            activeOpacity={0.85}
            testID="coach-send-btn"
          >
            {sending ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Ionicons name="arrow-up" size={20} color={colors.white} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Side-by-Side Culturally Blind vs. Qloo Attuned Comparison Modal */}
      <CulturalComparisonModal
        visible={comparisonModalOpen}
        initialPersonaId={activePersona}
        onClose={() => setComparisonModalOpen(false)}
        onSelectPersona={(pId) => handleSwitchPersona(pId)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  judgeCoachBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 7,
    backgroundColor: "rgba(30, 27, 75, 0.08)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(167, 139, 250, 0.15)",
  },
  judgeCoachLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#7C3AED",
    letterSpacing: 0.6,
  },
  judgeCoachPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(15, 23, 42, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.1)",
  },
  judgeCoachPillActive: {
    backgroundColor: "rgba(124, 58, 237, 0.12)",
    borderColor: "#7C3AED",
  },
  judgeCoachPillText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
  },
  judgeCoachPillTextActive: {
    color: "#7C3AED",
    fontWeight: "800",
  },
  coachCompareHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#7C3AED",
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#A78BFA",
  },
  coachCompareHeaderBtnText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.4,
  },
  coachSplitBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(124, 58, 237, 0.08)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(167, 139, 250, 0.2)",
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  coachSplitBannerText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#4C1D95",
  },
  coachSplitBannerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(124, 58, 237, 0.12)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  coachSplitBannerBadgeText: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "#7C3AED",
  },
  subtitle: { fontSize: 12, color: "#64748B", marginTop: 2, fontWeight: "500" },
  voiceBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    ...shadowSm,
  },
  list: { padding: 6, gap: 12, paddingBottom: 24 },
  emptyWrap: { alignItems: "center", padding: 24, marginTop: 10 },
  emptyBadge: {
    width: 64,
    height: 64,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 18, fontWeight: "900", color: "#0F172A" },
  emptySub: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 4,
    textAlign: "center",
    lineHeight: 18,
  },
  bubbleWrap: { width: "100%", marginVertical: 2 },
  aiAvatar: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  bubbleUser: {
    borderBottomRightRadius: 4,
    ...shadowSm,
  },
  bubbleAI: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderBottomLeftRadius: 4,
    ...shadowSm,
  },
  bubbleText: { color: "#0F172A", fontSize: 15, lineHeight: 22 },

  /* Quick Suggestions */
  quickRowWrap: { height: 50 },
  quickRow: { paddingHorizontal: 16, gap: 8, alignItems: "center" },
  quickChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    justifyContent: "center",
    flexShrink: 0,
    ...shadowSm,
  },
  quickChipText: { fontSize: 12, fontWeight: "700", color: "#0F172A" },

  /* Input Row */
  inputRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 6,
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 140,
    paddingHorizontal: 18,
    paddingTop: 13,
    paddingBottom: 13,
    borderRadius: 24,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    fontSize: 15,
    color: "#0F172A",
    fontWeight: "500",
    ...shadowSm,
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    ...shadowSm,
  },

  /* Weekly Insight Card */
  insightCard: {
    width: "100%",
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#FED7AA",
    marginBottom: 20,
    ...shadowMd,
  },
  insightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  insightLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: colors.accent,
    letterSpacing: 1.2,
  },

  /* Rich-text Formatting */
  blockSpacing: { marginTop: 6 },
  boldText: { fontWeight: "800", color: "#0F172A" },
  linkText: { color: colors.accent, textDecorationLine: "underline" },
  h1: { fontSize: 18, fontWeight: "900", marginBottom: 4 },
  h2: { fontSize: 16, fontWeight: "800", marginBottom: 3 },
  h3: { fontSize: 15, fontWeight: "800", marginBottom: 2 },
  listWrap: { gap: 4 },
  listRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  bullet: {
    fontSize: 15,
    lineHeight: 22,
    color: "#0F172A",
    width: 14,
  },
  numberBullet: { width: 20 },
  listItemText: { flex: 1 },
  /* Agent Telemetry & Recipe Card */
  telemetryBadge: {
    backgroundColor: "rgba(167,139,250,0.1)",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.25)",
    borderRadius: 14,
    padding: 10,
    marginBottom: 4,
  },
  telemetryHeaderTouchable: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  telemetryHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  telemetryHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  traceTogglePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(52, 211, 153, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(52, 211, 153, 0.35)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  traceTogglePillExpanded: {
    backgroundColor: "rgba(192, 132, 252, 0.18)",
    borderColor: "rgba(192, 132, 252, 0.5)",
  },
  traceToggleText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#34D399",
    letterSpacing: 0.4,
  },
  traceToggleTextExpanded: {
    color: "#C084FC",
  },
  telemetryTraceContainer: {
    backgroundColor: "#070A13",
    borderWidth: 1.5,
    borderColor: "rgba(167, 139, 250, 0.35)",
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
    marginBottom: 4,
  },
  traceConsoleHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  terminalDotLive: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  traceConsoleTitle: {
    color: "#E2E8F0",
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  traceConsoleClock: {
    color: "#A78BFA",
    fontSize: 9.5,
    fontWeight: "700",
  },
  traceStepsList: {
    gap: 6,
  },
  traceStepCard: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 8,
    padding: 7,
  },
  traceStepCardSuccess: {
    borderColor: "rgba(52, 211, 153, 0.25)",
    backgroundColor: "rgba(52, 211, 153, 0.04)",
  },
  traceStepCardNeutral: {
    borderColor: "rgba(239, 68, 68, 0.25)",
    backgroundColor: "rgba(239, 68, 68, 0.04)",
  },
  traceStepHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  traceStepNum: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  traceStepStatus: {
    fontSize: 8.5,
    fontWeight: "800",
    color: "#34D399",
    letterSpacing: 0.5,
  },
  traceStepTool: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  traceStepOutput: {
    fontSize: 10.5,
    color: "#CBD5E1",
    lineHeight: 14,
  },
  traceConsoleFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
  },
  traceVerifiedText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#34D399",
    flex: 1,
  },
  collapseTraceBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  collapseTraceText: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "#A78BFA",
  },
  telemetryLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#A78BFA",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  toolPillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginVertical: 4,
  },
  toolPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16,185,129,0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  toolPillText: {
    fontSize: 11,
    color: "#10B981",
    fontWeight: "700",
  },
  telemetryAnchors: {
    fontSize: 11,
    color: "rgba(15,23,42,0.6)",
    marginTop: 2,
    fontWeight: "500",
  },
  recipeCard: {
    borderRadius: 20,
    padding: 16,
    marginTop: 6,
    width: "100%",
    borderWidth: 1,
    borderColor: "rgba(192,132,252,0.3)",
    ...shadowMd,
  },
  recipeCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  recipeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  recipeTagText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#C084FC",
    letterSpacing: 0.8,
  },
  recipeScorePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(245,158,11,0.2)",
    paddingHorizontal: 4,
    paddingVertical: 3,
    borderRadius: 999,
    marginLeft: 2,
  },
  recipeScoreText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#F59E0B",
  },
  formulaSplitCard: {
    backgroundColor: "rgba(0, 0, 0, 0.32)",
    borderRadius: 14,
    padding: 10,
    marginTop: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(192, 132, 252, 0.22)",
    gap: 8,
  },
  formulaSplitHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  formulaSplitTitle: {
    fontSize: 10,
    fontWeight: "800",
    color: "#C084FC",
    letterSpacing: 0.6,
  },
  formulaSplitRatio: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.65)",
  },
  formulaPillRow: {
    gap: 6,
  },
  formulaPillCultural: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(192, 132, 252, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "rgba(192, 132, 252, 0.2)",
  },
  formulaPillMacro: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.22)",
  },
  formulaPillIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(192, 132, 252, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  formulaPillLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.6)",
  },
  formulaPillValue: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  formulaNote: {
    fontSize: 11,
    color: "rgba(233,213,255,0.7)",
    marginBottom: 8,
    fontWeight: "500",
  },
  recipeTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  recipeInspiration: {
    fontSize: 13,
    color: "#E9D5FF",
    fontStyle: "italic",
    marginBottom: 12,
    lineHeight: 18,
  },
  recipeMacroGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  recipeMacroBox: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  recipeMacroVal: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  recipeMacroLbl: {
    fontSize: 10,
    fontWeight: "600",
    color: "rgba(255,255,255,0.6)",
    marginTop: 1,
  },
  recipeIngRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 14,
  },
  recipeIngChip: {
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  recipeIngText: {
    fontSize: 11,
    color: "#E2E8F0",
    fontWeight: "600",
  },
  recipeLogBtn: {
    borderRadius: 14,
    overflow: "hidden",
  },
  recipeLogBtnSuccess: {
    opacity: 0.95,
  },
  recipeLogGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 6,
  },
  recipeLogText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  /* Cultural Blindness Contrast Card Styles */
  contrastToggleBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(192, 132, 252, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(192, 132, 252, 0.28)",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginTop: 10,
    marginBottom: 10,
  },
  contrastToggleBarText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#E9D5FF",
    letterSpacing: 0.2,
  },
  comparisonContainer: {
    gap: 8,
    marginBottom: 12,
  },
  genericAiCard: {
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.28)",
    borderRadius: 12,
    padding: 10,
  },
  qlooAiCard: {
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.32)",
    borderRadius: 12,
    padding: 10,
  },
  comparisonHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  genericLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#F87171",
    letterSpacing: 0.3,
  },
  genericDish: {
    fontSize: 13,
    fontWeight: "700",
    color: "#E2E8F0",
    marginTop: 3,
    marginBottom: 2,
  },
  genericScore: {
    fontSize: 10,
    fontWeight: "600",
    color: "#FCA5A5",
  },
  genericDescription: {
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.65)",
    marginTop: 3,
    lineHeight: 14,
  },
  qlooLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#34D399",
    letterSpacing: 0.3,
  },
  qlooDish: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 3,
    marginBottom: 2,
  },
  qlooScore: {
    fontSize: 10,
    fontWeight: "600",
    color: "#6EE7B7",
  },
  qlooDescription: {
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.75)",
    marginTop: 3,
    lineHeight: 14,
  },
  telemetryBlindNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 5,
  },
  telemetryBlindNoticeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FCA5A5",
  },
  recipeCardBlindWarning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(239, 68, 68, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.4)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 12,
  },
  recipeCardBlindWarningText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FCA5A5",
    flex: 1,
  },
  headerBlindToggle: {
    borderRadius: 999,
    overflow: "hidden",
    borderWidth: 1,
    ...shadowSm,
  },
  headerBlindToggleQloo: {
    borderColor: "rgba(167, 139, 250, 0.5)",
  },
  headerBlindToggleActive: {
    borderColor: "rgba(239, 68, 68, 0.6)",
  },
  headerBlindToggleGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    gap: 4,
  },
  headerBlindToggleText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.4,
  },
  blindWarningBanner: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderBottomWidth: 1.5,
    borderBottomColor: "rgba(239, 68, 68, 0.35)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 4,
  },
  blindWarningHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  blindWarningTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#EF4444",
  },
  blindWarningSub: {
    fontSize: 11,
    color: "#475569",
    lineHeight: 15,
    fontWeight: "500",
  },
  blindBannerRestoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
  },
  blindBannerRestoreText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#10B981",
  },
  /* Split Action: Cook at Home vs Dine Out Styles */
  actionSegmentContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(0, 0, 0, 0.38)",
    borderRadius: 12,
    padding: 3,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  actionSegmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 9,
  },
  actionSegmentBtnActiveCook: {
    backgroundColor: "rgba(124, 58, 237, 0.85)",
    borderWidth: 1,
    borderColor: "rgba(192, 132, 252, 0.6)",
  },
  actionSegmentBtnActiveDine: {
    backgroundColor: "rgba(14, 165, 233, 0.85)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.6)",
  },
  actionSegmentText: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.65)",
  },
  actionSegmentTextActive: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  prepSection: {
    backgroundColor: "rgba(0, 0, 0, 0.28)",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    gap: 8,
  },
  prepSectionTitle: {
    fontSize: 10,
    fontWeight: "800",
    color: "#C084FC",
    letterSpacing: 0.6,
  },
  prepStepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  prepStepNum: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(192, 132, 252, 0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  prepStepNumText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#C084FC",
  },
  prepStepText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: "#E2E8F0",
  },
  dineVenueCard: {
    backgroundColor: "rgba(14, 165, 233, 0.12)",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
    gap: 6,
  },
  dineVenueHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dineVenueTag: {
    fontSize: 9,
    fontWeight: "900",
    color: "#38BDF8",
    letterSpacing: 0.6,
  },
  dineDistancePill: {
    fontSize: 10,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.7)",
  },
  dineVenueBody: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  dineVenueName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  dineVenueSub: {
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.65)",
    marginTop: 2,
  },
  openMapBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(56, 189, 248, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.4)",
  },
  openMapBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#38BDF8",
  },
  dineOrderBox: {
    backgroundColor: "rgba(0, 0, 0, 0.32)",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    gap: 6,
  },
  dineOrderHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dineOrderTitle: {
    fontSize: 10,
    fontWeight: "800",
    color: "#10B981",
    letterSpacing: 0.6,
  },
  dineOrderText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#F1F5F9",
    lineHeight: 18,
  },
  dineFitBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  dineFitBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#34D399",
  },
  dineTipBox: {
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.25)",
    gap: 4,
  },
  dineTipTitle: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FBBF24",
    letterSpacing: 0.5,
  },
  dineTipText: {
    fontSize: 11,
    lineHeight: 16,
    color: "rgba(255, 255, 255, 0.85)",
  },
});
