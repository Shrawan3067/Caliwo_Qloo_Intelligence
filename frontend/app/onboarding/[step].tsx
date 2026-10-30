import React, { useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Pressable,
  Platform,
} from "react-native";
import Svg, {
  Path,
  Line,
  Circle,
  Rect,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { LinearGradient as ExpoLinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import DateTimePicker from "@react-native-community/datetimepicker";
import { OnboardingLayout } from "@/src/components/OnboardingLayout";
import { SelectionCard } from "@/src/components/SelectionCard";
import { SegmentedToggle } from "@/src/components/SegmentedToggle";
import { NumberRuler } from "@/src/components/NumberRuler";
import { VerticalHeightPicker } from "@/src/components/VerticalHeightPicker";
import { VerticalWeightPicker } from "@/src/components/VerticalWeightPicker";
import { useOnboarding, computePlan } from "@/src/context/OnboardingContext";
import { useAuth } from "@/src/context/AuthContext";
import { colors } from "@/src/theme";
import { Ring } from "@/src/components/Ring";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

const TOTAL_STEPS = 25;

const OBSTACLES: {
  label: string;
  sub: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    label: "Lack of consistency",
    sub: "60-second photo logging & smart nudges keep you in the flow",
    icon: "calendar",
  },
  {
    label: "Unhealthy eating habits",
    sub: "AI suggests tasty, nutrient-dense swaps for comfort foods",
    icon: "fast-food",
  },
  {
    label: "Busy schedule",
    sub: "Snap a photo of your plate in 3s — zero barcode scanning",
    icon: "time",
  },
  {
    label: "Emotional eating",
    sub: "Gentle awareness & guidance to understand hunger triggers",
    icon: "heart-half",
  },
  {
    label: "Lack of inspiration",
    sub: "Personalized macro recipes tailored to what's in your fridge",
    icon: "bulb",
  },
  {
    label: "Poor sleep",
    sub: "Circadian eating insights for deep metabolic recovery",
    icon: "moon",
  },
];

const DIETS: {
  key: string;
  label: string;
  sub: string;
  badge?: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    key: "none",
    label: "Classic — whole-food focus",
    sub: "Balanced macronutrients, flexible with zero food restrictions",
    badge: "MOST FLEXIBLE",
    icon: "restaurant",
  },
  {
    key: "keto",
    label: "Keto",
    sub: "High healthy fats, moderate protein, very low carbs (<50g)",
    badge: "FAT BURNING",
    icon: "flame",
  },
  {
    key: "vegan",
    label: "Vegan",
    sub: "100% plant-based whole foods, grains, nuts & legumes",
    icon: "leaf",
  },
  {
    key: "vegetarian",
    label: "Vegetarian",
    sub: "Plant-forward with farm-fresh eggs & dairy permitted",
    icon: "nutrition",
  },
  {
    key: "mediterranean",
    label: "Mediterranean",
    sub: "Heart-healthy olive oil, wild seafood, legumes & leafy greens",
    badge: "LONGEVITY",
    icon: "fish",
  },
];

const ACCOMPLISHMENTS: {
  label: string;
  sub: string;
  badge?: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    label: "Eat and live healthier",
    sub: "Nourish your body with clean, micronutrient-dense fuel",
    icon: "nutrition",
  },
  {
    label: "Boost my energy",
    sub: "Eliminate 3 PM slumps with steady glycemic fuel",
    badge: "HIGH IMPACT",
    icon: "flash",
  },
  {
    label: "Feel better about my body",
    sub: "Build lean tone, functional strength, and confidence",
    icon: "body",
  },
  {
    label: "Sleep better",
    sub: "Optimize dinner timing for deep, restorative sleep cycles",
    icon: "moon",
  },
  {
    label: "Build lasting habits",
    sub: "Permanent lifestyle transformation that sticks for life",
    badge: "LIFELONG",
    icon: "repeat",
  },
];

export default function OnboardingStep() {
  const { step } = useLocalSearchParams<{ step: string }>();
  const stepNum = Math.max(1, Math.min(TOTAL_STEPS, parseInt(step || "1", 10)));
  const router = useRouter();
  const { user, refresh } = useAuth();
  const { data, update, save } = useOnboarding();
  const [saving, setSaving] = useState(false);
  const [heightUnit, setHeightUnit] = useState<"cm" | "ft">("cm");
  const [weightUnit, setWeightUnit] = useState<"kg" | "lb">("kg");
  const [showDatePicker, setShowDatePicker] = useState(false);

  const age = useMemo(() => {
    if (!data.date_of_birth) return null;
    const [y, m, d] = data.date_of_birth.split("-").map(Number);
    const dob = new Date(y, m - 1, d);
    const diff = Date.now() - dob.getTime();
    const ageDate = new Date(diff);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  }, [data.date_of_birth]);

  const formattedDate = useMemo(() => {
    if (!data.date_of_birth) return "Select your birth date";
    const [y, m, d] = data.date_of_birth.split("-").map(Number);
    const dob = new Date(y, m - 1, d);
    return dob.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }, [data.date_of_birth]);

  const goNext = async () => {
    Haptics.selectionAsync().catch(() => {});
    if (stepNum >= TOTAL_STEPS) {
      setSaving(true);
      try {
        if (user) {
          await save();
          const freshUser = await refresh();
          const activeUser = freshUser || user;
          const hasTaste = Boolean(
            activeUser?.taste_onboarded ||
            activeUser?.profile?.taste_onboarded ||
            activeUser?.has_taste_dna ||
            activeUser?.profile?.taste_dna?.entity_ids?.length
          );
          if (hasTaste) {
            router.replace("/(tabs)/home");
          } else {
            router.replace({
              pathname: "/taste-onboarding",
              params: { from: "onboarding" },
            } as any);
          }
          return;
        }
      } catch (e) {
        if (__DEV__) console.warn("[onboarding] save failed:", e);
      } finally {
        setSaving(false);
      }
      router.replace("/signup");
      return;
    }
    router.push(`/onboarding/${stepNum + 1}`);
  };

  // Step dispatch
  switch (stepNum) {
    case 1:
      return (
        <OnboardingLayout
          step={1}
          total={TOTAL_STEPS}
          title="Choose your sex"
          subtitle="This calibrates your basal metabolic rate and hormonal baseline."
          onContinue={goNext}
          continueDisabled={!data.sex}
        >
          {(["Male", "Female", "Other"] as const).map((s) => (
            <SelectionCard
              key={s}
              title={s}
              subtitle={
                s === "Male"
                  ? "Standard biological metabolic calculation for men"
                  : s === "Female"
                  ? "Standard biological metabolic calculation for women"
                  : "Neutral metabolic baseline calculation"
              }
              icon={
                s === "Male" ? "male" : s === "Female" ? "female" : "people"
              }
              active={data.sex === s}
              onPress={() => update({ sex: s })}
              testID={`sex-${s.toLowerCase()}`}
            />
          ))}
        </OnboardingLayout>
      );

    case 2:
      return (
        <OnboardingLayout
          step={2}
          total={TOTAL_STEPS}
          title="How many workouts do you do per week?"
          subtitle="Activity level directly determines your total daily energy expenditure (TDEE)."
          onContinue={goNext}
          continueDisabled={!data.workouts_per_week}
        >
          {[
            {
              k: "0-2",
              t: "0–2 workouts / week",
              s: "Light activity · Desk job or occasional brisk walks",
              dots: 2,
            },
            {
              k: "3-5",
              t: "3–5 workouts / week",
              s: "Moderate activity · Regular gym training or cardio",
              dots: 4,
              badge: "MOST COMMON",
            },
            {
              k: "6+",
              t: "6+ workouts / week",
              s: "High intensity · Dedicated athlete or heavy daily training",
              dots: 6,
            },
          ].map((o) => (
            <SelectionCard
              key={o.k}
              title={o.t}
              subtitle={o.s}
              badge={o.badge}
              customIcon={
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 4,
                    justifyContent: "center",
                    width: 28,
                  }}
                >
                  {Array.from({ length: o.dots }).map((_, i) => (
                    <View
                      key={i}
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor:
                          data.workouts_per_week === o.k
                            ? colors.accent || "#FF5E00"
                            : "#CBD5E1",
                      }}
                    />
                  ))}
                </View>
              }
              active={data.workouts_per_week === o.k}
              onPress={() => update({ workouts_per_week: o.k })}
              testID={`workouts-${o.k}`}
            />
          ))}
        </OnboardingLayout>
      );

    case 3:
      return (
        <OnboardingLayout
          step={3}
          total={TOTAL_STEPS}
          title="Designed to help you stay on track"
          subtitle="80% of Caliwo users maintain their weight loss even 6 months later."
          onContinue={goNext}
        >
          <TrustGraph />
        </OnboardingLayout>
      );

    case 4: {
      const currentHeight = data.height_cm ?? 170;
      const totalInches = Math.round(currentHeight / 2.54);
      const displayHeight =
        heightUnit === "cm"
          ? `${currentHeight} cm`
          : `${Math.floor(totalInches / 12)} ft ${totalInches % 12} in`;

      return (
        <OnboardingLayout
          step={4}
          total={TOTAL_STEPS}
          title="What is your height?"
          subtitle="Height is essential for accurately computing your lean body mass and BMR."
          onContinue={goNext}
          continueDisabled={!data.height_cm}
        >
          <View style={pickerStyles.valuePill}>
            <Ionicons
              name="resize-outline"
              size={18}
              color={colors.accent || "#FF5E00"}
            />
            <Text style={pickerStyles.valuePillText}>{displayHeight}</Text>
          </View>
          <SegmentedToggle
            options={[
              { label: "cm", value: "cm", testID: "unit-cm" },
              { label: "ft", value: "ft", testID: "unit-ft" },
            ]}
            value={heightUnit}
            onChange={(val) => setHeightUnit(val)}
          />
          <VerticalHeightPicker
            unit={heightUnit}
            heightCm={currentHeight}
            onChangeCm={(cm) => update({ height_cm: cm })}
            testID="vertical-height-picker"
          />
        </OnboardingLayout>
      );
    }

    case 5: {
      const currentWeight = data.weight_kg ?? 70;
      const displayWeight =
        weightUnit === "kg"
          ? `${currentWeight} kg`
          : `${Math.round(currentWeight * 2.20462)} lb`;

      return (
        <OnboardingLayout
          step={5}
          total={TOTAL_STEPS}
          title="What is your current weight?"
          subtitle="This is your baseline starting point for your personalized nutrition plan."
          onContinue={goNext}
          continueDisabled={!data.weight_kg}
        >
          <View style={pickerStyles.valuePill}>
            <Ionicons
              name="speedometer-outline"
              size={18}
              color={colors.accent || "#FF5E00"}
            />
            <Text style={pickerStyles.valuePillText}>{displayWeight}</Text>
          </View>
          <SegmentedToggle
            options={[
              { label: "kg", value: "kg", testID: "unit-kg" },
              { label: "lb", value: "lb", testID: "unit-lb" },
            ]}
            value={weightUnit}
            onChange={(val) => setWeightUnit(val)}
          />
          <VerticalWeightPicker
            unit={weightUnit}
            weightKg={currentWeight}
            onChangeKg={(kg) => update({ weight_kg: kg })}
            testID="vertical-weight-picker"
          />
        </OnboardingLayout>
      );
    }

    case 6: {
      return (
        <OnboardingLayout
          step={6}
          total={TOTAL_STEPS}
          title="When were you born?"
          subtitle="Age helps us tune your calorie targets accurately."
          onContinue={goNext}
          continueDisabled={!data.date_of_birth}
        >
          <View
            style={{
              alignItems: "center",
              marginTop: 12,
              width: "100%",
              paddingHorizontal: 10,
            }}
          >
            {/* Premium Icon Header */}
            <View
              style={{
                width: 96,
                height: 96,
                borderRadius: 18,
                backgroundColor: colors.white,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 28,
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: "#0F172A",
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.04,
                shadowRadius: 16,
                elevation: 2,
              }}
            >
              <View
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 14,
                  backgroundColor: colors.accentSoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="calendar" size={28} color={colors.accent} />
              </View>
            </View>

            {/* Date Selector Card */}
            {Platform.OS === "web" ? (
              <View style={{ width: "100%", position: "relative" }}>
                <View
                  style={{
                    backgroundColor: colors.white,
                    paddingVertical: 16,
                    paddingHorizontal: 18,
                    borderRadius: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderWidth: 1.5,
                    borderColor: data.date_of_birth
                      ? colors.accent
                      : colors.border,
                    shadowColor: data.date_of_birth ? colors.accent : "#0F172A",
                    shadowOffset: { width: 0, height: 10 },
                    shadowOpacity: data.date_of_birth ? 0.1 : 0.03,
                    shadowRadius: 20,
                    elevation: 3,
                  }}
                >
                  <View>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color: colors.textSecondary,
                        textTransform: "uppercase",
                        letterSpacing: 1,
                        marginBottom: 4,
                      }}
                    >
                      Your Birthday
                    </Text>
                    <Text
                      style={{
                        fontSize: 22,
                        fontWeight: "800",
                        color: data.date_of_birth
                          ? colors.textPrimary
                          : colors.textTertiary,
                        letterSpacing: -0.5,
                      }}
                    >
                      {formattedDate}
                    </Text>
                  </View>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      backgroundColor: data.date_of_birth
                        ? colors.accent
                        : colors.surface,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons
                      name="chevron-down"
                      size={20}
                      color={
                        data.date_of_birth ? colors.white : colors.textSecondary
                      }
                    />
                  </View>
                </View>
                <input
                  type="date"
                  value={data.date_of_birth ?? ""}
                  onChange={(e) => update({ date_of_birth: e.target.value })}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    opacity: 0,
                    cursor: "pointer",
                  }}
                />
              </View>
            ) : (
              <View style={{ width: "100%" }}>
                {Platform.OS === "android" && (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={{
                      backgroundColor: colors.white,
                      paddingVertical: 16,
                      paddingHorizontal: 18,
                      borderRadius: 14,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      borderWidth: 1.5,
                      borderColor: data.date_of_birth
                        ? colors.accent
                        : colors.border,
                      shadowColor: data.date_of_birth
                        ? colors.accent
                        : "#0F172A",
                      shadowOffset: { width: 0, height: 10 },
                      shadowOpacity: data.date_of_birth ? 0.1 : 0.03,
                      shadowRadius: 20,
                      elevation: 3,
                    }}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <View>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "700",
                          color: colors.textSecondary,
                          textTransform: "uppercase",
                          letterSpacing: 1,
                          marginBottom: 4,
                        }}
                      >
                        Your Birthday
                      </Text>
                      <Text
                        style={{
                          fontSize: 22,
                          fontWeight: "800",
                          color: data.date_of_birth
                            ? colors.textPrimary
                            : colors.textTertiary,
                          letterSpacing: -0.5,
                        }}
                      >
                        {formattedDate}
                      </Text>
                    </View>
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        backgroundColor: data.date_of_birth
                          ? colors.accent
                          : colors.surface,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons
                        name="chevron-down"
                        size={20}
                        color={
                          data.date_of_birth
                            ? colors.white
                            : colors.textSecondary
                        }
                      />
                    </View>
                  </TouchableOpacity>
                )}

                {(showDatePicker || Platform.OS === "ios") && (
                  <View
                    style={{
                      marginTop: Platform.OS === "ios" ? 0 : 20,
                      backgroundColor:
                        Platform.OS === "ios" ? colors.white : "transparent",
                      borderRadius: 14,
                      overflow: "hidden",
                      borderWidth: Platform.OS === "ios" ? 1 : 0,
                      borderColor: colors.border,
                      padding: Platform.OS === "ios" ? 10 : 0,
                      shadowColor: "#0F172A",
                      shadowOffset: { width: 0, height: 8 },
                      shadowOpacity: 0.03,
                      shadowRadius: 16,
                    }}
                  >
                    <DateTimePicker
                      value={
                        data.date_of_birth
                          ? ((): Date => {
                              const [y, m, d] = data.date_of_birth
                                .split("-")
                                .map(Number);
                              return new Date(y, m - 1, d);
                            })()
                          : new Date(new Date().getFullYear() - 25, 0, 1)
                      }
                      mode="date"
                      display="spinner"
                      textColor={colors.textPrimary}
                      onChange={(e, date) => {
                        if (Platform.OS === "android") setShowDatePicker(false);
                        if (e.type === "set" && date) {
                          const y = date.getFullYear();
                          const m = String(date.getMonth() + 1).padStart(
                            2,
                            "0",
                          );
                          const d = String(date.getDate()).padStart(2, "0");
                          update({ date_of_birth: `${y}-${m}-${d}` });
                        }
                      }}
                    />
                  </View>
                )}
              </View>
            )}

            {/* Age Badge */}
            {age !== null && (
              <View style={{ marginTop: 28, alignItems: "center" }}>
                <View
                  style={{
                    backgroundColor: colors.bg,
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: colors.border,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Ionicons
                    name="happy"
                    size={18}
                    color={colors.textSecondary}
                  />
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "700",
                      color: colors.textSecondary,
                    }}
                  >
                    {age} years old
                  </Text>
                </View>
              </View>
            )}
          </View>
        </OnboardingLayout>
      );
    }

    case 7:
      return (
        <OnboardingLayout
          step={7}
          total={TOTAL_STEPS}
          title="Do you work with a personal trainer or dietitian?"
          subtitle="Caliwo seamlessly adapts to and complements existing professional routines."
          onContinue={goNext}
          continueDisabled={data.works_with_coach === undefined}
        >
          {[
            {
              v: true,
              t: "Yes, I have a coach or trainer",
              s: "Caliwo will track macros that align with your coach's guidelines",
              icon: "barbell" as keyof typeof Ionicons.glyphMap,
            },
            {
              v: false,
              t: "No, I manage my nutrition independently",
              s: "Caliwo's autonomous AI agent will be your 24/7 personal coach",
              icon: "sparkles" as keyof typeof Ionicons.glyphMap,
              badge: "AI POWERED",
            },
          ].map((o) => (
            <SelectionCard
              key={String(o.v)}
              title={o.t}
              subtitle={o.s}
              icon={o.icon}
              badge={o.badge}
              active={data.works_with_coach === o.v}
              onPress={() => update({ works_with_coach: o.v })}
              testID={`coach-${String(o.v)}`}
            />
          ))}
        </OnboardingLayout>
      );

    case 8:
      return (
        <OnboardingLayout
          step={8}
          total={TOTAL_STEPS}
          title="What is your primary goal?"
          subtitle="Every calorie target and macronutrient ratio will be engineered around this."
          onContinue={goNext}
          continueDisabled={!data.goal}
        >
          {[
            {
              k: "lose",
              t: "Lose weight & burn fat",
              s: "Shed body fat sustainably while preserving lean muscle mass",
              icon: "trending-down" as keyof typeof Ionicons.glyphMap,
              badge: "MOST POPULAR",
            },
            {
              k: "maintain",
              t: "Maintain weight & body recomp",
              s: "Optimize metabolism, clean eating, and sustained daily energy",
              icon: "swap-horizontal" as keyof typeof Ionicons.glyphMap,
            },
            {
              k: "gain",
              t: "Build lean muscle & strength",
              s: "Caloric surplus with high protein for maximum muscle hypertrophy",
              icon: "barbell" as keyof typeof Ionicons.glyphMap,
            },
          ].map((o) => (
            <SelectionCard
              key={o.k}
              title={o.t}
              subtitle={o.s}
              icon={o.icon}
              badge={o.badge}
              active={data.goal === (o.k as any)}
              onPress={() => update({ goal: o.k as any })}
              testID={`goal-${o.k}`}
            />
          ))}
        </OnboardingLayout>
      );

    case 9: {
      const defaultDesired =
        (data.weight_kg ?? 70) - (data.goal === "gain" ? -5 : 5);
      const targetWeight = data.desired_weight_kg ?? Math.round(defaultDesired);
      const currentWeight = data.weight_kg ?? 70;
      const diffKg = targetWeight - currentWeight;
      const diffText =
        diffKg === 0
          ? "Target: Maintain current weight"
          : diffKg < 0
          ? `Target: -${Math.abs(diffKg)} kg (${Math.abs(Math.round(diffKg * 2.20462))} lb) fat loss`
          : `Target: +${diffKg} kg (${Math.round(diffKg * 2.20462)} lb) muscle gain`;

      const displayDesired =
        weightUnit === "kg"
          ? `${targetWeight} kg`
          : `${Math.round(targetWeight * 2.20462)} lb`;

      return (
        <OnboardingLayout
          step={9}
          total={TOTAL_STEPS}
          title="What is your desired goal weight?"
          subtitle="Set an ambitious but realistic target you want to reach and sustain."
          onContinue={goNext}
          continueDisabled={!data.desired_weight_kg}
        >
          <View style={pickerStyles.valuePill}>
            <Ionicons
              name="flag-outline"
              size={18}
              color={colors.accent || "#FF5E00"}
            />
            <Text style={pickerStyles.valuePillText}>{displayDesired}</Text>
          </View>
          <View style={pickerStyles.deltaBadge}>
            <Text style={pickerStyles.deltaText}>{diffText}</Text>
          </View>
          <SegmentedToggle
            options={[
              { label: "kg", value: "kg", testID: "unit-kg-desired" },
              { label: "lb", value: "lb", testID: "unit-lb-desired" },
            ]}
            value={weightUnit}
            onChange={(val) => setWeightUnit(val)}
          />
          <VerticalWeightPicker
            unit={weightUnit}
            weightKg={targetWeight}
            onChangeKg={(kg) => update({ desired_weight_kg: kg })}
            testID="vertical-desired-weight-picker"
          />
        </OnboardingLayout>
      );
    }

    case 10: {
      const diff = Math.abs(
        (data.weight_kg ?? 70) - (data.desired_weight_kg ?? 65),
      );
      const isMaintain = data.goal === "maintain" || diff < 0.1;
      const isGain = data.goal === "gain";

      const titleText = isMaintain
        ? "Maintaining peak metabolic health is totally achievable!"
        : isGain
        ? `Gaining ${diff.toFixed(0)} kg of lean mass is a realistic target!`
        : `Losing ${diff.toFixed(0)} kg is a realistic target — you've got this!`;

      return (
        <OnboardingLayout
          step={10}
          total={TOTAL_STEPS}
          title={titleText}
          subtitle="90% of Caliwo users report noticeable physical changes in their first 2 weeks."
          onContinue={goNext}
        >
          <View style={{ alignItems: "center", marginTop: 20 }}>
            <View style={styles.celebrateBadge}>
              <Ionicons
                name="checkmark-circle"
                size={70}
                color={colors.accent || "#FF5E00"}
              />
            </View>
            <Text style={styles.bigStat}>+3× More Likely</Text>
            <Text style={styles.smallStat}>
              to reach and sustain your goal with Caliwo's autonomous AI guidance than on your own
            </Text>

            <View style={styles.statGridRow}>
              <View style={styles.statCard}>
                <Text style={styles.statCardNum}>90%</Text>
                <Text style={styles.statCardLabel}>Notice change in 14 days</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statCardNum}>80%</Text>
                <Text style={styles.statCardLabel}>Keep weight off at 6 mos</Text>
              </View>
            </View>
          </View>
        </OnboardingLayout>
      );
    }

    case 11: {
      const weightDiff = Math.abs(
        (data.weight_kg ?? 70) - (data.desired_weight_kg ?? 65),
      );
      const getSpeedTime = (rate: number) => {
        if (data.goal === "maintain" || weightDiff < 0.1) return "60 days";
        const weeks = Math.max(1, Math.round(weightDiff / rate));
        const days = weeks * 7;
        const months = (days / 30.4).toFixed(1);
        return parseFloat(months) >= 1
          ? `${months} months (${days} days)`
          : `${days} days (${weeks}w)`;
      };

      return (
        <OnboardingLayout
          step={11}
          total={TOTAL_STEPS}
          title="How fast do you want to reach your goal?"
          subtitle="Choose a realistic, healthy pace that fits your daily lifestyle."
          onContinue={goNext}
          continueDisabled={!data.target_speed}
        >
          {[
            {
              k: "slow",
              t: "Slow & Steady",
              s: `0.25 kg / week · Est. ${getSpeedTime(0.25)}`,
              customIcon: (active: boolean) => (
                <MaterialCommunityIcons
                  name="turtle"
                  size={24}
                  color={active ? colors.accent || "#FF5E00" : colors.textSecondary}
                />
              ),
            },
            {
              k: "recommended",
              t: "Recommended (Balanced)",
              s: `0.50 kg / week · Est. ${getSpeedTime(0.5)}`,
              badge: "RECOMMENDED",
              icon: "star" as keyof typeof Ionicons.glyphMap,
            },
            {
              k: "fast",
              t: "Fast Track",
              s: `0.75 kg / week · Est. ${getSpeedTime(0.75)}`,
              customIcon: (active: boolean) => (
                <MaterialCommunityIcons
                  name="rabbit"
                  size={24}
                  color={active ? colors.accent || "#FF5E00" : colors.textSecondary}
                />
              ),
            },
          ].map((o) => (
            <SelectionCard
              key={o.k}
              title={o.t}
              subtitle={o.s}
              icon={o.icon}
              badge={o.badge}
              customIcon={
                o.customIcon
                  ? o.customIcon(data.target_speed === o.k)
                  : undefined
              }
              active={data.target_speed === o.k}
              onPress={() => update({ target_speed: o.k })}
              testID={`speed-${o.k}`}
            />
          ))}
        </OnboardingLayout>
      );
    }

    case 12:
      return (
        <OnboardingLayout
          step={12}
          total={TOTAL_STEPS}
          title="Lose twice as much weight with Caliwo vs on your own"
          subtitle="Based on a 12-week self-reported user study."
          onContinue={goNext}
        >
          <ComparisonChart />
        </OnboardingLayout>
      );

    case 13: {
      const selected = new Set(data.obstacles ?? []);
      const toggle = (x: string) => {
        const s = new Set(selected);
        if (s.has(x)) {
          s.delete(x);
        } else {
          s.add(x);
        }
        update({ obstacles: Array.from(s) });
      };
      return (
        <OnboardingLayout
          step={13}
          total={TOTAL_STEPS}
          title="What's stopping you from reaching your goals?"
          subtitle={
            selected.size > 0
              ? `${selected.size} selected · Caliwo tailors your plan around these.`
              : "Select all that apply."
          }
          onContinue={goNext}
        >
          <View style={{ gap: 2 }}>
            {OBSTACLES.map((o) => (
              <SelectionCard
                key={o.label}
                title={o.label}
                subtitle={o.sub}
                icon={o.icon}
                active={selected.has(o.label)}
                onPress={() => toggle(o.label)}
                testID={`obstacle-${o.label.toLowerCase().replace(/\s+/g, "-")}`}
              />
            ))}
          </View>
        </OnboardingLayout>
      );
    }

    case 14:
      return (
        <OnboardingLayout
          step={14}
          total={TOTAL_STEPS}
          title="Do you follow a specific diet?"
          subtitle="We calibrate your macronutrient split around your preferences."
          onContinue={goNext}
          continueDisabled={!data.diet}
        >
          {DIETS.map((d) => (
            <SelectionCard
              key={d.key}
              title={d.label}
              subtitle={d.sub}
              badge={d.badge}
              icon={d.icon}
              active={data.diet === d.key}
              onPress={() => update({ diet: d.key })}
              testID={`diet-${d.key}`}
            />
          ))}
        </OnboardingLayout>
      );

    case 15: {
      const selected = new Set(data.accomplishments ?? []);
      const toggle = (x: string) => {
        const s = new Set(selected);
        if (s.has(x)) {
          s.delete(x);
        } else {
          s.add(x);
        }
        update({ accomplishments: Array.from(s) });
      };
      return (
        <OnboardingLayout
          step={15}
          total={TOTAL_STEPS}
          title="What would you like to accomplish?"
          subtitle={
            selected.size > 0
              ? `${selected.size} selected · We'll optimize your daily blueprint for these.`
              : "Choose one or more that matter most to you."
          }
          onContinue={goNext}
        >
          {ACCOMPLISHMENTS.map((a) => (
            <SelectionCard
              key={a.label}
              title={a.label}
              subtitle={a.sub}
              badge={a.badge}
              icon={a.icon}
              active={selected.has(a.label)}
              onPress={() => toggle(a.label)}
              testID={`accomplish-${a.label.slice(0, 8).toLowerCase().replace(/\s+/g, "-")}`}
            />
          ))}
        </OnboardingLayout>
      );
    }

    case 16:
      return (
        <OnboardingLayout
          step={16}
          total={TOTAL_STEPS}
          title="You have great potential to crush your goal"
          subtitle="Your projected weight transition — you'll burn fat like crazy!"
          onContinue={goNext}
        >
          <WeightProjectionChart data={data} />
        </OnboardingLayout>
      );

    case 17:
      return (
        <OnboardingLayout
          step={17}
          total={TOTAL_STEPS}
          title="Your privacy and health data are 100% protected"
          subtitle="We engineer Caliwo with bank-level encryption. Your biometric data is strictly yours."
          onContinue={goNext}
        >
          <View style={{ alignItems: "center", marginTop: 16 }}>
            <View style={styles.privacyShieldWrap}>
              <Ionicons
                name="shield-checkmark"
                size={54}
                color={colors.accent || "#FF5E00"}
              />
            </View>

            <View style={styles.privacyCard}>
              {[
                {
                  icon: "lock-closed" as keyof typeof Ionicons.glyphMap,
                  title: "End-to-End Encrypted",
                  desc: "All health & meal logs are encrypted in transit and at rest.",
                },
                {
                  icon: "eye-off" as keyof typeof Ionicons.glyphMap,
                  title: "Never Sold or Shared",
                  desc: "We never monetize your private health metrics or sell to advertisers.",
                },
                {
                  icon: "heart-circle" as keyof typeof Ionicons.glyphMap,
                  title: "Clinical Accuracy",
                  desc: "Formulas based on peer-reviewed Mifflin-St Jeor nutrition science.",
                },
              ].map((item, idx) => (
                <View
                  key={item.title}
                  style={[
                    styles.privacyRow,
                    idx === 2 && { borderBottomWidth: 0 },
                  ]}
                >
                  <View style={styles.privacyRowIcon}>
                    <Ionicons
                      name={item.icon}
                      size={20}
                      color={colors.accent || "#FF5E00"}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.privacyRowTitle}>{item.title}</Text>
                    <Text style={styles.privacyRowDesc}>{item.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </OnboardingLayout>
      );

    case 18:
      return (
        <OnboardingLayout
          step={18}
          total={TOTAL_STEPS}
          title="Add calories burned back to your daily goal?"
          subtitle="When enabled, calories burned during tracked workouts increase your daily food budget."
          onContinue={goNext}
          continueDisabled={data.add_burned_back === undefined}
        >
          {[
            {
              v: true,
              t: "Yes, add burned calories back",
              s: "Dynamic target · Automatically eats back calories burned during intense workouts",
              icon: "flame" as keyof typeof Ionicons.glyphMap,
              badge: "ATHLETE FRIENDLY",
            },
            {
              v: false,
              t: "No, keep daily target constant",
              s: "Fixed target · Preserves a larger deficit for maximum, steady fat loss",
              icon: "lock-closed" as keyof typeof Ionicons.glyphMap,
              badge: "RECOMMENDED FOR FAT LOSS",
            },
          ].map((o) => (
            <SelectionCard
              key={String(o.v)}
              title={o.t}
              subtitle={o.s}
              icon={o.icon}
              badge={o.badge}
              active={data.add_burned_back === o.v}
              onPress={() => update({ add_burned_back: o.v })}
              testID={`burned-${String(o.v)}`}
            />
          ))}
        </OnboardingLayout>
      );

    case 19:
      return (
        <OnboardingLayout
          step={19}
          total={TOTAL_STEPS}
          title="Rollover extra calories to the next day?"
          subtitle="Smart calorie banking allows up to 200 unused calories to carry forward."
          onContinue={goNext}
          continueDisabled={data.rollover_calories === undefined}
        >
          {[
            {
              v: true,
              t: "Yes, enable calorie rollover",
              s: "Smart banking · Up to 200 unused calories bank forward into weekends or dinner",
              icon: "wallet" as keyof typeof Ionicons.glyphMap,
              badge: "FLEXIBLE LIFESTYLE",
            },
            {
              v: false,
              t: "No, reset every day at midnight",
              s: "Strict discipline · Fresh start every morning with zero carryover",
              icon: "refresh" as keyof typeof Ionicons.glyphMap,
            },
          ].map((o) => (
            <SelectionCard
              key={String(o.v)}
              title={o.t}
              subtitle={o.s}
              icon={o.icon}
              badge={o.badge}
              active={data.rollover_calories === o.v}
              onPress={() => update({ rollover_calories: o.v })}
              testID={`rollover-${String(o.v)}`}
            />
          ))}
        </OnboardingLayout>
      );

    case 20:
      return (
        <OnboardingLayout
          step={20}
          total={TOTAL_STEPS}
          title="Join over 10 million people like you"
          subtitle="Rated 4.9/5 stars across 300,000+ member reviews globally."
          onContinue={goNext}
        >
          <View style={{ gap: 14 }}>
            {[
              {
                n: "Sara K.",
                initials: "SK",
                loss: "Lost 9.5 kg",
                t: "I finally understand what I eat. Caliwo's photo recognition is scary accurate and keeps me accountable without tedious manual logging.",
              },
              {
                n: "Mike R.",
                initials: "MR",
                loss: "Lost 14 kg",
                t: "Down 14kg in 4 months. The AI coach felt like having a clinical nutritionist in my pocket 24/7.",
              },
              {
                n: "Priya S.",
                initials: "PS",
                loss: "Recomp & Toned",
                t: "Best health app I've ever installed. Beautiful, easy to stick to, and completely personalized.",
              },
            ].map((r) => (
              <View key={r.n} style={styles.reviewCard}>
                <View style={styles.reviewHeaderRow}>
                  <View style={styles.reviewAvatar}>
                    <Text style={styles.reviewAvatarText}>{r.initials}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reviewName}>{r.n}</Text>
                    <View style={styles.reviewVerifiedRow}>
                      <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                      <Text style={styles.reviewVerifiedText}>Verified Member · {r.loss}</Text>
                    </View>
                  </View>
                  <View style={styles.starsRow}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Ionicons
                        key={s}
                        name="star"
                        size={14}
                        color="#F59E0B"
                      />
                    ))}
                  </View>
                </View>
                <Text style={styles.reviewText}>"{r.t}"</Text>
              </View>
            ))}
          </View>
        </OnboardingLayout>
      );

    case 21:
      return <CommitmentScreen stepNum={21} data={data} onDone={goNext} />;

    case 22:
      return (
        <GeneratingScreen
          data={data}
          onDone={(plan) => {
            update(plan);
            goNext();
          }}
        />
      );

    case 23: {
      const plan = computePlan(data);
      return (
        <OnboardingLayout
          step={23}
          total={TOTAL_STEPS}
          title={
            data.goal === "lose"
              ? `Reach ${data.desired_weight_kg ?? 65} kg in ${plan.duration_text}!`
              : data.goal === "gain"
                ? `Reach ${data.desired_weight_kg ?? 75} kg in ${plan.duration_text}!`
                : "Your custom plan is ready"
          }
          subtitle={`Target completion: ${plan.target_date_formatted} · Follow this daily blueprint.`}
          onContinue={goNext}
          continueLabel="See how Caliwo helps"
        >
          <PlanSummary data={data} />
        </OnboardingLayout>
      );
    }

    case 24:
      return (
        <OnboardingLayout
          step={24}
          total={TOTAL_STEPS}
          title="How Caliwo helps you reach your goals"
          onContinue={goNext}
          continueLabel="Continue"
        >
          <ComparisonList />
          <Text
            style={[styles.smallStat, { marginTop: 24, textAlign: "center" }]}
          >
            As featured in
          </Text>
          <View style={styles.pressRow}>
            {["THE TIMES", "FORBES", "ENTREPRENEUR", "TECHCRUNCH"].map((n) => (
              <Text key={n} style={styles.pressName}>
                {n}
              </Text>
            ))}
          </View>
        </OnboardingLayout>
      );

    case 25:
      return (
        <OnboardingLayout
          step={25}
          total={TOTAL_STEPS}
          title="You're one tap away"
          subtitle="Create your account to save your plan and start tracking."
          onContinue={async () => {
            setSaving(true);
            try {
              if (user) {
                await save();
                const freshUser = await refresh();
                const activeUser = freshUser || user;
                const hasTaste = Boolean(
                  activeUser?.taste_onboarded ||
                  activeUser?.profile?.taste_onboarded ||
                  activeUser?.has_taste_dna ||
                  activeUser?.profile?.taste_dna?.entity_ids?.length
                );
                if (hasTaste) {
                  router.replace("/(tabs)/home");
                } else {
                  router.replace({
                    pathname: "/taste-onboarding",
                    params: { from: "onboarding" },
                  } as any);
                }
                return;
              }
            } catch (e) {
              if (__DEV__) console.warn("[onboarding] save failed:", e);
            } finally {
              setSaving(false);
            }
            router.replace("/signup");
          }}
          continueLabel={user ? "Continue" : "Create account"}
          loading={saving}
        >
          <PlanSummary data={data} />
        </OnboardingLayout>
      );

    default:
      return null;
  }
}

/* ---------------- Subcomponents ---------------- */

const { width: SCREEN_W } = Dimensions.get("window");

function TrustGraph() {
  const containerWidth = SCREEN_W - 48;
  const svgWidth = containerWidth - 32;
  const svgHeight = 220;
  const padL = 36;
  const padR = 20;
  const padT = 24;
  const padB = 34;
  const chartW = svgWidth - padL - padR;
  const chartH = svgHeight - padT - padB;

  // Normalized points 0.0 to 1.0 (Month 1 to Month 6)
  const caliwoPoints = [0.2, 0.42, 0.62, 0.72, 0.77, 0.8];
  const industryPoints = [0.65, 0.46, 0.32, 0.24, 0.2, 0.19];

  const xs = caliwoPoints.map(
    (_, i) => padL + i * (chartW / (caliwoPoints.length - 1)),
  );
  const ysCaliwo = caliwoPoints.map((p) => padT + chartH * (1 - p));
  const ysIndustry = industryPoints.map((p) => padT + chartH * (1 - p));

  const curveCaliwo = xs.reduce((acc, x, i) => {
    if (i === 0) return `M${x},${ysCaliwo[i]}`;
    const cx = (xs[i - 1] + x) / 2;
    return `${acc} C${cx},${ysCaliwo[i - 1]} ${cx},${ysCaliwo[i]} ${x},${ysCaliwo[i]}`;
  }, "");

  const fillCaliwo = `${curveCaliwo} L${xs[xs.length - 1]},${padT + chartH} L${xs[0]},${padT + chartH} Z`;

  const curveIndustry = xs.reduce((acc, x, i) => {
    if (i === 0) return `M${x},${ysIndustry[i]}`;
    const cx = (xs[i - 1] + x) / 2;
    return `${acc} C${cx},${ysIndustry[i - 1]} ${cx},${ysIndustry[i]} ${x},${ysIndustry[i]}`;
  }, "");

  const yTicks = [
    { label: "80%", y: padT + chartH * (1 - 0.8) },
    { label: "60%", y: padT + chartH * (1 - 0.6) },
    { label: "40%", y: padT + chartH * (1 - 0.4) },
    { label: "20%", y: padT + chartH * (1 - 0.2) },
  ];

  const xLabels = ["Mo 1", "Mo 2", "Mo 3", "Mo 4", "Mo 5", "Mo 6"];

  return (
    <View style={trustStyles.card}>
      {/* Top Banner Stat */}
      <View style={trustStyles.statHeaderRow}>
        <View style={trustStyles.statRow}>
          <View style={trustStyles.statBadge}>
            <Ionicons
              name="trending-up"
              size={18}
              color={colors.accent || "#FF5E00"}
            />
          </View>
          <View>
            <Text style={trustStyles.statValue}>80% Adherence</Text>
            <Text style={trustStyles.statLabel}>
              Still active & progressing at 6 months
            </Text>
          </View>
        </View>
        <View style={trustStyles.multiplierBadge}>
          <Ionicons name="sparkles" size={12} color="#059669" />
          <Text style={trustStyles.multiplierText}>+4.2× Industry</Text>
        </View>
      </View>

      {/* Legend Row */}
      <View style={trustStyles.legendRow}>
        <View style={trustStyles.legendItem}>
          <View
            style={[
              trustStyles.legendDot,
              { backgroundColor: colors.accent || "#FF5E00" },
            ]}
          />
          <Text style={trustStyles.legendLabelBold}>With Caliwo (80%)</Text>
        </View>
        <View style={trustStyles.legendItem}>
          <View
            style={[trustStyles.legendDash, { backgroundColor: "#94A3B8" }]}
          />
          <Text style={trustStyles.legendLabelMuted}>Typical Diets (19%)</Text>
        </View>
      </View>

      {/* SVG Chart */}
      <Svg width={svgWidth} height={svgHeight}>
        <Defs>
          <SvgLinearGradient id="gradTrustArea" x1="0" y1="0" x2="0" y2="1">
            <Stop
              offset="0%"
              stopColor={colors.accent || "#FF5E00"}
              stopOpacity="0.25"
            />
            <Stop
              offset="100%"
              stopColor={colors.accent || "#FF5E00"}
              stopOpacity="0.0"
            />
          </SvgLinearGradient>
        </Defs>

        {/* Horizontal grid lines & Y labels */}
        {yTicks.map((t, i) => (
          <React.Fragment key={i}>
            <Line
              x1={padL}
              y1={t.y}
              x2={padL + chartW}
              y2={t.y}
              stroke="#E2E8F0"
              strokeWidth={1}
              strokeDasharray="4,4"
            />
            <SvgText
              x={padL - 8}
              y={t.y + 4}
              fontSize="11"
              fontWeight="700"
              fill="#94A3B8"
              textAnchor="end"
            >
              {t.label}
            </SvgText>
          </React.Fragment>
        ))}

        {/* Baseline */}
        <Line
          x1={padL}
          y1={padT + chartH}
          x2={padL + chartW}
          y2={padT + chartH}
          stroke="#E2E8F0"
          strokeWidth={1.2}
        />

        {/* Gradient fill area under Caliwo curve */}
        <Path d={fillCaliwo} fill="url(#gradTrustArea)" />

        {/* Typical Diets curve (Dashed gray) */}
        <Path
          d={curveIndustry}
          stroke="#94A3B8"
          strokeWidth={2.2}
          fill="none"
          strokeDasharray="5,5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Caliwo curve (Solid vibrant accent) */}
        <Path
          d={curveCaliwo}
          stroke={colors.accent || "#FF5E00"}
          strokeWidth={3.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Typical Diets endpoint */}
        <Circle
          cx={xs[xs.length - 1]}
          cy={ysIndustry[ysIndustry.length - 1]}
          r={5}
          fill="#FFFFFF"
          stroke="#94A3B8"
          strokeWidth={2.5}
        />

        {/* Caliwo points */}
        {xs.map((x, i) => (
          <Circle
            key={i}
            cx={x}
            cy={ysCaliwo[i]}
            r={i === xs.length - 1 ? 6.5 : 4.5}
            fill="#FFFFFF"
            stroke={colors.accent || "#FF5E00"}
            strokeWidth={i === xs.length - 1 ? 3 : 2}
          />
        ))}

        {/* X-axis ticks */}
        {xs.map((x, i) => (
          <SvgText
            key={i}
            x={x}
            y={padT + chartH + 20}
            fontSize="11"
            fontWeight="700"
            fill="#64748B"
            textAnchor="middle"
          >
            {xLabels[i]}
          </SvgText>
        ))}
      </Svg>

      {/* 3 Pillar Trust Badges Below */}
      <View style={trustStyles.pillarsRow}>
        <View style={trustStyles.pillarCard}>
          <Ionicons
            name="shield-checkmark"
            size={16}
            color={colors.accent || "#FF5E00"}
          />
          <Text style={trustStyles.pillarTitle}>Adaptive Deficit</Text>
          <Text style={trustStyles.pillarDesc}>No starvation</Text>
        </View>
        <View style={trustStyles.pillarCard}>
          <Ionicons
            name="wallet-outline"
            size={16}
            color={colors.accent || "#FF5E00"}
          />
          <Text style={trustStyles.pillarTitle}>Calorie Bank</Text>
          <Text style={trustStyles.pillarDesc}>Rollover weekends</Text>
        </View>
        <View style={trustStyles.pillarCard}>
          <Ionicons name="repeat" size={16} color={colors.accent || "#FF5E00"} />
          <Text style={trustStyles.pillarTitle}>Habit Science</Text>
          <Text style={trustStyles.pillarDesc}>Built to last</Text>
        </View>
      </View>
    </View>
  );
}

function ComparisonChart() {
  const containerWidth = SCREEN_W - 48;
  const svgWidth = containerWidth - 32;
  const svgHeight = 220;

  const padL = 48;
  const padR = 24;
  const padT = 30;
  const padB = 40;

  const chartW = svgWidth - padL - padR;
  const chartH = svgHeight - padT - padB;

  const yValues = [
    { label: "0 kg", y: padT },
    { label: "-4 kg", y: padT + chartH * 0.333 },
    { label: "-8 kg", y: padT + chartH * 0.666 },
    { label: "-12 kg", y: padT + chartH },
  ];

  const xTicks = [
    { label: "Wk 1", x: padL },
    { label: "Wk 4", x: padL + chartW * 0.333 },
    { label: "Wk 8", x: padL + chartW * 0.666 },
    { label: "Wk 12", x: padL + chartW },
  ];

  // Caliwo curve (0kg -> -12kg)
  const curveNutriva = `M ${padL},${padT} C ${padL + chartW * 0.35},${padT + chartH * 0.15} ${padL + chartW * 0.65},${padT + chartH * 0.75} ${padL + chartW},${padT + chartH}`;
  const fillNutriva = `${curveNutriva} L ${padL + chartW},${padT + chartH} L ${padL},${padT + chartH} Z`;

  // On your own curve (0kg -> -6kg)
  const curveOwn = `M ${padL},${padT} C ${padL + chartW * 0.35},${padT + chartH * 0.1} ${padL + chartW * 0.65},${padT + chartH * 0.35} ${padL + chartW},${padT + chartH * 0.5}`;

  return (
    <View style={trustStyles.card}>
      {/* Legend Header */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View
            style={{
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: colors.accent || "#FF6B00",
            }}
          />
          <Text style={{ fontSize: 14, fontWeight: "800", color: "#0F172A" }}>
            With Caliwo
          </Text>
          <View
            style={{
              backgroundColor: "rgba(255, 94, 0, 0.1)",
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 6,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: "800",
                color: colors.accent || "#FF5E00",
                letterSpacing: 0.5,
              }}
            >
              2× FASTER
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View
            style={{
              width: 12,
              height: 4,
              borderRadius: 2,
              backgroundColor: "#94A3B8",
            }}
          />
          <Text style={{ fontSize: 14, fontWeight: "600", color: "#64748B" }}>
            On your own
          </Text>
        </View>
      </View>

      {/* SVG Chart */}
      <Svg width={svgWidth} height={svgHeight}>
        <Defs>
          <SvgLinearGradient id="gradNutrivaStep12" x1="0" y1="0" x2="0" y2="1">
            <Stop
              offset="0%"
              stopColor={colors.accent || "#FF6B00"}
              stopOpacity="0.28"
            />
            <Stop
              offset="100%"
              stopColor={colors.accent || "#FF6B00"}
              stopOpacity="0.0"
            />
          </SvgLinearGradient>
        </Defs>

        {/* Horizontal Grid Lines and Y-Axis Labels */}
        {yValues.map((item, i) => (
          <React.Fragment key={i}>
            <Line
              x1={padL}
              y1={item.y}
              x2={padL + chartW}
              y2={item.y}
              stroke="#E2E8F0"
              strokeWidth={1}
              strokeDasharray="4,4"
            />
            <SvgText
              x={padL - 10}
              y={item.y + 4}
              fontSize="12"
              fontWeight="700"
              fill="#64748B"
              textAnchor="end"
            >
              {item.label}
            </SvgText>
          </React.Fragment>
        ))}

        {/* X-Axis Labels */}
        {xTicks.map((item, i) => (
          <SvgText
            key={i}
            x={item.x}
            y={padT + chartH + 24}
            fontSize="12"
            fontWeight="700"
            fill="#64748B"
            textAnchor="middle"
          >
            {item.label}
          </SvgText>
        ))}

        {/* Gradient Fill under Nutriva Curve */}
        <Path d={fillNutriva} fill="url(#gradNutrivaStep12)" />

        {/* On Your Own Curve (Dashed Slate Line) */}
        <Path
          d={curveOwn}
          stroke="#94A3B8"
          strokeWidth={2.5}
          fill="none"
          strokeDasharray="6,6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Nutriva Curve (Solid Accent Line) */}
        <Path
          d={curveNutriva}
          stroke={colors.accent || "#FF6B00"}
          strokeWidth={3.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* On Your Own Endpoint Circle */}
        <Circle
          cx={padL + chartW}
          cy={padT + chartH * 0.5}
          r={5}
          fill="#FFFFFF"
          stroke="#94A3B8"
          strokeWidth={2.5}
        />

        {/* Nutriva Endpoint Circle */}
        <Circle
          cx={padL + chartW}
          cy={padT + chartH}
          r={6.5}
          fill="#FFFFFF"
          stroke={colors.accent || "#FF6B00"}
          strokeWidth={3}
        />
      </Svg>

      {/* Comparison Metrics Under Chart */}
      <View style={trustStyles.comparisonStatRow}>
        <View style={trustStyles.comparisonStatCard}>
          <Text style={trustStyles.comparisonStatBigCaliwo}>-12.0 kg</Text>
          <Text style={trustStyles.comparisonStatTitle}>With Caliwo</Text>
          <Text style={trustStyles.comparisonStatSub}>91% avoid rebound</Text>
        </View>
        <View style={trustStyles.comparisonStatDivider} />
        <View style={trustStyles.comparisonStatCard}>
          <Text style={trustStyles.comparisonStatBigOwn}>-6.0 kg</Text>
          <Text style={trustStyles.comparisonStatTitle}>On Your Own</Text>
          <Text style={trustStyles.comparisonStatSub}>Frequent plateau</Text>
        </View>
      </View>
    </View>
  );
}

function WeightProjectionChart({ data }: { data: any }) {
  const containerWidth = SCREEN_W - 48;
  const svgWidth = containerWidth - 32;
  const svgHeight = 200;
  const padL = 24;
  const padR = 24;
  const padT = 24;
  const padB = 34;
  const chartW = svgWidth - padL - padR;
  const chartH = svgHeight - padT - padB;

  const start = data.weight_kg ?? 70;
  const end = data.desired_weight_kg ?? 65;
  const isLoss = start >= end;
  const diff = Math.abs(start - end);

  const curvePath = `M${padL},${padT} C${padL + chartW * 0.35},${padT + chartH * 0.25} ${padL + chartW * 0.65},${padT + chartH * 0.75} ${padL + chartW},${padT + chartH}`;
  const fillPath = `${curvePath} L${padL + chartW},${padT + chartH} L${padL},${padT + chartH} Z`;

  return (
    <View style={trustStyles.card}>
      {/* Starting vs Goal Header */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          paddingBottom: 14,
          borderBottomWidth: 1,
          borderBottomColor: "#F1F5F9",
        }}
      >
        <View>
          <Text style={styles.axisLabel}>TODAY</Text>
          <Text style={styles.bigStat}>{start} kg</Text>
        </View>

        <View style={pickerStyles.deltaBadge}>
          <Ionicons
            name={isLoss ? "flame" : "trending-up"}
            size={14}
            color={colors.accent || "#FF5E00"}
          />
          <Text style={pickerStyles.deltaText}>
            {diff.toFixed(0)} kg {isLoss ? "Fat Loss" : "Gain"}
          </Text>
        </View>

        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.axisLabel}>GOAL TARGET</Text>
          <Text style={[styles.bigStat, { color: colors.accent }]}>
            {end} kg
          </Text>
        </View>
      </View>

      {/* SVG Chart */}
      <Svg width={svgWidth} height={svgHeight}>
        <Defs>
          <SvgLinearGradient id="gradWeightProj" x1="0" y1="0" x2="0" y2="1">
            <Stop
              offset="0%"
              stopColor={colors.accent || "#FF5E00"}
              stopOpacity="0.25"
            />
            <Stop
              offset="100%"
              stopColor={colors.accent || "#FF5E00"}
              stopOpacity="0.0"
            />
          </SvgLinearGradient>
        </Defs>

        {/* Baseline guideline */}
        <Line
          x1={padL}
          y1={padT + chartH}
          x2={padL + chartW}
          y2={padT + chartH}
          stroke="#E2E8F0"
          strokeWidth={1.5}
          strokeDasharray="4,4"
        />

        {/* Gradient fill */}
        <Path d={fillPath} fill="url(#gradWeightProj)" />

        {/* Main projection curve */}
        <Path
          d={curvePath}
          stroke={colors.accent || "#FF5E00"}
          strokeWidth={3.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Halfway milestone point */}
        <Circle
          cx={padL + chartW * 0.5}
          cy={padT + chartH * 0.5}
          r={5}
          fill="#FFFFFF"
          stroke={colors.accent || "#FF5E00"}
          strokeWidth={2.5}
        />

        {/* Start Point */}
        <Circle
          cx={padL}
          cy={padT}
          r={6}
          fill="#0F172A"
          stroke="#FFFFFF"
          strokeWidth={2}
        />

        {/* Goal Point */}
        <Circle
          cx={padL + chartW}
          cy={padT + chartH}
          r={7}
          fill="#FFFFFF"
          stroke={colors.accent || "#FF5E00"}
          strokeWidth={3}
        />

        {/* X-axis labels */}
        <SvgText
          x={padL}
          y={padT + chartH + 22}
          fontSize="11"
          fontWeight="700"
          fill="#64748B"
          textAnchor="start"
        >
          Day 1
        </SvgText>
        <SvgText
          x={padL + chartW * 0.5}
          y={padT + chartH + 22}
          fontSize="11"
          fontWeight="700"
          fill="#64748B"
          textAnchor="middle"
        >
          Halfway
        </SvgText>
        <SvgText
          x={padL + chartW}
          y={padT + chartH + 22}
          fontSize="11"
          fontWeight="800"
          fill={colors.accent || "#FF5E00"}
          textAnchor="end"
        >
          Goal Reached
        </SvgText>
      </Svg>

      {/* Trust Quote Card */}
      <View style={trustStyles.projectionNoteCard}>
        <Ionicons name="checkmark-circle" size={18} color="#10B981" />
        <Text style={trustStyles.projectionNoteText}>
          Calibrated via Mifflin-St Jeor metabolic model. 93% of compliant members reach their milestone within 10 days of forecast.
        </Text>
      </View>
    </View>
  );
}

function CommitmentScreen({
  stepNum,
  data,
  onDone,
}: {
  stepNum: number;
  data: any;
  onDone: () => void;
}) {
  const [pressing, setPressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = React.useRef<any>(null);
  const plan = computePlan(data);

  const start = () => {
    setPressing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    let p = 0;
    timerRef.current = setInterval(() => {
      p += 0.05;
      setProgress(p);
      if (p >= 1) {
        clearInterval(timerRef.current);
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
        onDone();
      }
    }, 100);
  };

  const stop = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPressing(false);
    setProgress(0);
  };

  const diff = Math.abs(
    (data.weight_kg ?? 70) - (data.desired_weight_kg ?? 65),
  );
  const isLoss = (data.weight_kg ?? 70) >= (data.desired_weight_kg ?? 65);

  return (
    <OnboardingLayout
      step={stepNum}
      total={TOTAL_STEPS}
      title="Commit to your goal"
      subtitle={`"I am committed to reaching ${data.desired_weight_kg ?? 65} kg in ${plan.duration_text} (by ${plan.target_date_formatted}) with Caliwo."`}
      hideContinue
    >
      <View style={{ alignItems: "center", marginTop: 12 }}>
        {/* Pledge Card */}
        <View style={styles.pledgeCard}>
          <View style={styles.pledgeHeaderRow}>
            <View style={styles.pledgeSeal}>
              <Ionicons
                name="shield-checkmark"
                size={20}
                color={colors.accent || "#FF5E00"}
              />
            </View>
            <Text style={styles.pledgeHeaderText}>CALIWO MEMBER PLEDGE</Text>
          </View>

          <Text style={styles.pledgeQuote}>
            "I commit to transforming my health, eating with mindful intention, and reaching my goal of {data.desired_weight_kg ?? 65} kg."
          </Text>

          <View style={styles.pledgeDivider} />

          <View style={styles.pledgeTargetRow}>
            <View style={styles.pledgeTargetCol}>
              <Text style={styles.pledgeTargetLabel}>TARGET WEIGHT</Text>
              <Text style={styles.pledgeTargetVal}>
                {data.desired_weight_kg ?? 65} kg
              </Text>
            </View>
            <View style={styles.pledgeTargetDivider} />
            <View style={styles.pledgeTargetCol}>
              <Text style={styles.pledgeTargetLabel}>TIMELINE</Text>
              <Text style={styles.pledgeTargetVal}>{plan.duration_text}</Text>
            </View>
            <View style={styles.pledgeTargetDivider} />
            <View style={styles.pledgeTargetCol}>
              <Text style={styles.pledgeTargetLabel}>
                {isLoss ? "FAT LOSS" : "GAIN"}
              </Text>
              <Text
                style={[
                  styles.pledgeTargetVal,
                  { color: colors.accent || "#FF5E00" },
                ]}
              >
                {diff.toFixed(0)} kg
              </Text>
            </View>
          </View>

          <View style={styles.pledgeChecklist}>
            {[
              "Log meals daily with 60-second photo accuracy",
              "Follow weekly AI metabolic adjustments",
              "Prioritize sustainable health over crash fixes",
            ].map((item, idx) => (
              <View key={idx} style={styles.pledgeCheckRow}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={styles.pledgeCheckText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Hold to Commit Interactive CTA */}
        <Pressable
          onPressIn={start}
          onPressOut={stop}
          style={[
            styles.commitBtn,
            pressing ? { transform: [{ scale: 0.98 }] } : null,
          ]}
          testID="commit-button"
        >
          <View style={[styles.commitFill, { width: `${progress * 100}%` }]} />
          <View style={styles.commitBtnContent}>
            <Ionicons
              name={pressing ? "lock-closed" : "finger-print"}
              size={22}
              color={colors.white}
            />
            <Text style={styles.commitBtnText}>
              {pressing
                ? `Hold to seal… ${Math.round(progress * 100)}%`
                : "Press & hold to seal commitment"}
            </Text>
          </View>
        </Pressable>
        <Text style={styles.commitHintText}>
          Hold down for 2 seconds to officially unlock your plan
        </Text>
      </View>
    </OnboardingLayout>
  );
}

function GeneratingScreen({
  data,
  onDone,
}: {
  data: any;
  onDone: (plan: any) => void;
}) {
  const [pct, setPct] = React.useState(0);
  const plan = computePlan(data);

  React.useEffect(() => {
    let p = 0;
    const t = setInterval(() => {
      p += 4;
      setPct(p);
      if (p >= 100) {
        clearInterval(t);
        onDone(plan);
      }
    }, 80);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getStatusText = (val: number) => {
    if (val < 25) return "Calculating Basal Metabolic Rate (BMR)...";
    if (val < 50) return "Balancing protein, carb & lipid ratios...";
    if (val < 75) return "Structuring weekly deficit & habit timeline...";
    if (val < 99) return "Synthesizing 24/7 AI Coach blueprint...";
    return "Plan generated successfully!";
  };

  const stepsList = [
    {
      title: "Calorie target",
      sub: `${plan.daily_calories} kcal daily energy baseline`,
    },
    {
      title: "Macronutrient split",
      sub: `${plan.daily_protein_g}g protein · ${plan.daily_carbs_g}g carbs · ${plan.daily_fat_g}g fat`,
    },
    {
      title: `Timeline roadmap: ${plan.duration_text}`,
      sub: `Target completion date: ${plan.target_date_formatted}`,
    },
    {
      title: "AI Vision & coaching engine",
      sub: "3-second instant photo meal recognition",
    },
  ];

  return (
    <OnboardingLayout
      step={22}
      total={TOTAL_STEPS}
      title="Generating your custom AI plan"
      subtitle="Synthesizing your biometric inputs and metabolic targets…"
      hideContinue
      hideBack
    >
      <View style={{ alignItems: "center", marginTop: 24 }}>
        <View style={styles.ringContainer}>
          <Ring size={200} stroke={14} progress={pct / 100} color={colors.accent}>
            <Text style={styles.genPct}>{pct}%</Text>
            <Text style={styles.genLabel}>
              {pct >= 100 ? "COMPLETE" : "AI COMPUTING"}
            </Text>
          </Ring>
        </View>

        {/* Live dynamic status ticker */}
        <View style={styles.tickerPill}>
          <Ionicons
            name="sparkles"
            size={14}
            color={colors.accent || "#FF5E00"}
          />
          <Text style={styles.tickerText}>{getStatusText(pct)}</Text>
        </View>

        {/* 4 Checklist Cards */}
        <View style={{ marginTop: 24, gap: 10, width: "100%" }}>
          {stepsList.map((item, i) => {
            const isDone = pct >= (i + 1) * 25;
            const isCurrent = pct >= i * 25 && pct < (i + 1) * 25;

            return (
              <View
                key={item.title}
                style={[
                  styles.genRow,
                  isCurrent && {
                    borderColor: colors.accent || "#FF5E00",
                    backgroundColor: "#FFF8F3",
                  },
                ]}
              >
                <View
                  style={[
                    styles.genIconWrap,
                    isDone && { backgroundColor: "rgba(16, 185, 129, 0.1)" },
                    isCurrent && { backgroundColor: "rgba(255, 94, 0, 0.1)" },
                  ]}
                >
                  <Ionicons
                    name={
                      isDone
                        ? "checkmark-circle"
                        : isCurrent
                          ? "sync"
                          : "ellipse-outline"
                    }
                    size={20}
                    color={
                      isDone
                        ? "#10B981"
                        : isCurrent
                          ? colors.accent || "#FF5E00"
                          : "#94A3B8"
                    }
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: isDone || isCurrent ? "#0F172A" : "#64748B",
                      fontWeight: "800",
                      fontSize: 14,
                    }}
                  >
                    {item.title}
                  </Text>
                  <Text
                    style={{
                      color: isCurrent ? colors.accent : "#64748B",
                      fontSize: 11,
                      fontWeight: "500",
                      marginTop: 2,
                    }}
                  >
                    {item.sub}
                  </Text>
                </View>
                {isDone && (
                  <View style={styles.genDonePill}>
                    <Text style={styles.genDoneText}>READY</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </View>
    </OnboardingLayout>
  );
}

function PlanSummary({ data }: { data: any }) {
  const plan = computePlan(data);
  const cal = data.daily_calories ?? plan.daily_calories;
  const p = data.daily_protein_g ?? plan.daily_protein_g;
  const c = data.daily_carbs_g ?? plan.daily_carbs_g;
  const f = data.daily_fat_g ?? plan.daily_fat_g;
  const durationText = data.duration_text || plan.duration_text;
  const targetDateFormatted =
    data.target_date_formatted || plan.target_date_formatted;
  const days = data.estimated_days || plan.estimated_days;
  const weightDiff =
    data.weight_diff_kg !== undefined ? data.weight_diff_kg : plan.weight_diff_kg;
  const isLoss = data.goal === "lose";
  const isGain = data.goal === "gain";

  // Macro calorie percentages
  const macroCalTotal = p * 4 + c * 4 + f * 9;
  const pPct = Math.round(((p * 4) / (macroCalTotal || 1)) * 100);
  const cPct = Math.round(((c * 4) / (macroCalTotal || 1)) * 100);
  const fPct = Math.round(((f * 9) / (macroCalTotal || 1)) * 100);

  return (
    <View style={{ gap: 14, marginTop: 6 }}>
      {/* Target Timeline Hero Card */}
      <ExpoLinearGradient
        colors={["#0F172A", "#1E293B"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.timelineHero}
      >
        <View style={styles.timelineHeaderRow}>
          <View style={styles.timelineIconBadge}>
            <Ionicons
              name="calendar"
              size={16}
              color={colors.accent || "#FF5E00"}
            />
            <Text style={styles.timelineBadgeText}>ESTIMATED TIMELINE</Text>
          </View>
          <View style={styles.timelineTargetDateBadge}>
            <Ionicons name="flag" size={12} color="#10B981" />
            <Text style={styles.timelineTargetDateText}>
              Target: {targetDateFormatted}
            </Text>
          </View>
        </View>

        <View style={styles.timelineMainContent}>
          <Text style={styles.timelineDurationBig}>{durationText}</Text>
          <Text style={styles.timelineGoalSub}>
            {isLoss
              ? `Lose ${weightDiff.toFixed(0)} kg with consistent healthy habits`
              : isGain
                ? `Gain ${weightDiff.toFixed(0)} kg muscle & mass sustainably`
                : `Solidify your healthy lifestyle and metabolism`}
          </Text>
        </View>

        {/* Visual Progress Milestones Bar */}
        <View style={styles.timelineBarWrap}>
          <View style={styles.timelineBarRow}>
            <View style={styles.timelineNodeActive}>
              <Text style={styles.timelineNodeText}>Start</Text>
              <Text style={styles.timelineNodeSub}>Day 1</Text>
            </View>
            <View style={styles.timelineConnector}>
              <View style={styles.timelineConnectorFill} />
            </View>
            <View style={styles.timelineNodeMid}>
              <Text style={styles.timelineNodeTextMid}>Halfway</Text>
              <Text style={styles.timelineNodeSubMid}>
                {Math.round(days / 2)}d
              </Text>
            </View>
            <View style={styles.timelineConnector}>
              <View style={styles.timelineConnectorDashed} />
            </View>
            <View style={styles.timelineNodeGoal}>
              <Ionicons name="trophy" size={11} color={colors.white} />
              <Text style={styles.timelineNodeGoalText}>Goal</Text>
              <Text style={styles.timelineNodeGoalSub}>{days}d</Text>
            </View>
          </View>
        </View>
      </ExpoLinearGradient>

      {/* Daily Calories Hero Card */}
      <View style={styles.planHero}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            marginBottom: 2,
          }}
        >
          <Ionicons name="flame" size={18} color={colors.accent || "#FF5E00"} />
          <Text style={styles.planLabel}>Daily Calorie Target</Text>
        </View>
        <Text style={styles.planBig}>{cal}</Text>
        <Text style={styles.planCalSub}>kcal / day</Text>

        <View style={styles.planDeficitPill}>
          <Ionicons
            name={isLoss ? "trending-down" : "trending-up"}
            size={12}
            color={colors.accent || "#FF5E00"}
          />
          <Text style={styles.planDeficitText}>
            {isLoss
              ? "Calibrated for a healthy, sustainable fat-loss deficit"
              : isGain
                ? "Calibrated for steady, lean muscle development"
                : "Calibrated to maintain your current metabolism"}
          </Text>
        </View>
      </View>

      {/* Macros Row */}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <PlanCard
          title="Protein"
          value={`${p}g`}
          pct={`${pPct}%`}
          role="Muscle repair"
          color={colors.accent || "#FF5E00"}
        />
        <PlanCard
          title="Carbs"
          value={`${c}g`}
          pct={`${cPct}%`}
          role="Daily energy"
          color="#0F172A"
        />
        <PlanCard
          title="Fat"
          value={`${f}g`}
          pct={`${fPct}%`}
          role="Hormones"
          color="#64748B"
        />
      </View>

      {/* Weekly Adaptive Guarantee */}
      <View style={styles.planAdaptiveCard}>
        <Ionicons name="sync" size={18} color={colors.accent || "#FF5E00"} />
        <Text style={styles.planAdaptiveText}>
          100% Adaptive: Your calorie and macro targets automatically recalibrate every week as your body adjusts.
        </Text>
      </View>
    </View>
  );
}

function PlanCard({
  title,
  value,
  pct,
  role,
  color,
}: {
  title: string;
  value: string;
  pct: string;
  role: string;
  color: string;
}) {
  return (
    <View style={styles.planCard}>
      <View style={[styles.planCardTopBar, { backgroundColor: color }]} />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 5,
          marginTop: 4,
        }}
      >
        <View style={[styles.planDot, { backgroundColor: color }]} />
        <Text style={styles.planCardLabel}>{title}</Text>
      </View>
      <Text style={styles.planCardVal}>{value}</Text>
      <View style={styles.planCardPctBadge}>
        <Text style={styles.planCardPctText}>{pct}</Text>
      </View>
      <Text style={styles.planCardRole}>{role}</Text>
    </View>
  );
}

function ComparisonList() {
  const rows = [
    { t: "Instant 3s photo meal logging", n: false, m: true },
    { t: "Personalized macro & calorie targets", n: false, m: true },
    { t: "24/7 proactive AI nutrition coach", n: false, m: true },
    { t: "Smart calorie banking & rollover", n: false, m: true },
    { t: "Zero barcode scanner paywalls", n: false, m: true },
    { t: "Weekly metabolic re-calibration", n: false, m: true },
  ];

  return (
    <View style={trustStyles.card}>
      <View style={styles.compareHeader}>
        <Text style={styles.compareCol}>Feature</Text>
        <Text style={[styles.compareCol, { color: "#94A3B8" }]}>
          Other Apps
        </Text>
        <View style={styles.compareColCaliwo}>
          <Text style={styles.compareColCaliwoText}>Caliwo</Text>
        </View>
      </View>
      {rows.map((r, i) => (
        <View
          key={r.t}
          style={[
            styles.compareRow,
            i % 2 === 1 && { backgroundColor: "#F8FAFC" },
            i === rows.length - 1 && { borderBottomWidth: 0 },
          ]}
        >
          <Text style={styles.compareCell}>{r.t}</Text>
          <View style={styles.compareCellCenter}>
            <Ionicons
              name={r.n ? "checkmark" : "close"}
              size={18}
              color={r.n ? "#0F172A" : "#CBD5E1"}
            />
          </View>
          <View style={styles.compareCellCenter}>
            <View style={styles.compareCheckPill}>
              <Ionicons
                name="checkmark-circle"
                size={22}
                color={colors.accent || "#FF5E00"}
              />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 100,
    height: 100,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  celebrateBadge: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: "rgba(255, 94, 0, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255, 94, 0, 0.2)",
  },
  statGridRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
    width: "100%",
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    ...Platform.select({
      ios: {
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
    }),
  },
  statCardNum: {
    fontSize: 24,
    fontWeight: "900",
    color: colors.accent || "#FF5E00",
    letterSpacing: -0.5,
  },
  statCardLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
    marginTop: 4,
    textAlign: "center",
    lineHeight: 15,
  },
  bigStat: {
    fontSize: 28,
    fontWeight: "900",
    color: colors.textPrimary,
    marginTop: 4,
    letterSpacing: -0.6,
  },
  smallStat: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 6,
    textAlign: "center",
    paddingHorizontal: 16,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  privacyShieldWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(255, 94, 0, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    borderWidth: 2,
    borderColor: "rgba(255, 94, 0, 0.2)",
  },
  privacyCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    ...Platform.select({
      ios: {
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
      },
      android: { elevation: 3 },
    }),
  },
  privacyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  privacyRowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255, 94, 0, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  privacyRowTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.2,
  },
  privacyRowDesc: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    lineHeight: 16,
    fontWeight: "500",
  },
  reviewCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    ...Platform.select({
      ios: {
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  reviewHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  reviewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
  reviewAvatarText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
  },
  reviewName: {
    fontSize: 14,
    color: "#0F172A",
    fontWeight: "800",
  },
  reviewVerifiedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  reviewVerifiedText: {
    fontSize: 11,
    color: "#10B981",
    fontWeight: "600",
  },
  starsRow: {
    flexDirection: "row",
    gap: 2,
  },
  reviewText: {
    fontSize: 14,
    color: "#334155",
    fontWeight: "500",
    lineHeight: 21,
    fontStyle: "italic",
  },
  legendDot: { width: 10, height: 10, borderRadius: 999 },
  legendText: { fontSize: 12, color: colors.textSecondary, fontWeight: "700" },
  axisLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  wheelCol: { flex: 1, alignItems: "center" },
  wheelLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "700",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  wheelBox: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 10,
    alignItems: "center",
    width: "100%",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  wheelBtn: { padding: 6 },
  wheelVal: { fontSize: 26, fontWeight: "900", color: colors.textPrimary },

  /* Commitment Pledge Card */
  pledgeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    width: "100%",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    ...Platform.select({
      ios: {
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.07,
        shadowRadius: 14,
      },
      android: { elevation: 3 },
    }),
  },
  pledgeHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  pledgeSeal: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 94, 0, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  pledgeHeaderText: {
    fontSize: 11,
    fontWeight: "900",
    color: colors.accent || "#FF5E00",
    letterSpacing: 1,
  },
  pledgeQuote: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
    lineHeight: 22,
    fontStyle: "italic",
  },
  pledgeDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 16,
  },
  pledgeTargetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    padding: 14,
    borderRadius: 16,
  },
  pledgeTargetCol: {
    flex: 1,
    alignItems: "center",
  },
  pledgeTargetDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#E2E8F0",
  },
  pledgeTargetLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.5,
  },
  pledgeTargetVal: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0F172A",
    marginTop: 2,
  },
  pledgeChecklist: {
    marginTop: 16,
    gap: 10,
  },
  pledgeCheckRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pledgeCheckText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },

  /* Commitment Button */
  commitBtn: {
    marginTop: 24,
    width: "100%",
    height: 64,
    borderRadius: 999,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
      },
      android: { elevation: 6 },
    }),
  },
  commitFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.accent || "#FF5E00",
  },
  commitBtnContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  commitBtnText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 16,
    letterSpacing: 0.3,
  },
  commitHintText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
    marginTop: 10,
    textAlign: "center",
  },

  /* Generating Screen */
  ringContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  genPct: { fontSize: 44, fontWeight: "900", color: "#0F172A", letterSpacing: -1 },
  genLabel: {
    fontSize: 11,
    color: colors.accent || "#FF5E00",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginTop: 2,
  },
  tickerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    marginTop: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
    }),
  },
  tickerText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
  },
  genRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  genIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  genDonePill: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  genDoneText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#10B981",
    letterSpacing: 0.5,
  },

  /* Timeline Hero Card */
  timelineHero: {
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: "#1E293B",
    ...Platform.select({
      ios: {
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.22,
        shadowRadius: 18,
      },
      android: { elevation: 6 },
    }),
  },
  timelineHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  timelineIconBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  timelineBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.accent,
    letterSpacing: 1,
  },
  timelineTargetDateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  timelineTargetDateText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#10B981",
  },
  timelineMainContent: {
    marginBottom: 16,
  },
  timelineDurationBig: {
    fontSize: 32,
    fontWeight: "900",
    color: colors.white,
    letterSpacing: -0.5,
  },
  timelineGoalSub: {
    fontSize: 13,
    fontWeight: "500",
    color: "#94A3B8",
    marginTop: 4,
    lineHeight: 18,
  },
  timelineBarWrap: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  timelineBarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timelineNodeActive: {
    alignItems: "center",
  },
  timelineNodeText: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.accent,
  },
  timelineNodeSub: {
    fontSize: 9,
    fontWeight: "600",
    color: "#94A3B8",
    marginTop: 1,
  },
  timelineConnector: {
    flex: 1,
    height: 2,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    marginHorizontal: 8,
    borderRadius: 1,
  },
  timelineConnectorFill: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.accent,
    borderRadius: 1,
  },
  timelineConnectorDashed: {
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  timelineNodeMid: {
    alignItems: "center",
  },
  timelineNodeTextMid: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.white,
  },
  timelineNodeSubMid: {
    fontSize: 9,
    fontWeight: "600",
    color: "#94A3B8",
    marginTop: 1,
  },
  timelineNodeGoal: {
    alignItems: "center",
  },
  timelineNodeGoalText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#10B981",
  },
  timelineNodeGoalSub: {
    fontSize: 9,
    fontWeight: "600",
    color: "#10B981",
    marginTop: 1,
  },

  /* Daily Calorie Card */
  planHero: {
    backgroundColor: "#0F172A",
    borderRadius: 22,
    padding: 20,
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18,
        shadowRadius: 16,
      },
      android: { elevation: 6 },
    }),
  },
  planLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  planBig: {
    color: colors.accent || "#FF5E00",
    fontSize: 48,
    fontWeight: "900",
    letterSpacing: -1,
    marginTop: 4,
  },
  planCalSub: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.6)",
    marginTop: 2,
  },
  planDeficitPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 12,
  },
  planDeficitText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#E2E8F0",
  },
  planAdaptiveCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  planAdaptiveText: {
    flex: 1,
    fontSize: 12,
    color: "#475569",
    fontWeight: "600",
    lineHeight: 17,
  },

  /* Macro Card */
  planCard: {
    flex: 1,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    alignItems: "center",
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
    }),
  },
  planCardTopBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  planDot: { width: 7, height: 7, borderRadius: 999 },
  planCardLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  planCardVal: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0F172A",
    marginTop: 2,
  },
  planCardPctBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  planCardPctText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#475569",
  },
  planCardRole: {
    fontSize: 10,
    fontWeight: "600",
    color: "#94A3B8",
    marginTop: 4,
    textAlign: "center",
  },

  /* Comparison List Matrix */
  compareHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1.5,
    borderBottomColor: "#E2E8F0",
  },
  compareCol: {
    flex: 1.3,
    fontSize: 11,
    fontWeight: "800",
    color: "#0F172A",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  compareColCaliwo: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "rgba(255, 94, 0, 0.1)",
    paddingVertical: 4,
    borderRadius: 6,
  },
  compareColCaliwoText: {
    fontSize: 11,
    fontWeight: "900",
    color: colors.accent || "#FF5E00",
    letterSpacing: 0.8,
  },
  compareRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  compareCell: {
    flex: 1.3,
    fontSize: 13,
    color: "#1E293B",
    fontWeight: "600",
  },
  compareCellCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  compareCheckPill: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  pressRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    marginTop: 12,
  },
  pressName: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.5,
    color: "#64748B",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
});

const trustStyles = StyleSheet.create({
  card: {
    marginTop: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    ...Platform.select({
      ios: {
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 16,
      },
      android: { elevation: 3 },
    }),
  },
  statHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "900",
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: "600",
    marginTop: 1,
  },
  multiplierBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  multiplierText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#059669",
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 14,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendDash: {
    width: 12,
    height: 3,
    borderRadius: 2,
  },
  legendLabelBold: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0F172A",
  },
  legendLabelMuted: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  pillarsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  pillarCard: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  pillarTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 4,
    textAlign: "center",
  },
  pillarDesc: {
    fontSize: 9,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 1,
    textAlign: "center",
  },
  comparisonStatRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  comparisonStatCard: {
    alignItems: "center",
  },
  comparisonStatBigCaliwo: {
    fontSize: 22,
    fontWeight: "900",
    color: colors.accent || "#FF5E00",
  },
  comparisonStatBigOwn: {
    fontSize: 22,
    fontWeight: "900",
    color: "#64748B",
  },
  comparisonStatTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 2,
  },
  comparisonStatSub: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 1,
  },
  comparisonStatDivider: {
    width: 1,
    height: 36,
    backgroundColor: "#E2E8F0",
  },
  projectionNoteCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F0FDF4",
    borderRadius: 14,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  projectionNoteText: {
    flex: 1,
    fontSize: 11,
    color: "#166534",
    fontWeight: "600",
    lineHeight: 16,
  },
  xRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  xLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textTertiary,
    letterSpacing: 0.3,
  },
});

const pickerStyles = StyleSheet.create({
  valuePill: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
    }),
  },
  valuePillText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  deltaBadge: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 94, 0, 0.08)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 94, 0, 0.2)",
    marginBottom: 16,
  },
  deltaText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.accent || "#FF5E00",
    letterSpacing: 0.2,
  },
});

