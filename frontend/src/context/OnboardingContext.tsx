import React, { createContext, useContext, useState, useCallback } from "react";
import api from "@/src/lib/api";

export type OnboardingData = {
  sex?: string;
  workouts_per_week?: string;
  height_cm?: number;
  weight_kg?: number;
  date_of_birth?: string;
  works_with_coach?: boolean;
  goal?: "lose" | "maintain" | "gain";
  desired_weight_kg?: number;
  target_speed?: string;
  obstacles?: string[];
  diet?: string;
  accomplishments?: string[];
  add_burned_back?: boolean;
  rollover_calories?: boolean;
  committed?: boolean;
  daily_calories?: number;
  daily_protein_g?: number;
  daily_carbs_g?: number;
  daily_fat_g?: number;
  plan_deadline?: string;
  estimated_days?: number;
  estimated_months?: number;
  estimated_weeks?: number;
  weekly_rate_kg?: number;
  duration_text?: string;
  target_date_formatted?: string;
  weight_diff_kg?: number;
};

type Ctx = {
  data: OnboardingData;
  update: (patch: Partial<OnboardingData>) => void;
  reset: () => void;
  save: () => Promise<void>;
};

const OnboardingCtx = createContext<Ctx | null>(null);

export function useOnboarding() {
  const c = useContext(OnboardingCtx);
  if (!c) throw new Error("useOnboarding outside provider");
  return c;
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<OnboardingData>({});
  const update = useCallback((patch: Partial<OnboardingData>) => {
    setData((p) => ({ ...p, ...patch }));
  }, []);
  const reset = useCallback(() => setData({}), []);
  const save = useCallback(async () => {
    await api.post("/profile/onboarding", data);
  }, [data]);
  return (
    <OnboardingCtx.Provider value={{ data, update, reset, save }}>{children}</OnboardingCtx.Provider>
  );
}

// Compute macros & exact goal timeline (in months & days) from onboarding data
export function computePlan(d: OnboardingData): {
  daily_calories: number;
  daily_protein_g: number;
  daily_carbs_g: number;
  daily_fat_g: number;
  plan_deadline: string;
  estimated_days: number;
  estimated_months: number;
  estimated_weeks: number;
  weekly_rate_kg: number;
  duration_text: string;
  target_date_formatted: string;
  weight_diff_kg: number;
} {
  const weight = d.weight_kg || 70;
  const desired = d.desired_weight_kg || weight;
  const height = d.height_cm || 170;
  const dob = d.date_of_birth ? new Date(d.date_of_birth) : new Date("1995-01-01");
  const age = Math.max(15, Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000)));
  const isMale = (d.sex || "").toLowerCase().startsWith("m");

  // Mifflin-St Jeor BMR
  const bmr = 10 * weight + 6.25 * height - 5 * age + (isMale ? 5 : -161);

  // Activity multiplier
  const w = d.workouts_per_week || "0-2";
  const act = w.startsWith("6") ? 1.725 : w.startsWith("3") ? 1.55 : 1.375;
  let tdee = bmr * act;

  // Goal adjustment
  const goal = d.goal || (desired < weight ? "lose" : desired > weight ? "gain" : "maintain");
  const speed = d.target_speed || "recommended";
  const delta = speed === "fast" ? 500 : speed === "slow" ? 200 : 350;

  if (goal === "lose") tdee -= delta;
  if (goal === "gain") tdee += delta;

  const cal = Math.max(1200, Math.round(tdee));
  const protein = Math.round(weight * 1.8);
  const fat = Math.round((cal * 0.28) / 9);
  const carbs = Math.max(60, Math.round((cal - protein * 4 - fat * 9) / 4));

  // Precise Goal Timeline Calculation (Months & Days)
  const weightDiff = Math.abs(weight - desired);
  let weeklyRate = 0.5; // kg per week
  if (goal === "lose") {
    weeklyRate = speed === "fast" ? 0.75 : speed === "slow" ? 0.25 : 0.5;
  } else if (goal === "gain") {
    weeklyRate = speed === "fast" ? 0.4 : speed === "slow" ? 0.15 : 0.25;
  } else {
    weeklyRate = 0;
  }

  let totalWeeks = 1;
  let totalDays = 30;
  let durationText = "30 days";

  if (goal === "maintain" || weightDiff < 0.1) {
    totalDays = 60;
    totalWeeks = 8;
    durationText = "2 months (60 days)";
  } else {
    totalWeeks = Math.max(1, Math.round(weightDiff / weeklyRate));
    totalDays = totalWeeks * 7;
    const months = (totalDays / 30.4).toFixed(1);
    const monthsNum = parseFloat(months);

    if (monthsNum < 1) {
      durationText = `${totalDays} days (${totalWeeks} ${totalWeeks === 1 ? "week" : "weeks"})`;
    } else if (monthsNum === 1 || Number.isInteger(monthsNum)) {
      durationText = `${Math.round(monthsNum)} ${Math.round(monthsNum) === 1 ? "month" : "months"} (${totalDays} days)`;
    } else {
      durationText = `${months} months (${totalDays} days)`;
    }
  }

  const deadlineDate = new Date();
  deadlineDate.setDate(deadlineDate.getDate() + totalDays);
  const plan_deadline = deadlineDate.toISOString().slice(0, 10);
  const target_date_formatted = deadlineDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return {
    daily_calories: cal,
    daily_protein_g: protein,
    daily_carbs_g: carbs,
    daily_fat_g: fat,
    plan_deadline,
    estimated_days: totalDays,
    estimated_months: parseFloat((totalDays / 30.4).toFixed(1)),
    estimated_weeks: totalWeeks,
    weekly_rate_kg: weeklyRate,
    duration_text: durationText,
    target_date_formatted,
    weight_diff_kg: weightDiff,
  };
}
