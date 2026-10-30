export const colors = {
  bg: "transparent",
  bgSolid: "#FBFAF8",
  surface: "#EEF0F3",
  surfaceAlt: "#E5E7EB",
  black: "#000000",
  black90: "#111111",
  white: "#FFFFFF",
  textPrimary: "#000000",
  textSecondary: "#6B6B6B",
  textTertiary: "#A3A3A3",
  border: "#E5E7EB",
  borderStrong: "#1A1A1A",
  accent: "#FF5E00",
  accentSoft: "#FFF0E5",
  green: "#00A86B",
  danger: "#E53935",
  proteinColor: "#FF5E00",
  carbsColor: "#111111",
  fatColor: "#7C7C7C",
};

// Premium light gradient used as the app background canvas.
// Diagonal 3-stop iridescence: warm peach cream → cool sky → soft lilac.
// Kept in the very-light band (>90% luminance) so cards and text stay high-contrast
// and it never reads as "heavy" — just a whisper of color depth.
export const bgGradient = {
  colors: ["#FEEBD3", "#E1EAFA", "#EEDBFA"] as const,
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
};

export const radius = {
  sm: 10,
  md: 16,
  lg: 20,
  xl: 28,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const fonts = {
  heading: undefined as string | undefined, // system default; will use fontWeight aggressive
};
