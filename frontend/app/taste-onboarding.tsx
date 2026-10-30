import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { colors } from "@/src/theme";
import { submitTasteOnboarding } from "@/src/lib/api";
import { getTasteEntityMeta } from "@/src/utils/tasteIcons";
import CulturalTasteGraphExplorer from "@/src/components/CulturalTasteGraphExplorer";

// ── Step Configs ─────────────────────────────────────────────────────────

const STEPS = [
  {
    icon: "restaurant" as const,
    title: "Restaurants you love",
    subtitle: "We'll map your dining taste through Qloo's cultural graph.",
    suggestions: [
      "Nobu", "Olive Garden", "Chipotle", "Panda Express",
      "Shake Shack", "Sweetgreen", "Cheesecake Factory", "Nando's",
    ],
    placeholder: "Add another restaurant...",
    key: "restaurants",
  },
  {
    icon: "earth" as const,
    title: "Your favorite cuisines",
    subtitle: "Select cuisines you enjoy — this shapes your recommendations.",
    suggestions: [
      "Italian", "Japanese", "Mexican", "Thai",
      "Indian", "Mediterranean", "Korean", "Chinese",
      "French", "Vietnamese", "Ethiopian", "Peruvian",
    ],
    placeholder: "",
    key: "cuisines",
  },
  {
    icon: "film" as const,
    title: "Films & TV you love",
    subtitle: "Qloo connects film taste to dining — people who love certain films share food preferences.",
    suggestions: [
      "Midnight in Paris", "Jiro Dreams of Sushi", "Ratatouille",
      "Eat Pray Love", "Chef", "The Grand Budapest Hotel",
      "Spirited Away", "Julie & Julia", "Burnt",
    ],
    placeholder: "Add a film or TV show...",
    key: "films",
  },
  {
    icon: "musical-notes" as const,
    title: "Music artists you love",
    subtitle: "Your music taste reveals deep cultural patterns that predict food preferences.",
    suggestions: [
      "Bad Bunny", "Taylor Swift", "Drake", "Chet Baker",
      "Beyoncé", "The Weeknd", "Rosalía", "Billie Eilish",
      "Kendrick Lamar", "Dua Lipa", "BTS", "Frank Ocean",
    ],
    placeholder: "Add an artist or band...",
    key: "music",
  },
  {
    icon: "airplane" as const,
    title: "Places you've loved visiting",
    subtitle: "Travel destinations + food influences complete your cross-domain taste DNA.",
    suggestions: [
      "Tokyo", "Paris", "Barcelona", "Mexico City",
      "Bangkok", "Istanbul", "Marrakech", "New York",
    ],
    extraSuggestions: [
      "Anthony Bourdain", "Gordon Ramsay", "Street Food",
      "Farm to Table", "Fusion Cuisine", "Fine Dining",
    ],
    extraLabel: "Food inspirations:",
    placeholder: "Add a destination or influence...",
    key: "travel_influences",
  },
];

const TOTAL_STEPS = STEPS.length;

// ── Chip Component ───────────────────────────────────────────────────────

function Chip({
  label,
  selected,
  onPress,
  category,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  category?: string;
}) {
  const meta = getTasteEntityMeta(label, category);
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.chip,
        selected
          ? styles.chipSelected
          : { borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.06)" },
      ]}
    >
      <View
        style={[
          styles.chipIconWrap,
          selected
            ? { backgroundColor: "rgba(255, 255, 255, 0.22)" }
            : { backgroundColor: meta.bg },
        ]}
      >
        <Ionicons
          name={meta.icon}
          size={13}
          color={selected ? "#FFFFFF" : meta.color}
        />
      </View>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
      {selected && (
        <Ionicons
          name="checkmark-circle"
          size={15}
          color="#FFFFFF"
          style={{ marginLeft: 2 }}
        />
      )}
    </TouchableOpacity>
  );
}

// ── Main Component ───────────────────────────────────────────────────────

export default function TasteOnboarding() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const [step, setStep] = useState(0);

  const handleDone = () => {
    router.replace("/(tabs)/home");
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    } else if (from === "registration" || !router.canGoBack()) {
      router.replace("/(tabs)/home");
    } else {
      router.back();
    }
  };
  const [restaurants, setRestaurants] = useState<string[]>([]);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [films, setFilms] = useState<string[]>([]);
  const [music, setMusic] = useState<string[]>([]);
  const [travelDestinations, setTravelDestinations] = useState<string[]>([]);
  const [foodInfluences, setFoodInfluences] = useState<string[]>([]);
  const [step5InputType, setStep5InputType] = useState<"destination" | "influence">("destination");
  const [customInput, setCustomInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Map step index to its state for steps 0-3
  const stepStates: [string[], (v: string[]) => void][] = [
    [restaurants, setRestaurants],
    [cuisines, setCuisines],
    [films, setFilms],
    [music, setMusic],
    [travelDestinations, setTravelDestinations],
  ];

  const [currentList, setCurrentList] = stepStates[step] || stepStates[0];
  const currentStep = STEPS[step];

  const toggleItem = (item: string) => {
    if (currentList.includes(item)) {
      setCurrentList(currentList.filter((i) => i !== item));
    } else {
      setCurrentList([...currentList, item]);
    }
  };

  const toggleDestination = (dest: string) => {
    if (travelDestinations.includes(dest)) {
      setTravelDestinations(travelDestinations.filter((d) => d !== dest));
    } else {
      setTravelDestinations([...travelDestinations, dest]);
    }
  };

  const toggleInfluence = (influence: string) => {
    if (foodInfluences.includes(influence)) {
      setFoodInfluences(foodInfluences.filter((i) => i !== influence));
    } else {
      setFoodInfluences([...foodInfluences, influence]);
    }
  };

  const addCustom = () => {
    const trimmed = customInput.trim();
    if (!trimmed) return;

    if (step === 4) {
      if (step5InputType === "destination") {
        if (!travelDestinations.includes(trimmed)) {
          setTravelDestinations([...travelDestinations, trimmed]);
        }
      } else {
        if (!foodInfluences.includes(trimmed)) {
          setFoodInfluences([...foodInfluences, trimmed]);
        }
      }
      setCustomInput("");
      return;
    }

    if (!currentList.includes(trimmed)) {
      setCurrentList([...currentList, trimmed]);
      setCustomInput("");
    }
  };

  const handleSubmit = async () => {
    if (
      restaurants.length === 0 &&
      cuisines.length === 0 &&
      films.length === 0 &&
      music.length === 0 &&
      travelDestinations.length === 0 &&
      foodInfluences.length === 0
    ) {
      Alert.alert("Add Favorites", "Please add at least a few favorites across any category to build your Taste DNA.");
      return;
    }
    setLoading(true);
    try {
      const res = await submitTasteOnboarding({
        favorite_restaurants: restaurants,
        favorite_cuisines: cuisines,
        food_influences: foodInfluences,
        favorite_films: films,
        favorite_music: music,
        travel_destinations: travelDestinations,
      });
      if (res.success) {
        setResult(res.taste_dna_summary);
      } else {
        Alert.alert("Error", res.error || "Failed to build taste profile.");
      }
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || e.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  // ── Result Screen ──────────────────────────────────────────────────────

  if (result) {
    const domainBadges = [
      { label: "Dining", count: restaurants.length, icon: "restaurant", color: "#F59E0B" },
      { label: "Cuisines", count: cuisines.length, icon: "earth", color: "#10B981" },
      { label: "Films", count: films.length, icon: "film", color: "#3B82F6" },
      { label: "Music", count: music.length, icon: "musical-notes", color: "#EC4899" },
      { label: "Travel", count: travelDestinations.length, icon: "airplane", color: "#8B5CF6" },
      { label: "Inspirations", count: foodInfluences.length, icon: "flame", color: "#EF4444" },
    ].filter(d => d.count > 0);

    return (
      <LinearGradient colors={["#0F0C29", "#302B63", "#24243E"]} style={styles.gradient}>
        <SafeAreaView style={styles.container}>
          <ScrollView contentContainerStyle={styles.resultScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.dnaIcon}>
              <Ionicons name="sparkles" size={48} color="#A78BFA" />
            </View>
            <Text style={styles.resultTitle}>Taste DNA Activated! 🎉</Text>
            <Text style={styles.resultSubtitle}>
              {result.domains_connected} cultural domains connected through Qloo's taste graph.
            </Text>

            {/* Domain Badges */}
            <View style={styles.domainBadgeRow}>
              {domainBadges.map(d => (
                <View key={d.label} style={[styles.domainBadge, { borderColor: d.color }]}>
                  <Ionicons name={d.icon as any} size={16} color={d.color} />
                  <Text style={[styles.domainBadgeText, { color: d.color }]}>{d.label}</Text>
                </View>
              ))}
            </View>

            {/* Stats Card */}
            <View style={styles.resultCard}>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Entities Mapped</Text>
                <Text style={styles.resultValue}>{result.entity_count}</Text>
              </View>
              {result.cuisines?.length > 0 && (
                <View style={styles.resultTagSection}>
                  <Text style={styles.resultLabel}>Cuisines</Text>
                  <View style={styles.resultTagGrid}>
                    {result.cuisines.slice(0, 5).map((c: string) => {
                      const meta = getTasteEntityMeta(c, "cuisines");
                      return (
                        <View key={c} style={[styles.resultTagPill, { borderColor: meta.color, backgroundColor: meta.bg }]}>
                          <Ionicons name={meta.icon} size={12} color={meta.color} />
                          <Text style={styles.resultTagText}>{c}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
              {result.film_tags?.length > 0 && (
                <View style={styles.resultTagSection}>
                  <Text style={styles.resultLabel}>Film Connections</Text>
                  <View style={styles.resultTagGrid}>
                    {result.film_tags.slice(0, 4).map((f: string) => {
                      const meta = getTasteEntityMeta(f, "films");
                      return (
                        <View key={f} style={[styles.resultTagPill, { borderColor: meta.color, backgroundColor: meta.bg }]}>
                          <Ionicons name={meta.icon} size={12} color={meta.color} />
                          <Text style={styles.resultTagText}>{f}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
              {result.music_tags?.length > 0 && (
                <View style={styles.resultTagSection}>
                  <Text style={styles.resultLabel}>Music Connections</Text>
                  <View style={styles.resultTagGrid}>
                    {result.music_tags.slice(0, 4).map((m: string) => {
                      const meta = getTasteEntityMeta(m, "music");
                      return (
                        <View key={m} style={[styles.resultTagPill, { borderColor: meta.color, backgroundColor: meta.bg }]}>
                          <Ionicons name={meta.icon} size={12} color={meta.color} />
                          <Text style={styles.resultTagText}>{m}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
              {result.travel_tags?.length > 0 && (
                <View style={styles.resultTagSection}>
                  <Text style={styles.resultLabel}>Travel Connections</Text>
                  <View style={styles.resultTagGrid}>
                    {result.travel_tags.slice(0, 4).map((t: string) => {
                      const meta = getTasteEntityMeta(t, "travel");
                      return (
                        <View key={t} style={[styles.resultTagPill, { borderColor: meta.color, backgroundColor: meta.bg }]}>
                          <Ionicons name={meta.icon} size={12} color={meta.color} />
                          <Text style={styles.resultTagText}>{t}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Dining Matches Found</Text>
                <Text style={styles.resultValue}>{result.dining_matches}</Text>
              </View>
            </View>

            {/* Interactive Cultural Taste Graph Explorer */}
            <CulturalTasteGraphExplorer
              data={{
                cuisines: result.cuisines || cuisines,
                film_tags: result.film_tags || films,
                music_tags: result.music_tags || music,
                travel_tags: result.travel_tags || travelDestinations,
                restaurants: restaurants,
                entities_map: (result as any)?.entities_map,
                domains_connected: result.domains_connected || domainBadges.length,
                entity_count: result.entity_count,
              }}
            />

            <Text style={styles.crossDomainNote}>
              💡 Your film & music taste is now influencing your meal recommendations through Qloo's cross-domain cultural intelligence.
            </Text>

            <TouchableOpacity
              style={styles.doneButton}
              onPress={handleDone}
              activeOpacity={0.8}
              testID="taste-onboarding-done"
            >
              <LinearGradient
                colors={["#7C3AED", "#A78BFA"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.doneButtonGradient}
              >
                <Text style={styles.doneButtonText}>Start Getting Recommendations</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ── Onboarding Steps ───────────────────────────────────────────────────

  const selectedCount =
    step === 4
      ? travelDestinations.length + foodInfluences.length
      : currentList.length;

  return (
    <LinearGradient colors={["#0F0C29", "#302B63", "#24243E"]} style={styles.gradient}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} testID="taste-onboarding-back">
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.progressBar}>
              {STEPS.map((_, i) => (
                <View
                  key={i}
                  style={[styles.progressDot, i <= step && styles.progressDotActive]}
                />
              ))}
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Text style={styles.stepCounter}>{step + 1}/{TOTAL_STEPS}</Text>
              <TouchableOpacity
                onPress={() => router.replace("/(tabs)/home")}
                testID="taste-onboarding-skip"
                style={styles.skipBtn}
              >
                <Text style={styles.skipBtnText}>Skip</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Title */}
          <View style={styles.titleSection}>
            <Ionicons name={currentStep.icon} size={32} color="#A78BFA" />
            <Text style={styles.title}>{currentStep.title}</Text>
            <Text style={styles.subtitle}>{currentStep.subtitle}</Text>
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Suggestion Chips */}
            <View style={styles.chipGrid}>
              {currentStep.suggestions.map((s) => {
                const isSelected =
                  step === 4
                    ? travelDestinations.includes(s)
                    : currentList.includes(s);
                return (
                  <Chip
                    key={s}
                    label={s}
                    category={step === 4 ? "travel" : currentStep.key}
                    selected={isSelected}
                    onPress={() => (step === 4 ? toggleDestination(s) : toggleItem(s))}
                  />
                );
              })}
            </View>

            {/* Extra suggestions (step 5) */}
            {(currentStep as any).extraSuggestions && (
              <View style={{ marginTop: 20 }}>
                <Text style={styles.extraLabel}>{(currentStep as any).extraLabel}</Text>
                <View style={styles.chipGrid}>
                  {(currentStep as any).extraSuggestions.map((s: string) => {
                    const isSelected = foodInfluences.includes(s);
                    return (
                      <Chip
                        key={s}
                        label={s}
                        category="influences"
                        selected={isSelected}
                        onPress={() => toggleInfluence(s)}
                      />
                    );
                  })}
                </View>
              </View>
            )}

            {/* Step 5 Custom Category Selector */}
            {step === 4 && (
              <View style={styles.typeSelectorRow}>
                <TouchableOpacity
                  style={[
                    styles.typePill,
                    step5InputType === "destination" && styles.typePillActive,
                  ]}
                  onPress={() => setStep5InputType("destination")}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="airplane"
                    size={13}
                    color={step5InputType === "destination" ? "#fff" : "#94A3B8"}
                  />
                  <Text
                    style={[
                      styles.typePillText,
                      step5InputType === "destination" && styles.typePillTextActive,
                    ]}
                  >
                    Destination
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.typePill,
                    step5InputType === "influence" && styles.typePillActive,
                  ]}
                  onPress={() => setStep5InputType("influence")}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="flame"
                    size={13}
                    color={step5InputType === "influence" ? "#fff" : "#94A3B8"}
                  />
                  <Text
                    style={[
                      styles.typePillText,
                      step5InputType === "influence" && styles.typePillTextActive,
                    ]}
                  >
                    Food Inspiration / Chef
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Custom Input */}
            {currentStep.placeholder ? (
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  placeholder={
                    step === 4
                      ? step5InputType === "destination"
                        ? "Add a destination (e.g. Kyoto)..."
                        : "Add an inspiration (e.g. Street Food)..."
                      : currentStep.placeholder
                  }
                  placeholderTextColor="#64748B"
                  value={customInput}
                  onChangeText={setCustomInput}
                  onSubmitEditing={addCustom}
                />
                <TouchableOpacity style={styles.addButton} onPress={addCustom}>
                  <Ionicons name="add" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Selected Items */}
            {selectedCount > 0 && (
              <View style={styles.selectedSection}>
                <Text style={styles.selectedLabel}>Selected ({selectedCount})</Text>
                <View style={styles.chipGrid}>
                  {step === 4 ? (
                    <>
                      {travelDestinations.map((item) => (
                        <Chip
                          key={item}
                          label={item}
                          category="travel"
                          selected
                          onPress={() => toggleDestination(item)}
                        />
                      ))}
                      {foodInfluences.map((item) => (
                        <Chip
                          key={item}
                          label={item}
                          category="influences"
                          selected
                          onPress={() => toggleInfluence(item)}
                        />
                      ))}
                    </>
                  ) : (
                    currentList.map((item) => (
                      <Chip
                        key={item}
                        label={item}
                        category={currentStep.key}
                        selected
                        onPress={() => toggleItem(item)}
                      />
                    ))
                  )}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Bottom Action */}
          <View style={styles.bottomAction}>
            {step < TOTAL_STEPS - 1 ? (
              <>
                <TouchableOpacity
                  style={styles.nextButton}
                  onPress={() => { setCustomInput(""); setStep(step + 1); }}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={["#7C3AED", "#A78BFA"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.nextButtonGradient}
                  >
                    <Text style={styles.nextButtonText}>
                      {selectedCount > 0 ? `Continue (${selectedCount} selected)` : "Skip this step"}
                    </Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                  </LinearGradient>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={styles.nextButton}
                onPress={handleSubmit}
                disabled={loading}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={loading ? ["#4B5563", "#6B7280"] : ["#7C3AED", "#A78BFA"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.nextButtonGradient}
                >
                  {loading ? (
                    <>
                      <ActivityIndicator color="#fff" size="small" />
                      <Text style={styles.nextButtonText}>  Building Cross-Domain Taste DNA...</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="sparkles" size={20} color="#fff" />
                      <Text style={styles.nextButtonText}>  Build My Taste DNA</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 20 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    paddingBottom: 12,
  },
  progressBar: { flexDirection: "row", gap: 6 },
  progressDot: {
    width: 24,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  progressDotActive: { backgroundColor: "#A78BFA" },
  stepCounter: { color: "rgba(255,255,255,0.5)", fontSize: 14, fontWeight: "600" },
  skipBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  skipBtnText: {
    color: "#E2E8F0",
    fontSize: 12,
    fontWeight: "700",
  },
  titleSection: { marginBottom: 20, gap: 8 },
  title: { color: "#fff", fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { color: "rgba(255,255,255,0.6)", fontSize: 14, lineHeight: 21 },
  scrollContent: { flex: 1 },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chipIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  chipSelected: {
    backgroundColor: "rgba(167,139,250,0.3)",
    borderColor: "#A78BFA",
  },
  chipText: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "600" },
  chipTextSelected: { color: "#FFFFFF", fontWeight: "700" },
  resultTagSection: {
    gap: 8,
  },
  resultTagGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  resultTagPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  resultTagText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  extraLabel: {
    color: "#A78BFA",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  typeSelectorRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 18,
    marginBottom: -6,
  },
  typePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  typePillActive: {
    backgroundColor: "#7C3AED",
    borderColor: "#A78BFA",
  },
  typePillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94A3B8",
  },
  typePillTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  inputRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  input: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 16,
    color: "#fff",
    fontSize: 15,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#7C3AED",
    justifyContent: "center",
    alignItems: "center",
  },
  selectedSection: { marginTop: 20 },
  selectedLabel: { color: "#A78BFA", fontSize: 13, fontWeight: "600", marginBottom: 10 },
  bottomAction: { paddingBottom: Platform.OS === "ios" ? 8 : 20, paddingTop: 12 },
  nextButton: { borderRadius: 16, overflow: "hidden" },
  nextButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  nextButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  // Result Screen
  resultScroll: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 10, paddingVertical: 20 },
  dnaIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(167,139,250,0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  resultTitle: { color: "#fff", fontSize: 28, fontWeight: "800", textAlign: "center", marginBottom: 8 },
  resultSubtitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
  },
  domainBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginBottom: 24,
  },
  domainBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  domainBadgeText: { fontSize: 12, fontWeight: "600" },
  resultCard: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.2)",
    padding: 20,
    gap: 14,
    marginBottom: 20,
  },
  resultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  resultLabel: { color: "rgba(255,255,255,0.5)", fontSize: 14 },
  resultValue: { color: "#A78BFA", fontSize: 14, fontWeight: "600", maxWidth: "55%", textAlign: "right" },
  crossDomainNote: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  doneButton: { width: "100%", borderRadius: 16, overflow: "hidden" },
  doneButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  doneButtonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});
