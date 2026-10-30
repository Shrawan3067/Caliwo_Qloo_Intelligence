import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { colors, radius, bgGradient } from "@/src/theme";
import { feedbackApi, PostType, SimilarPostItem } from "@/src/lib/feedbackApi";

const CATEGORIES = [
  "AI",
  "Meal Scanning",
  "Nutrition",
  "Water Tracking",
  "Workouts",
  "Groups",
  "Widgets",
  "UI / UX",
  "Performance",
  "Notifications",
  "Integrations",
  "Other",
];

const POST_TYPES: {
  id: PostType;
  label: string;
  icon: string;
  desc: string;
  color: string;
  bg: string;
}[] = [
  {
    id: "feature_request",
    label: "Feature Request",
    icon: "bulb-outline",
    desc: "Suggest new capabilities",
    color: "#8B5CF6",
    bg: "#F3E8FF",
  },
  {
    id: "bug_report",
    label: "Bug Report",
    icon: "bug-outline",
    desc: "Report app malfunction",
    color: "#EF4444",
    bg: "#FEE2E2",
  },
  {
    id: "error_report",
    label: "Error Report",
    icon: "warning-outline",
    desc: "Crashes or technical issues",
    color: "#F59E0B",
    bg: "#FEF3C7",
  },
  {
    id: "general_feedback",
    label: "General Feedback",
    icon: "chatbox-ellipses-outline",
    desc: "Opinions & thoughts",
    color: "#10B981",
    bg: "#D1FAE5",
  },
];

export default function CreateFeedbackScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [postType, setPostType] = useState<PostType>("feature_request");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("AI");
  const [stepsToReproduce, setStepsToReproduce] = useState("");
  const [expectedBehaviour, setExpectedBehaviour] = useState("");
  const [actualBehaviour, setActualBehaviour] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Duplicate Check
  const [similarPosts, setSimilarPosts] = useState<SimilarPostItem[]>([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);

  useEffect(() => {
    if (title.trim().length > 4) {
      const timer = setTimeout(() => {
        setCheckingDuplicates(true);
        feedbackApi
          .checkDuplicates(title, category)
          .then((res) => setSimilarPosts(res.similar_posts || []))
          .catch(console.error)
          .finally(() => setCheckingDuplicates(false));
      }, 400);
      return () => clearTimeout(timer);
    } else {
      setSimilarPosts([]);
    }
  }, [title, category]);

  const handlePickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsMultipleSelection: true,
    });
    if (!res.canceled && res.assets) {
      const uris = res.assets.map((a) => a.uri);
      setImages((prev) => [...prev, ...uris]);
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert("Title Required", "Please enter a title for your post.");
      return;
    }
    if (!description.trim() || description.trim().length < 10) {
      Alert.alert(
        "Description Required",
        "Please provide a detailed description (at least 10 characters).",
      );
      return;
    }

    setSubmitting(true);
    try {
      await feedbackApi.createPost({
        post_type: postType,
        title: title.trim(),
        description: description.trim(),
        category,
        steps_to_reproduce: stepsToReproduce.trim() || undefined,
        expected_behaviour: expectedBehaviour.trim() || undefined,
        actual_behaviour: actualBehaviour.trim() || undefined,
        media_urls: images,
        app_version: "2.4.0",
        platform: Platform.OS,
        device_model: Platform.OS === "ios" ? "iPhone" : "Android Device",
        os_version: String(Platform.Version),
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
      Alert.alert(
        "Post Published!",
        "Thank you for contributing to Nutri AI community.",
        [{ text: "OK", onPress: () => router.back() }],
      );
    } catch (e: any) {
      Alert.alert(
        "Submission Error",
        e?.response?.data?.detail || "Could not publish feedback post.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LinearGradient
      colors={bgGradient.colors}
      start={bgGradient.start}
      end={bgGradient.end}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        {/* Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.iconBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="close" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Post</Text>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            style={[styles.submitBtn, submitting && { opacity: 0.5 }]}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.submitBtnText}>Publish</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + 40 },
          ]}
        >
          {/* Post Type Selector */}
          <Text style={styles.sectionHeading}>1. Select Post Type</Text>
          <View style={styles.typeGrid}>
            {POST_TYPES.map((t) => {
              const active = postType === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => {
                    Haptics.impactAsync(
                      Haptics.ImpactFeedbackStyle.Light,
                    ).catch(() => {});
                    setPostType(t.id);
                  }}
                  style={[
                    styles.typeCard,
                    active && { borderColor: t.color, backgroundColor: t.bg },
                  ]}
                  activeOpacity={0.85}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <View
                      style={[
                        styles.typeIconBox,
                        { backgroundColor: active ? t.color : "#F3F4F6" },
                      ]}
                    >
                      <Ionicons
                        name={t.icon as any}
                        size={16}
                        color={active ? "#FFFFFF" : t.color}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[styles.typeTitle, active && { color: t.color }]}
                      >
                        {t.label}
                      </Text>
                      <Text style={styles.typeDesc}>{t.desc}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Category Picker */}
          <Text style={styles.sectionHeading}>2. Category</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catScroll}
          >
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                onPress={() => setCategory(cat)}
                style={[
                  styles.catChip,
                  category === cat && styles.catChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.catChipText,
                    category === cat && styles.catChipTextActive,
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Title Input */}
          <Text style={styles.sectionHeading}>3. Title</Text>
          <View style={styles.inputCard}>
            <TextInput
              style={styles.titleInput}
              placeholder="e.g., Add Lock Screen Widget for Macro Goals"
              placeholderTextColor={colors.textTertiary}
              value={title}
              onChangeText={setTitle}
              maxLength={120}
            />
          </View>

          {/* Duplicate Checker Warning Box */}
          {checkingDuplicates ? (
            <View style={styles.dupLoaderRow}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.dupLoaderText}>
                Checking community posts for duplicates...
              </Text>
            </View>
          ) : (
            similarPosts.length > 0 && (
              <View style={styles.duplicateBox}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 8,
                  }}
                >
                  <Ionicons name="bulb" size={18} color={colors.accent} />
                  <Text style={styles.duplicateTitle}>
                    Similar Posts Found!
                  </Text>
                </View>
                <Text style={styles.duplicateSub}>
                  Check if your feature request or bug has already been
                  submitted:
                </Text>
                {similarPosts.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => router.push(`/feedback/${item.id}` as any)}
                    style={styles.similarCard}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.similarTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.similarMeta}>
                        {item.category} • {item.votes_count} upvotes
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            )
          )}

          {/* Description Input */}
          <Text style={styles.sectionHeading}>4. Description & Details</Text>
          <View style={styles.inputCard}>
            <TextInput
              style={styles.descInput}
              placeholder="Explain the background, why this feature would be useful, or details of the issue..."
              placeholderTextColor={colors.textTertiary}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Additional Bug Report Fields */}
          {(postType === "bug_report" || postType === "error_report") && (
            <View style={styles.bugFieldsContainer}>
              <Text style={styles.sectionHeading}>
                5. Technical Details (Optional)
              </Text>

              <View style={styles.inputCard}>
                <Text style={styles.fieldLabel}>Steps to Reproduce</Text>
                <TextInput
                  style={styles.subInput}
                  placeholder="1. Open scanner -> 2. Tap photo..."
                  placeholderTextColor={colors.textTertiary}
                  value={stepsToReproduce}
                  onChangeText={setStepsToReproduce}
                  multiline
                />
              </View>

              <View style={[styles.inputCard, { marginTop: 10 }]}>
                <Text style={styles.fieldLabel}>Expected Behaviour</Text>
                <TextInput
                  style={styles.subInput}
                  placeholder="App should calculate macros accurately"
                  placeholderTextColor={colors.textTertiary}
                  value={expectedBehaviour}
                  onChangeText={setExpectedBehaviour}
                />
              </View>

              <View style={[styles.inputCard, { marginTop: 10 }]}>
                <Text style={styles.fieldLabel}>Actual Behaviour</Text>
                <TextInput
                  style={styles.subInput}
                  placeholder="App showed loading spinner indefintely"
                  placeholderTextColor={colors.textTertiary}
                  value={actualBehaviour}
                  onChangeText={setActualBehaviour}
                />
              </View>
            </View>
          )}

          {/* Attachments / Screenshots */}
          <Text style={styles.sectionHeading}>
            Attachments (Screenshots & Images)
          </Text>
          <View style={styles.imagesRow}>
            {images.map((uri, idx) => (
              <View key={idx} style={styles.imageContainer}>
                <Image source={{ uri }} style={styles.attachedImg} />
                <TouchableOpacity
                  onPress={() => handleRemoveImage(idx)}
                  style={styles.removeImgBtn}
                >
                  <Ionicons name="close" size={12} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              onPress={handlePickImage}
              style={styles.addImgBtn}
              activeOpacity={0.8}
            >
              <Ionicons name="camera-outline" size={24} color={colors.accent} />
              <Text style={styles.addImgText}>Add Photo</Text>
            </TouchableOpacity>
          </View>

          {/* Auto Diagnostic Info Badge */}
          <View style={styles.diagBadge}>
            <Ionicons
              name="hardware-chip-outline"
              size={14}
              color={colors.textSecondary}
            />
            <Text style={styles.diagText}>
              Caliwo v2.4.0 • {Platform.OS.toUpperCase()} {Platform.Version}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: { fontSize: 17, fontWeight: "900", color: colors.textPrimary },
  submitBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  submitBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  content: { paddingHorizontal: 16, paddingTop: 10 },

  sectionHeading: {
    fontSize: 13,
    fontWeight: "900",
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  /* Type Selection Grid */
  typeGrid: { gap: 8 },
  typeCard: {
    backgroundColor: "#FFFFFF",
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: "rgba(0,0,0,0.05)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  typeIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  typeTitle: { fontSize: 13, fontWeight: "800", color: colors.textPrimary },
  typeDesc: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },

  /* Category Chips */
  catScroll: { gap: 8, paddingVertical: 4 },
  catChip: {
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  catChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  catChipText: { fontSize: 12, fontWeight: "700", color: colors.textSecondary },
  catChipTextActive: { color: "#FFFFFF", fontWeight: "900" },

  /* Input Cards */
  inputCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  titleInput: { fontSize: 14, fontWeight: "700", color: colors.textPrimary },
  descInput: {
    fontSize: 13,
    color: colors.textPrimary,
    minHeight: 90,
    lineHeight: 18,
  },

  /* Duplicate Box */
  dupLoaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  dupLoaderText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  duplicateBox: {
    backgroundColor: "#FFF0E5",
    borderRadius: radius.md,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 94, 0, 0.2)",
  },
  duplicateTitle: { fontSize: 13, fontWeight: "900", color: colors.accent },
  duplicateSub: { fontSize: 11, color: colors.textSecondary, marginBottom: 8 },
  similarCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 10,
    borderRadius: 10,
    marginTop: 6,
  },
  similarTitle: { fontSize: 12, fontWeight: "800", color: colors.textPrimary },
  similarMeta: { fontSize: 10, color: colors.textTertiary, marginTop: 2 },

  /* Bug Details */
  bugFieldsContainer: { marginTop: 4 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.textSecondary,
    marginBottom: 4,
  },
  subInput: { fontSize: 12, color: colors.textPrimary },

  /* Image Upload Grid */
  imagesRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  imageContainer: { position: "relative" },
  attachedImg: { width: 70, height: 70, borderRadius: 12 },
  removeImgBtn: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  addImgBtn: {
    width: 70,
    height: 70,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderStyle: "dashed",
  },
  addImgText: {
    fontSize: 9,
    fontWeight: "800",
    color: colors.accent,
    marginTop: 2,
  },

  /* Diagnostic Info */
  diagBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.6)",
    paddingVertical: 10,
    borderRadius: radius.md,
    marginTop: 24,
  },
  diagText: { fontSize: 11, fontWeight: "700", color: colors.textSecondary },
});
