import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "@/src/theme";
import api from "@/src/lib/api";
import { getTasteEntityMeta } from "@/src/utils/tasteIcons";

type Item = {
  name: string;
  checked: boolean;
  category?: string;
  is_custom?: boolean;
  is_cultural?: boolean;
  micronutrient_benefit?: string | null;
};

type Grocery = {
  plan_id: string | null;
  items: Item[];
  checked_count?: number;
  total_count?: number;
};

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

export default function GroceryScreen() {
  const router = useRouter();
  const [data, setData] = useState<Grocery | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newItem, setNewItem] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get<Grocery>("/grocery/current");
      setData(r.data);
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const toggle = async (item: Item) => {
    if (!data) return;
    const next = !item.checked;
    // Optimistic update
    setData({
      ...data,
      items: data.items.map((i) =>
        i.name === item.name ? { ...i, checked: next } : i,
      ),
      checked_count: (data.checked_count || 0) + (next ? 1 : -1),
    });
    try {
      await api.post("/grocery/toggle", { name: item.name, checked: next });
    } catch {
      // Revert
      setData({
        ...data,
        items: data.items.map((i) =>
          i.name === item.name ? { ...i, checked: !next } : i,
        ),
      });
    }
  };

  const addItem = async () => {
    const name = newItem.trim();
    if (!name || adding) return;
    setAdding(true);
    try {
      await api.post("/grocery/add", { name });
      setNewItem("");
      await load();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Could not add item");
    } finally {
      setAdding(false);
    }
  };

  const clearChecked = () => {
    Alert.alert(
      "Clear checked items?",
      "Remove all completed items from your list",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await api.post("/grocery/clear-checked");
              await load();
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const reset = () => {
    Alert.alert("Uncheck all?", "Reset all checkmarks", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            await api.post("/grocery/reset");
            await load();
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const totalItems = data?.items.length || 0;
  const doneItems = data?.items.filter((i) => i.checked).length || 0;
  const progress = totalItems > 0 ? doneItems / totalItems : 0;

  // Dedicated Qloo Cultural Pantry Items
  const culturalItems = (data?.items || []).filter(
    (i) =>
      i.is_cultural ||
      (i.category && i.category.includes("Cultural")) ||
      /miso|farro|adobo|guajillo|poblano|truffle|quinoa|edamame|bok choy|kimchi|harissa|tahini|dashi|ponzu|kalamata|sourdough|injera|merguez|lemongrass|cotija|saikyo|meyer lemon|sea bass|tapenade|za'atar|sumac|tamari|mirin|flank steak|mole|ceviche|black cod|feta|ricotta|branzino|chia|matcha/i.test(
        i.name
      )
  );
  const culturalDoneCount = culturalItems.filter((i) => i.checked).length;

  // Group items by category
  const categories: Record<string, Item[]> = {};
  if (data?.items) {
    for (const item of data.items) {
      const cat = item.category || "Others 🥖";
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(item);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.back}
          testID="grocery-back"
        >
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Smart Grocery List</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {doneItems > 0 ? (
            <TouchableOpacity
              onPress={clearChecked}
              disabled={busy}
              style={styles.headerBtn}
              testID="grocery-clear-checked"
            >
              <Ionicons name="trash-outline" size={18} color="#EF4444" />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            onPress={reset}
            disabled={busy}
            style={styles.headerBtn}
            testID="grocery-reset"
          >
            {busy ? (
              <ActivityIndicator size="small" />
            ) : (
              <Ionicons name="refresh" size={18} color={colors.textPrimary} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Progress Card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <View>
                <Text style={styles.summaryTitle}>Shopping Progress</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
                  <Ionicons name="sparkles" size={11} color="#A78BFA" />
                  <Text style={{ fontSize: 11, fontWeight: "600", color: "#A78BFA" }}>
                    Qloo Cultural Taste Graph Grounded
                  </Text>
                </View>
              </View>
              <Text style={styles.summaryBadge}>
                {doneItems} / {totalItems} items
              </Text>
            </View>
            <View style={styles.bar}>
              <View
                style={[styles.barFill, { width: `${progress * 100}%` }]}
              />
            </View>
          </View>

          {/* Add Custom Item Input */}
          <View style={styles.addCard}>
            <Ionicons name="add-circle-outline" size={20} color={colors.accent} />
            <TextInput
              value={newItem}
              onChangeText={setNewItem}
              placeholder="Add item (e.g., Almond milk, Avocados)..."
              placeholderTextColor="#94A3B8"
              style={styles.addInput}
              onSubmitEditing={addItem}
              testID="grocery-add-input"
            />
            <TouchableOpacity
              onPress={addItem}
              disabled={!newItem.trim() || adding}
              style={[
                styles.addBtn,
                (!newItem.trim() || adding) && { opacity: 0.5 },
              ]}
              testID="grocery-add-btn"
            >
              {adding ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Ionicons name="arrow-up" size={18} color={colors.white} />
              )}
            </TouchableOpacity>
          </View>

          {totalItems === 0 ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name="cart-outline"
                  size={40}
                  color={colors.accent}
                />
              </View>
              <Text style={styles.emptyTitle}>Your grocery list is empty</Text>
              <Text style={styles.emptySub}>
                Type an item above to add to your list, or generate a 7-day meal plan to populate automatically.
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/plan")}
                style={styles.emptyBtn}
                testID="grocery-plan-cta"
              >
                <Ionicons name="sparkles" size={18} color={colors.white} />
                <Text style={styles.emptyBtnText}>Generate Meal Plan</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ gap: 20, marginTop: 16 }}>
              {/* Qloo Cultural Pantry Section */}
              {culturalItems.length > 0 && (
                <LinearGradient
                  colors={["#FAF5FF", "#F3E8FF"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.culturalPantryCard}
                  testID="qloo-cultural-pantry-section"
                >
                  <View style={styles.culturalPantryHeader}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <View style={styles.culturalPantryBadge}>
                        <Ionicons name="sparkles" size={11} color="#7E22CE" />
                        <Text style={styles.culturalPantryBadgeText}>
                          QLOO TASTE GRAPH GROUNDED
                        </Text>
                      </View>
                      <Text style={styles.culturalPantryTitle}>
                        🏺 Qloo Cultural Pantry
                      </Text>
                      <Text style={styles.culturalPantrySub}>
                        Authentic specialty ingredients extracted from your bio-cultural meal plan.
                      </Text>
                    </View>
                    <View style={styles.culturalPantryCountPill}>
                      <Text style={styles.culturalPantryCountText}>
                        {culturalDoneCount}/{culturalItems.length} READY
                      </Text>
                    </View>
                  </View>

                  <View style={styles.culturalPantryGrid}>
                    {culturalItems.map((it) => {
                      const meta = getTasteEntityMeta(it.name);
                      return (
                        <TouchableOpacity
                          key={`cultural-${it.name}`}
                          onPress={() => toggle(it)}
                          style={[
                            styles.culturalPantryItemCard,
                            it.checked && styles.culturalPantryItemCardChecked,
                          ]}
                          activeOpacity={0.75}
                          testID={`cultural-pantry-${it.name.replace(/\s+/g, "-")}`}
                        >
                          <View
                            style={[
                              styles.culturalItemCheckbox,
                              it.checked && styles.culturalItemCheckboxChecked,
                            ]}
                          >
                            {it.checked ? (
                              <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                            ) : null}
                          </View>

                          <View
                            style={[
                              styles.culturalItemIconWrap,
                              { backgroundColor: meta.bg, borderColor: meta.color + "30" },
                            ]}
                          >
                            <Ionicons name={meta.icon as any} size={15} color={meta.color} />
                          </View>

                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                              <Text
                                style={[
                                  styles.culturalItemName,
                                  it.checked && styles.culturalItemNameChecked,
                                ]}
                              >
                                {it.name}
                              </Text>
                              <View style={styles.culturalStaplePill}>
                                <Text style={styles.culturalStaplePillText}>Qloo Staple</Text>
                              </View>
                            </View>
                            {it.micronutrient_benefit ? (
                              <Text
                                style={[
                                  styles.culturalItemBenefit,
                                  it.checked && { opacity: 0.5 },
                                ]}
                                numberOfLines={2}
                              >
                                ✨ {it.micronutrient_benefit}
                              </Text>
                            ) : null}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </LinearGradient>
              )}

              {/* Standard Aisle Categories */}
              {Object.entries(categories).map(([category, items]) => {
                const isCultural =
                  category.includes("Global Pantry") ||
                  category.includes("Cultural Specialties");
                return (
                  <View
                    key={category}
                    style={[
                      styles.categoryWrap,
                      isCultural && styles.culturalCategoryWrap,
                    ]}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 6,
                      }}
                    >
                      <Text
                        style={[
                          styles.categoryTitle,
                          isCultural && { color: "#7E22CE" },
                        ]}
                      >
                        {category}
                      </Text>
                      {isCultural && (
                        <View style={styles.culturalHeaderBadge}>
                          <Ionicons name="sparkles" size={11} color="#7E22CE" />
                          <Text style={styles.culturalHeaderBadgeText}>
                            Bio-Cultural Bridge
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={{ gap: 8 }}>
                      {items.map((it) => (
                        <TouchableOpacity
                          key={it.name}
                          onPress={() => toggle(it)}
                          style={[
                            styles.itemRow,
                            it.checked && styles.itemRowChecked,
                            isCultural && styles.itemRowCultural,
                          ]}
                          testID={`grocery-item-${it.name.replace(/\s+/g, "-")}`}
                          activeOpacity={0.7}
                        >
                          <View
                            style={[
                              styles.checkbox,
                              it.checked && styles.checkboxChecked,
                            ]}
                          >
                            {it.checked ? (
                              <Ionicons
                                name="checkmark"
                                size={16}
                                color={colors.white}
                              />
                            ) : null}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.itemName,
                                it.checked && styles.itemNameChecked,
                              ]}
                            >
                              {it.name.charAt(0).toUpperCase() + it.name.slice(1)}
                            </Text>
                            {it.micronutrient_benefit ? (
                              <Text
                                style={[
                                  styles.itemMicroBenefit,
                                  it.checked && { opacity: 0.5 },
                                ]}
                              >
                                ✨ {it.micronutrient_benefit}
                              </Text>
                            ) : null}
                          </View>
                          {it.is_custom ? (
                            <View style={styles.customBadge}>
                              <Text style={styles.customBadgeText}>Custom</Text>
                            </View>
                          ) : null}
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  back: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: colors.white,
    ...shadowSm,
  },
  headerBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: colors.white,
    ...shadowSm,
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
    color: colors.textPrimary,
    letterSpacing: -0.4,
  },
  scroll: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 6 },
  summaryCard: {
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...shadowSm,
  },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryTitle: { fontSize: 14, fontWeight: "900", color: "#0F172A" },
  summaryBadge: { fontSize: 12, fontWeight: "800", color: colors.accent },
  bar: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
    marginTop: 10,
    overflow: "hidden",
  },
  barFill: { height: "100%", backgroundColor: colors.accent, borderRadius: 999 },
  addCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    height: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginTop: 12,
    ...shadowSm,
  },
  addInput: {
    flex: 1,
    fontSize: 14,
    color: "#0F172A",
    fontWeight: "500",
  },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryWrap: { gap: 8 },
  categoryTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...shadowSm,
  },
  itemRowChecked: { backgroundColor: "#F8FAFC", borderColor: "#E2E8F0" },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  itemName: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  itemNameChecked: {
    color: "#94A3B8",
    textDecorationLine: "line-through",
  },
  customBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
  },
  customBadgeText: { fontSize: 10, fontWeight: "800", color: colors.accent },
  emptyWrap: { alignItems: "center", paddingHorizontal: 20, paddingTop: 40 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F172A",
    marginTop: 16,
  },
  emptySub: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 6,
    textAlign: "center",
    lineHeight: 20,
  },
  emptyBtn: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#0F172A",
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 999,
  },
  emptyBtnText: { color: colors.white, fontWeight: "800", fontSize: 14 },
  culturalCategoryWrap: {
    backgroundColor: "#FAF5FF",
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E9D5FF",
  },
  culturalHeaderBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F3E8FF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  culturalHeaderBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#7E22CE",
  },
  itemRowCultural: {
    borderColor: "#DDD6FE",
    backgroundColor: "#FFFFFF",
  },
  itemMicroBenefit: {
    fontSize: 11,
    fontWeight: "600",
    color: "#7E22CE",
    marginTop: 2,
  },
  /* Qloo Cultural Pantry Section Styles */
  culturalPantryCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "#E9D5FF",
    marginBottom: 8,
    ...shadowSm,
  },
  culturalPantryHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  culturalPantryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F3E8FF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    alignSelf: "flex-start",
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "#E9D5FF",
  },
  culturalPantryBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#7E22CE",
    letterSpacing: 0.6,
  },
  culturalPantryTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#581C87",
    letterSpacing: -0.3,
  },
  culturalPantrySub: {
    fontSize: 11,
    color: "#6B21A8",
    marginTop: 2,
    lineHeight: 15,
  },
  culturalPantryCountPill: {
    backgroundColor: "#7E22CE",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  culturalPantryCountText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.4,
  },
  culturalPantryGrid: {
    gap: 8,
  },
  culturalPantryItemCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E9D5FF",
  },
  culturalPantryItemCardChecked: {
    backgroundColor: "#FAF5FF",
    borderColor: "#DDD6FE",
    opacity: 0.85,
  },
  culturalItemCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#C084FC",
    alignItems: "center",
    justifyContent: "center",
  },
  culturalItemCheckboxChecked: {
    backgroundColor: "#7E22CE",
    borderColor: "#7E22CE",
  },
  culturalItemIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  culturalItemName: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
  },
  culturalItemNameChecked: {
    color: "#94A3B8",
    textDecorationLine: "line-through",
  },
  culturalStaplePill: {
    backgroundColor: "#F3E8FF",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  culturalStaplePillText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#7E22CE",
  },
  culturalItemBenefit: {
    fontSize: 11,
    fontWeight: "600",
    color: "#7E22CE",
    marginTop: 2,
    lineHeight: 14,
  },
});

