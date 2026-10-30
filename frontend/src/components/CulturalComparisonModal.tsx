import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

export interface CulturalComparisonModalProps {
  visible: boolean;
  onClose: () => void;
  initialPersonaId?: string;
  onSelectPersona?: (personaId: string) => void;
}

type PersonaData = {
  id: string;
  name: string;
  avatar: string;
  tagline: string;
  score: string;
  dishName: string;
  magnesium: string;
  cals: string;
  protein: string;
  carbs: string;
  fat: string;
  culturalInspiration: string;
  film: string;
  music: string;
  travel: string;
  dining: string;
};

const PERSONAS: Record<string, PersonaData> = {
  alex: {
    id: "alex",
    name: "Alex",
    avatar: "🍣",
    tagline: "Tokyo Omakase & Cinema",
    score: "96% BIO-MATCH",
    dishName: "Saikyo Sweet Miso-Glazed Salmon & Forbidden Rice",
    magnesium: "✨ 95mg Bio-Magnesium (Target Hit)",
    cals: "540 kcal",
    protein: "42g",
    carbs: "44g",
    fat: "14g",
    culturalInspiration:
      "Bridging Tokyo craft dining, Jiro Dreams of Sushi aesthetic, and Chet Baker jazz vibes with restorative Saikyo sweet miso.",
    film: "Jiro Dreams of Sushi",
    music: "Chet Baker",
    travel: "Tokyo & Kyoto",
    dining: "Nobu NYC",
  },
  elena: {
    id: "elena",
    name: "Elena",
    avatar: "🍋",
    tagline: "Amalfi Coast & Minimalism",
    score: "95% BIO-MATCH",
    dishName: "Pan-Seared Sea Bass with Ancient Farro & Kalamata Olives",
    magnesium: "✨ 85mg Bio-Magnesium (Target Hit)",
    cals: "520 kcal",
    protein: "44g",
    carbs: "46g",
    fat: "15g",
    culturalInspiration:
      "Amalfi coastal dining aesthetic and Bill Evans acoustic jazz paired with ancient magnesium-dense farro and polyphenol-rich olives.",
    film: "Midnight in Paris",
    music: "Bill Evans",
    travel: "Amalfi Coast",
    dining: "Osteria Stellina",
  },
  marcus: {
    id: "marcus",
    name: "Marcus",
    avatar: "🌮",
    tagline: "Oaxacan Smoke & Strength",
    score: "94% BIO-MATCH",
    dishName: "Oaxacan Braised Guajillo Flank Steak & Charred Poblanos",
    magnesium: "✨ 110mg Bio-Magnesium (Target Hit)",
    cals: "620 kcal",
    protein: "52g",
    carbs: "48g",
    fat: "18g",
    culturalInspiration:
      "Oaxacan wood-fired heritage and Kendrick Lamar energy paired with iron-rich lean flank steak and slow-simmered black beans.",
    film: "Chef",
    music: "Kendrick Lamar",
    travel: "Oaxaca City",
    dining: "Casa Oaxaca",
  },
};

export default function CulturalComparisonModal({
  visible,
  onClose,
  initialPersonaId = "alex",
  onSelectPersona,
}: CulturalComparisonModalProps) {
  const [selectedPersona, setSelectedPersona] = useState<string>(
    initialPersonaId || "alex"
  );

  useEffect(() => {
    if (initialPersonaId && PERSONAS[initialPersonaId]) {
      setSelectedPersona(initialPersonaId);
    }
  }, [initialPersonaId]);

  const activePersona = PERSONAS[selectedPersona] || PERSONAS.alex;

  const handleSelectPersona = (pId: string) => {
    setSelectedPersona(pId);
    onSelectPersona?.(pId);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View
          testID="cultural-comparison-modal"
          style={styles.modalContainer}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <View style={styles.badgeWrap}>
                <Ionicons name="sparkles" size={14} color="#A78BFA" />
                <Text style={styles.badgeText}>QLOO THEMATIC PROOF</Text>
              </View>
              <Text style={styles.headerTitle}>Why Qloo Changes Everything</Text>
              <Text style={styles.headerSubtitle}>
                Side-by-side: Culturally Blind AI vs. Caliwo + Qloo Taste Graph
              </Text>
            </View>
            <TouchableOpacity
              testID="comparison-modal-close-btn"
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={22} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* Persona Switcher Bar */}
          <View style={styles.personaBar}>
            <Text style={styles.personaBarLabel}>Judge Test Persona:</Text>
            <View style={styles.personaPillsRow}>
              {(["alex", "elena", "marcus"] as const).map((pId) => {
                const p = PERSONAS[pId];
                const isActive = selectedPersona === pId;
                return (
                  <TouchableOpacity
                    key={pId}
                    testID={`comparison-persona-${pId}`}
                    onPress={() => handleSelectPersona(pId)}
                    style={[
                      styles.personaPill,
                      isActive && styles.personaPillActive,
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.personaAvatar}>{p.avatar}</Text>
                    <Text
                      style={[
                        styles.personaName,
                        isActive && styles.personaNameActive,
                      ]}
                    >
                      {p.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Side-by-side Columns */}
          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollInner}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.comparisonGrid}>
              {/* Column 1: Culturally Blind AI (WITHOUT QLOO) */}
              <View
                testID="comparison-blind-column"
                style={styles.columnBlind}
              >
                <View style={styles.columnTagBlind}>
                  <Ionicons name="eye-off-outline" size={13} color="#EF4444" />
                  <Text style={styles.columnTagBlindText}>
                    WITHOUT QLOO (GENERIC LLM)
                  </Text>
                </View>

                <View style={styles.fitScoreBlindBadge}>
                  <Text style={styles.fitScoreBlindText}>0% CULTURAL FIT</Text>
                </View>

                <View style={styles.riskBanner}>
                  <Ionicons name="warning-outline" size={14} color="#F87171" />
                  <Text style={styles.riskBannerText}>High Abandonment Risk</Text>
                </View>

                <Text style={styles.dishNameBlind}>
                  Boiled Chicken Breast, White Rice & Steamed Broccoli
                </Text>

                <View style={styles.macroPillRow}>
                  <Text style={styles.macroPillBlind}>480 kcal</Text>
                  <Text style={styles.macroPillBlind}>45g Protein</Text>
                  <Text style={styles.macroPillBlind}>52g Carbs</Text>
                  <Text style={styles.macroPillBlind}>6g Fat</Text>
                </View>

                <View style={styles.micronutrientRowBlind}>
                  <Text style={styles.micronutrientBlindText}>
                    ❌ 24mg Magnesium (Deficit)
                  </Text>
                </View>

                <View style={styles.quoteBoxBlind}>
                  <Text style={styles.quoteBoxBlindText}>
                    "Treats human beings like clinical spreadsheets. Completely
                    disregards cultural heritage, cinema, music, and dining
                    identity. Leads directly to 80% diet abandonment within 30
                    days."
                  </Text>
                </View>
              </View>

              {/* Column 2: Culturally Attuned AI (CALIWO + QLOO) */}
              <LinearGradient
                colors={["#1E1B4B", "#2E1065"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                testID="comparison-qloo-column"
                style={styles.columnQloo}
              >
                <View style={styles.columnTagQloo}>
                  <Ionicons name="sparkles" size={13} color="#C084FC" />
                  <Text style={styles.columnTagQlooText}>
                    CALIWO + QLOO TASTE GRAPH
                  </Text>
                </View>

                <View style={styles.fitScoreQlooBadge}>
                  <Text style={styles.fitScoreQlooText}>{activePersona.score}</Text>
                </View>

                <View style={styles.benefitBanner}>
                  <Ionicons name="checkmark-circle" size={14} color="#34D399" />
                  <Text style={styles.benefitBannerText}>
                    High Adherence: Bio-Cultural Harmony
                  </Text>
                </View>

                <Text style={styles.dishNameQloo}>{activePersona.dishName}</Text>

                <View style={styles.macroPillRow}>
                  <Text style={styles.macroPillQloo}>{activePersona.cals}</Text>
                  <Text style={styles.macroPillQloo}>
                    {activePersona.protein} Protein
                  </Text>
                  <Text style={styles.macroPillQloo}>
                    {activePersona.carbs} Carbs
                  </Text>
                  <Text style={styles.macroPillQloo}>{activePersona.fat} Fat</Text>
                </View>

                <View style={styles.micronutrientRowQloo}>
                  <Text style={styles.micronutrientQlooText}>
                    {activePersona.magnesium}
                  </Text>
                </View>

                <View style={styles.quoteBoxQloo}>
                  <Text style={styles.quoteBoxQlooText}>
                    "{activePersona.culturalInspiration}"
                  </Text>
                </View>

                {/* Cultural Latent Anchors */}
                <View style={styles.anchorsRow}>
                  <View style={styles.anchorBadge}>
                    <Ionicons name="film-outline" size={11} color="#DDD6FE" />
                    <Text style={styles.anchorBadgeText}>{activePersona.film}</Text>
                  </View>
                  <View style={styles.anchorBadge}>
                    <Ionicons name="musical-notes-outline" size={11} color="#DDD6FE" />
                    <Text style={styles.anchorBadgeText}>{activePersona.music}</Text>
                  </View>
                  <View style={styles.anchorBadge}>
                    <Ionicons name="location-outline" size={11} color="#DDD6FE" />
                    <Text style={styles.anchorBadgeText}>{activePersona.travel}</Text>
                  </View>
                  <View style={styles.anchorBadge}>
                    <Ionicons name="restaurant-outline" size={11} color="#DDD6FE" />
                    <Text style={styles.anchorBadgeText}>{activePersona.dining}</Text>
                  </View>
                </View>
              </LinearGradient>
            </View>

            {/* Explanatory Takeaway Card */}
            <View style={styles.takeawayCard}>
              <Ionicons name="bulb-outline" size={18} color="#F59E0B" />
              <Text style={styles.takeawayText}>
                <Text style={{ fontWeight: "700", color: "#FDE68A" }}>
                  The Hackathon Edge:{" "}
                </Text>
                Without Qloo's cultural taste graph, nutrition AI produces bland,
                culturally blind regimens. Caliwo harmonizes hard biometrics with
                living culture to make adherence effortless.
              </Text>
            </View>
          </ScrollView>

          {/* Footer Action */}
          <View style={styles.footer}>
            <TouchableOpacity
              testID="comparison-modal-done-btn"
              onPress={onClose}
              style={styles.doneBtn}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={["#7C3AED", "#4F46E5"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.doneBtnGradient}
              >
                <Text style={styles.doneBtnText}>Got It — Return to App</Text>
                <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(3, 7, 18, 0.85)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#0B1120",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.15)",
    maxHeight: "92%",
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.35,
        shadowRadius: 18,
      },
      android: { elevation: 12 },
    }),
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  headerTitleWrap: {
    flex: 1,
    paddingRight: 12,
  },
  badgeWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "rgba(167, 139, 250, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 6,
  },
  badgeText: {
    color: "#C084FC",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  headerTitle: {
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    color: "#94A3B8",
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  personaBar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  personaBarLabel: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  personaPillsRow: {
    flexDirection: "row",
    gap: 8,
  },
  personaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  personaPillActive: {
    backgroundColor: "rgba(124, 58, 237, 0.3)",
    borderColor: "#A78BFA",
  },
  personaAvatar: {
    fontSize: 14,
  },
  personaName: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "600",
  },
  personaNameActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  scrollContent: {
    flexGrow: 0,
  },
  scrollInner: {
    padding: 16,
    gap: 14,
  },
  comparisonGrid: {
    gap: 14,
  },
  /* Column 1: Blind AI */
  columnBlind: {
    backgroundColor: "rgba(239, 68, 68, 0.04)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    padding: 16,
    gap: 10,
  },
  columnTagBlind: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  columnTagBlindText: {
    color: "#F87171",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  fitScoreBlindBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(239, 68, 68, 0.25)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  fitScoreBlindText: {
    color: "#FCA5A5",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  riskBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  riskBannerText: {
    color: "#FCA5A5",
    fontSize: 12,
    fontWeight: "700",
  },
  dishNameBlind: {
    color: "#F8FAFC",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
  macroPillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  macroPillBlind: {
    color: "#CBD5E1",
    fontSize: 11,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  micronutrientRowBlind: {
    flexDirection: "row",
    alignItems: "center",
  },
  micronutrientBlindText: {
    color: "#F87171",
    fontSize: 12,
    fontWeight: "600",
  },
  quoteBoxBlind: {
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    padding: 10,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: "#EF4444",
  },
  quoteBoxBlindText: {
    color: "#94A3B8",
    fontSize: 11,
    fontStyle: "italic",
    lineHeight: 16,
  },
  /* Column 2: Qloo AI */
  columnQloo: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.4)",
    padding: 16,
    gap: 10,
  },
  columnTagQloo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "rgba(192, 132, 252, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  columnTagQlooText: {
    color: "#C084FC",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  fitScoreQlooBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(52, 211, 153, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  fitScoreQlooText: {
    color: "#34D399",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  benefitBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(52, 211, 153, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  benefitBannerText: {
    color: "#6EE7B7",
    fontSize: 12,
    fontWeight: "700",
  },
  dishNameQloo: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20,
  },
  macroPillQloo: {
    color: "#E2E8F0",
    fontSize: 11,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    fontWeight: "600",
  },
  micronutrientRowQloo: {
    flexDirection: "row",
    alignItems: "center",
  },
  micronutrientQlooText: {
    color: "#34D399",
    fontSize: 12,
    fontWeight: "700",
  },
  quoteBoxQloo: {
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    padding: 10,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: "#A78BFA",
  },
  quoteBoxQlooText: {
    color: "#DDD6FE",
    fontSize: 11,
    fontStyle: "italic",
    lineHeight: 16,
  },
  anchorsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },
  anchorBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  anchorBadgeText: {
    color: "#DDD6FE",
    fontSize: 10,
    fontWeight: "600",
  },
  takeawayCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.25)",
    padding: 12,
    borderRadius: 14,
  },
  takeawayText: {
    flex: 1,
    color: "#FDE68A",
    fontSize: 11,
    lineHeight: 16,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
  },
  doneBtn: {
    borderRadius: 14,
    overflow: "hidden",
  },
  doneBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  doneBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});

