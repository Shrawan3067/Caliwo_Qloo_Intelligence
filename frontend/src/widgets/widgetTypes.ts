export interface TodaySummary {
  calories: number;
  calorieGoal: number;
  protein: number;
  proteinGoal: number;
  carbs: number;
  carbsGoal: number;
  fat: number;
  fatGoal: number;
  fiber?: number;
  fiberGoal?: number;
  sugar?: number;
  sugarGoal?: number;
  sodium?: number;
  sodiumGoal?: number;
  water: number;       // in liters (e.g. 1.8)
  waterGoal: number;   // in liters (e.g. 3.0)
  waterMl: number;     // in ml (e.g. 1800)
  waterGoalMl: number; // in ml (e.g. 3000)
  lastUpdated: string; // ISO string
  isLoggedOut?: boolean;
}

export type WidgetType = "intake" | "water";

export interface WidgetPreviewInfo {
  type: WidgetType;
  title: string;
  subtitle: string;
  description: string;
  status: "Configured" | "Not Added";
}

export const DEFAULT_TODAY_SUMMARY: TodaySummary = {
  calories: 0,
  calorieGoal: 2200,
  protein: 0,
  proteinGoal: 140,
  carbs: 0,
  carbsGoal: 220,
  fat: 0,
  fatGoal: 65,
  fiber: 0,
  fiberGoal: 28,
  sugar: 0,
  sugarGoal: 30,
  sodium: 0,
  sodiumGoal: 2000,
  water: 0,
  waterGoal: 2.5,
  waterMl: 0,
  waterGoalMl: 2500,
  lastUpdated: new Date().toISOString(),
  isLoggedOut: false,
};

export const LOGGED_OUT_SUMMARY: TodaySummary = {
  ...DEFAULT_TODAY_SUMMARY,
  isLoggedOut: true,
};
