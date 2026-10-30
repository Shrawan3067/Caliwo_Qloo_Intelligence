import { Stack } from "expo-router";

export default function StepsLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "transparent" } }} />;
}
