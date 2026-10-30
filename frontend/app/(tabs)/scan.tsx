import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  TextInput,
  Alert,
  Modal,
  Platform,
  PanResponder,
  Animated,
  Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { CameraView, useCameraPermissions, type CameraType } from "expo-camera";
import { AudioModule, useAudioRecorder, RecordingPresets } from "expo-audio";
import { NutriLogo } from "@/src/components/NutriLogo";
import { MacroIcon, MacroType } from "@/src/components/MacroIcon";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import { colors } from "@/src/theme";
import api, { BASE_URL, getToken } from "@/src/lib/api";
import { getTasteEntityMeta } from "@/src/utils/tasteIcons";

const ZOOM_PRESETS = [0, 0.25, 0.5, 0.75, 1] as const;
const PRESET_SNAP_THRESHOLD = 0.03;
// Max base64 image size ~5MB to stay within MongoDB 16MB doc limit after JSON wrapping
const MAX_IMAGE_B64_BYTES = 5 * 1024 * 1024;

type RecognizedFood = {
  name: string;
  portion: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g?: number;
  sugar_g?: number;
  sodium_mg?: number;
};
type Recognized = {
  title: string;
  confidence: number;
  foods: RecognizedFood[];
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  total_fiber_g?: number;
  total_sugar_g?: number;
  total_sodium_mg?: number;
  uncertainty_level?: string;
  explanation?: string;
  assumptions_made?: string[];
  reasoning_chain?: string;
  transcript?: string;
};

type BarcodeProduct = {
  barcode: string;
  name: string;
  brand?: string | null;
  image_url?: string | null;
  serving_g: number;
  portion?: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g?: number | null;
  sugar_g?: number | null;
  sodium_mg?: number | null;
  ingredients?: string | null;
  allergens?: string[] | null;
  additives?: string[] | null;
  nova_group?: number | null;
  nutrition_grade?: string | null;
  health_score?: number | null;
  calories_100g?: number | null;
  protein_100g?: number | null;
  carbs_100g?: number | null;
  fat_100g?: number | null;
};

const MEAL_TYPES: ("breakfast" | "lunch" | "dinner" | "snack")[] = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
];

function currentMealType(): "breakfast" | "lunch" | "dinner" | "snack" {
  const h = new Date().getHours();
  if (h < 10) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 21) return "dinner";
  return "snack";
}

type Mode = "photo" | "voice" | "barcode";

const shadowSm = Platform.select({
  ios: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
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

export default function Scan() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>("photo");

  // Common result / meal
  const [image, setImage] = useState<string | null>(null);
  const [userText, setUserText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<Recognized | null>(null);
  const [barcodeResult, setBarcodeResult] = useState<BarcodeProduct | null>(
    null,
  );
  const [servingsMultiplier, setServingsMultiplier] = useState<number>(1.0);
  const [title, setTitle] = useState("");
  const [mealType, setMealType] = useState<
    "breakfast" | "lunch" | "dinner" | "snack"
  >(currentMealType());
  const [saving, setSaving] = useState(false);

  // Analysis feedback step progression
  const [analysisStepIndex, setAnalysisStepIndex] = useState(0);
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  const ANALYSIS_STEPS = useMemo(
    () => [
      { icon: "sparkles", label: "Scanning food & ingredients…" },
      { icon: "restaurant", label: "Recognizing portions & items…" },
      { icon: "flame", label: "Calculating calories & macros…" },
      { icon: "checkmark-done-circle", label: "Finalizing nutritional breakdown…" },
    ],
    [],
  );

  // Cycle analysis status messages while waiting for AI response
  useEffect(() => {
    if (!analyzing) {
      setAnalysisStepIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setAnalysisStepIndex((prev) => (prev + 1) % ANALYSIS_STEPS.length);
    }, 1700);
    return () => clearInterval(interval);
  }, [analyzing, ANALYSIS_STEPS]);

  // Smooth vertical scanning laser animation
  useEffect(() => {
    if (analyzing) {
      scanLineAnim.setValue(0);
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, {
            toValue: 1,
            duration: 1600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: 1600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
  }, [analyzing, scanLineAnim]);

  // Photo mode states
  const [photoCamOpen, setPhotoCamOpen] = useState(false);
  const [photoCamFacing, setPhotoCamFacing] = useState<CameraType>("back");
  const [capturing, setCapturing] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [zoom, setZoom] = useState(0); // 0..1
  const photoCamRef = useRef<CameraView | null>(null);
  const zoomRef = useRef(0);
  const lastPresetRef = useRef<number>(-1);
  const pinchBaseZoomRef = useRef(0);

  // Barcode mode states
  const [barcodePerm, requestBarcodePerm] = useCameraPermissions();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerTorchOn, setScannerTorchOn] = useState(false);
  const [manualPromptOpen, setManualPromptOpen] = useState(false);
  const scanLockRef = useRef(false);
  const [manualBarcode, setManualBarcode] = useState("");
  const [barcodeLoading, setBarcodeLoading] = useState(false);

  const reset = () => {
    setImage(null);
    setUserText("");
    setResult(null);
    setBarcodeResult(null);
    setServingsMultiplier(1.0);
    setTitle("");
    setAnalyzing(false);
    setScannerOpen(false);
    setScannerTorchOn(false);
    setManualPromptOpen(false);
    setManualBarcode("");
    setBarcodeLoading(false);
    scanLockRef.current = false;
    setPhotoCamOpen(false);
    setCapturing(false);
    setTorchOn(false);
    setMode("photo");
  };

  // Clean up all active scanner and camera modals when navigating away from scan
  useFocusEffect(
    useCallback(() => {
      return () => {
        setScannerOpen(false);
        setPhotoCamOpen(false);
        setManualPromptOpen(false);
        scanLockRef.current = false;
      };
    }, []),
  );

  // Fire a subtle haptic tick when zoom crosses a preset
  const applyZoom = (next: number) => {
    const clamped = Math.max(0, Math.min(1, next));
    let hitPreset = -1;
    for (let i = 0; i < ZOOM_PRESETS.length; i++) {
      if (Math.abs(clamped - ZOOM_PRESETS[i]) < PRESET_SNAP_THRESHOLD) {
        hitPreset = i;
        break;
      }
    }
    if (hitPreset !== -1 && hitPreset !== lastPresetRef.current) {
      lastPresetRef.current = hitPreset;
      Haptics.selectionAsync().catch(() => {});
    } else if (hitPreset === -1) {
      lastPresetRef.current = -1;
    }
    zoomRef.current = clamped;
    setZoom(clamped);
  };

  useEffect(() => {
    if (!photoCamOpen) {
      setTorchOn(false);
      setZoom(0);
      zoomRef.current = 0;
      lastPresetRef.current = -1;
      pinchBaseZoomRef.current = 0;
    }
  }, [photoCamOpen]);

  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .onBegin(() => {
          pinchBaseZoomRef.current = zoomRef.current;
        })
        .onUpdate((e) => {
          const delta = (e.scale - 1) * 0.5;
          applyZoom(pinchBaseZoomRef.current + delta);
        })
        .runOnJS(true),
    [],
  );

  const pick = async (from: "camera" | "gallery") => {
    reset();
    try {
      if (from === "camera") {
        if (!barcodePerm?.granted) {
          const p = await requestBarcodePerm();
          if (!p.granted) {
            Alert.alert(
              "Camera permission needed",
              "Please allow camera access to snap meals in the app.",
            );
            return;
          }
        }
        setPhotoCamOpen(true);
        return;
      }
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Photos permission needed");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        base64: true,
        quality: 0.4,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
      });
      if (res.canceled) return;
      const a = res.assets?.[0];
      if (!a?.base64) return;
      if (a.base64.length > MAX_IMAGE_B64_BYTES) {
        Alert.alert(
          "Image too large",
          "Please pick a smaller photo or use the camera instead.",
        );
        return;
      }
      const dataUrl = `data:image/jpeg;base64,${a.base64}`;
      setImage(dataUrl);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      // Automatically analyze photo from gallery without requiring extra button tap
      analyzePhoto(dataUrl);
    } catch (e: any) {
      Alert.alert("Camera Error", e?.message || String(e));
    }
  };

  const capturePhoto = async () => {
    if (capturing) return;
    setCapturing(true);
    try {
      const pic = await photoCamRef.current?.takePictureAsync({
        quality: 0.5,
        base64: true,
        skipProcessing: true,
      });
      if (!pic?.base64) throw new Error("No image captured");
      if (pic.base64.length > MAX_IMAGE_B64_BYTES) {
        Alert.alert(
          "Image too large",
          "The photo is too large. Try moving further from the subject.",
        );
        return;
      }
      const dataUrl = `data:image/jpeg;base64,${pic.base64}`;
      setPhotoCamOpen(false);
      setImage(dataUrl);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      // Automatically trigger instant AI analysis after snapping
      analyzePhoto(dataUrl);
    } catch (e: any) {
      Alert.alert("Capture failed", e?.message || "Try again");
    } finally {
      setCapturing(false);
    }
  };

  const analyzePhoto = async (b64: string, customText?: string) => {
    setAnalyzing(true);
    setResult(null);
    try {
      let lat: number | undefined;
      let lon: number | undefined;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          lat = loc.coords.latitude;
          lon = loc.coords.longitude;
        }
      } catch {}

      const r = await api.post<Recognized>("/meals/recognize", {
        image_base64: b64,
        user_text: customText !== undefined ? customText : (userText || undefined),
        gps_lat: lat,
        gps_lon: lon,
      });
      setResult(r.data);
      setTitle(r.data.title || "Meal");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert(
        "Recognition failed",
        e?.response?.data?.detail || "Try another photo.",
      );
    } finally {
      setAnalyzing(false);
    }
  };

  // -------- Voice mode --------
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [voiceElapsed, setVoiceElapsed] = useState(0);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    (async () => {
      try {
        await AudioModule.requestRecordingPermissionsAsync();
      } catch {}
    })();
  }, [mode]);

  const startVoice = async () => {
    reset();
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Microphone permission needed",
          "Please allow microphone access.",
        );
        return;
      }
      await AudioModule.setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
      setVoiceElapsed(0);
      timerRef.current = setInterval(() => setVoiceElapsed((s) => s + 1), 1000);
    } catch (e: any) {
      Alert.alert("Recording failed", e?.message || String(e));
    }
  };

  const stopVoice = async () => {
    try {
      if (timerRef.current) clearInterval(timerRef.current);
      setRecording(false);
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) {
        Alert.alert("No recording");
        return;
      }
      await uploadVoice(uri);
    } catch (e: any) {
      Alert.alert("Voice error", e?.message || String(e));
    }
  };

  const uploadVoice = async (uri: string) => {
    setAnalyzing(true);
    try {
      const fd = new FormData();
      const name = uri.split("/").pop() || "audio.m4a";
      const ext = (name.split(".").pop() || "m4a").toLowerCase();
      const type =
        ext === "webm"
          ? "audio/webm"
          : ext === "wav"
            ? "audio/wav"
            : ext === "mp3"
              ? "audio/mpeg"
              : "audio/m4a";
      if (Platform.OS === "web") {
        const resp = await fetch(uri);
        const blob = await resp.blob();
        fd.append(
          "file",
          blob,
          name.endsWith(".webm") ? name : name.replace(/\.[^.]+$/, ".webm"),
        );
      } else {
        // @ts-expect-error RN FormData file object
        fd.append("file", { uri, name, type });
      }
      const token = await getToken();
      const r = await fetch(`${BASE_URL}/api/meals/voice`, {
        method: "POST",
        body: fd as any,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.detail || "Voice failed");
      setResult(data);
      setTitle(data.title || "Voice meal");
    } catch (e: any) {
      Alert.alert("Voice log failed", e?.message || "Try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  // -------- Barcode mode --------
  const openScanner = async () => {
    try {
      reset();
      if (!barcodePerm?.granted) {
        const p = await requestBarcodePerm();
        if (!p.granted) {
          Alert.alert("Camera permission needed");
          return;
        }
      }
      scanLockRef.current = false;
      setScannerOpen(true);
    } catch (e: any) {
      Alert.alert("Camera Error", e?.message || String(e));
    }
  };

  const lookupBarcode = async (code: string) => {
    setBarcodeLoading(true);
    try {
      const r = await api.post<BarcodeProduct>("/meals/barcode", {
        barcode: code,
      });
      setBarcodeResult(r.data);
      setServingsMultiplier(1.0);
      setTitle(r.data.name);
    } catch (e: any) {
      Alert.alert(
        "Product not found",
        e?.response?.data?.detail ||
          "Try a different barcode or use photo mode.",
      );
    } finally {
      setBarcodeLoading(false);
    }
  };

  const onScanned = ({ data }: { data: string }) => {
    if (scanLockRef.current) return;
    scanLockRef.current = true;
    setScannerOpen(false);
    lookupBarcode(data);
  };

  const onManualBarcode = () => {
    if (!manualBarcode.trim()) return;
    lookupBarcode(manualBarcode.trim());
  };

  // Calculations for scaled barcode macros
  const baseServingGrams = barcodeResult?.serving_g || 100;
  const activeGrams = Math.round(baseServingGrams * servingsMultiplier);

  const displayCal = barcodeResult
    ? Math.round(barcodeResult.calories * servingsMultiplier)
    : 0;
  const displayP = barcodeResult
    ? Number((barcodeResult.protein_g * servingsMultiplier).toFixed(1))
    : 0;
  const displayC = barcodeResult
    ? Number((barcodeResult.carbs_g * servingsMultiplier).toFixed(1))
    : 0;
  const displayF = barcodeResult
    ? Number((barcodeResult.fat_g * servingsMultiplier).toFixed(1))
    : 0;
  const displayFiber = barcodeResult?.fiber_g
    ? Number((barcodeResult.fiber_g * servingsMultiplier).toFixed(1))
    : undefined;
  const displaySugar = barcodeResult?.sugar_g
    ? Number((barcodeResult.sugar_g * servingsMultiplier).toFixed(1))
    : undefined;
  const displaySodium = barcodeResult?.sodium_mg
    ? Math.round(barcodeResult.sodium_mg * servingsMultiplier)
    : undefined;

  // -------- Save --------
  const save = async () => {
    setSaving(true);
    try {
      let payload: any = {
        title: title || "Meal",
        meal_type: mealType,
        logged_at: new Date().toISOString(),
      };
      if (result) {
        payload = {
          ...payload,
          calories: result.total_calories,
          protein_g: result.total_protein_g,
          carbs_g: result.total_carbs_g,
          fat_g: result.total_fat_g,
          fiber_g: result.total_fiber_g || 0,
          sugar_g: result.total_sugar_g || 0,
          sodium_mg: result.total_sodium_mg || 0,
          magnesium_mg: (result as any).total_magnesium_mg || Math.round(Math.max(15, (result.total_protein_g * 1.5) + ((result.total_fiber_g || 0) * 4))),
          foods: result.foods,
          image_base64: image || undefined,
        };
      } else if (barcodeResult) {
        const portionStr =
          servingsMultiplier === 1
            ? barcodeResult.portion || `${activeGrams}g`
            : `${activeGrams}g (${servingsMultiplier} servings)`;

        const calcMag = Math.round(((barcodeResult as any)?.magnesium_mg || Math.max(15, (displayP * 1.5) + ((displayFiber || 0) * 4))));

        payload = {
          ...payload,
          calories: displayCal,
          protein_g: displayP,
          carbs_g: displayC,
          fat_g: displayF,
          fiber_g: displayFiber || 0,
          sugar_g: displaySugar || 0,
          sodium_mg: displaySodium || 0,
          magnesium_mg: calcMag,
          portion: portionStr,
          foods: [
            {
              name: barcodeResult.name,
              portion: portionStr,
              calories: displayCal,
              protein_g: displayP,
              carbs_g: displayC,
              fat_g: displayF,
              fiber_g: displayFiber || 0,
              sugar_g: displaySugar || 0,
              sodium_mg: displaySodium || 0,
              magnesium_mg: calcMag,
            },
          ],
        };
      } else {
        setSaving(false);
        return;
      }
      await api.post("/meals/log", payload);
      // MANDATORY: Update Qloo taste DNA with the logged meal
      const mealTitle = payload.title || payload.items?.[0]?.title || "";
      if (mealTitle) {
        await api.post("/taste/feedback", { meal_title: mealTitle });
      }
      // Invalidate queries so Home, Diary, and widgets auto-update instantly without manual pull-to-refresh
      queryClient.invalidateQueries({ queryKey: ["nutrition_today"] });
      queryClient.invalidateQueries({ queryKey: ["recent_meals"] });
      queryClient.invalidateQueries({ queryKey: ["milestones"] });
      queryClient.invalidateQueries({ queryKey: ["steps_today"] });
      queryClient.invalidateQueries({ queryKey: ["nutrition_analytics"] });
      // Reset scan state completely so barcode and camera modals do not reopen
      reset();
      router.replace("/(tabs)/home");
    } catch (e: any) {
      Alert.alert("Save failed", e?.response?.data?.detail || "Try again.");
    } finally {
      setSaving(false);
    }
  };

  const formatSecs = (s: number) =>
    `${Math.floor(s / 60)
      .toString()
      .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Log a Meal</Text>

        {/* Mode Segmented Bar */}
        <View style={styles.modeRow} testID="scan-mode-row">
          {(
            [
              { k: "photo", i: "camera", l: "Photo" },
              { k: "voice", i: "mic", l: "Voice" },
              { k: "barcode", i: "barcode", l: "Barcode" },
            ] as { k: Mode; i: keyof typeof Ionicons.glyphMap; l: string }[]
          ).map((m) => (
            <TouchableOpacity
              key={m.k}
              onPress={() => {
                reset();
                setMode(m.k);
              }}
              style={[styles.modeChip, mode === m.k && styles.modeChipActive]}
              activeOpacity={0.8}
              testID={`scan-mode-${m.k}`}
            >
              <Ionicons
                name={m.i}
                size={16}
                color={mode === m.k ? colors.white : "#0F172A"}
              />
              <Text
                style={[
                  styles.modeChipText,
                  mode === m.k && { color: colors.white },
                ]}
              >
                {m.l}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Mode-specific Top Panel */}
        {mode === "photo" && !image && (
          <View style={styles.pickerRow}>
            <TouchableOpacity
              style={styles.pickBtn}
              onPress={() => pick("camera")}
              activeOpacity={0.85}
              testID="scan-camera-btn"
            >
              <Ionicons name="camera" size={28} color={colors.white} />
              <Text style={styles.pickBtnText}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.pickBtn,
                {
                  backgroundColor: colors.white,
                  borderColor: "#E2E8F0",
                  borderWidth: 1,
                },
              ]}
              onPress={() => pick("gallery")}
              activeOpacity={0.85}
              testID="scan-gallery-btn"
            >
              <Ionicons name="images" size={28} color="#0F172A" />
              <Text style={[styles.pickBtnText, { color: "#0F172A" }]}>
                Gallery
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {mode === "photo" && image && (
          <View style={{ gap: 14 }}>
            <View style={styles.previewWrap}>
              <Image source={{ uri: image }} style={styles.preview} />

              {/* Floating Retake Action Button */}
              <TouchableOpacity
                style={styles.retakeFloatingBtn}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  reset();
                  pick("camera");
                }}
                activeOpacity={0.85}
                testID="scan-retake-floating-btn"
              >
                <Ionicons name="camera-reverse" size={16} color={colors.white} />
                <Text style={styles.retakeFloatingText}>Retake</Text>
              </TouchableOpacity>

              {/* Instant AI Scanning Feedback Overlay */}
              {analyzing && (
                <View style={styles.analyzingOverlay}>
                  {/* Glowing Animated Laser Scan Beam */}
                  <Animated.View
                    style={[
                      styles.scanLaserLine,
                      {
                        transform: [
                          {
                            translateY: scanLineAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [-10, 320],
                            }),
                          },
                        ],
                      },
                    ]}
                  />

                  {/* Centered Glass Analysis HUD Card */}
                  <View style={styles.analysisGlassCard}>
                    <View style={styles.analysisSpinnerBadge}>
                      <ActivityIndicator color={colors.accent} size="small" />
                    </View>
                    <Text style={styles.analyzingHeading}>AI Analyzing Meal</Text>
                    <View style={styles.analysisStepRow}>
                      <Ionicons
                        name={ANALYSIS_STEPS[analysisStepIndex].icon as any}
                        size={15}
                        color={colors.accent}
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.analyzingStepText}>
                        {ANALYSIS_STEPS[analysisStepIndex].label}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </View>

            {/* Quick Context & Re-analyze row if not analyzing and no result */}
            {!result && !analyzing && (
              <View style={styles.retryContextCard}>
                <View style={styles.retryHeaderRow}>
                  <Ionicons name="sparkles" size={18} color={colors.accent} />
                  <Text style={styles.retryCardTitle}>Add Details & Re-analyze</Text>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 'At Chipotle', 'Extra chicken bowl'"
                  placeholderTextColor="#94A3B8"
                  value={userText}
                  onChangeText={setUserText}
                />
                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={() => analyzePhoto(image)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="sparkles" size={20} color={colors.white} />
                  <Text style={styles.saveBtnText}>Re-Analyze Photo</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {mode === "voice" && (
          <View style={styles.voiceWrap}>
            <View
              style={[
                styles.voiceCircle,
                recording && styles.voiceCircleActive,
              ]}
            >
              <Ionicons
                name={recording ? "square" : "mic"}
                size={40}
                color={colors.white}
              />
            </View>
            <Text style={styles.voiceTimer}>{formatSecs(voiceElapsed)}</Text>
            <Text style={styles.voiceHint}>
              {recording
                ? "Recording… tap stop when done"
                : analyzing
                  ? "Transcribing & parsing audio…"
                  : "Tap the mic and describe what you ate"}
            </Text>
            {!recording && !analyzing && (
              <TouchableOpacity
                style={styles.voiceBtn}
                onPress={startVoice}
                activeOpacity={0.85}
                testID="scan-voice-start-btn"
              >
                <Ionicons name="mic" size={20} color={colors.white} />
                <Text style={styles.voiceBtnText}>Start Recording</Text>
              </TouchableOpacity>
            )}
            {recording && (
              <TouchableOpacity
                style={[styles.voiceBtn, { backgroundColor: "#E11D48" }]}
                onPress={stopVoice}
                activeOpacity={0.85}
                testID="scan-voice-stop-btn"
              >
                <Ionicons name="stop" size={20} color={colors.white} />
                <Text style={styles.voiceBtnText}>Stop</Text>
              </TouchableOpacity>
            )}
            {analyzing && (
              <ActivityIndicator
                color={colors.accent}
                style={{ marginTop: 16 }}
              />
            )}
          </View>
        )}

        {mode === "barcode" && !barcodeResult && (
          <View style={{ gap: 14 }}>
            <TouchableOpacity
              style={styles.pickBtn}
              onPress={openScanner}
              activeOpacity={0.85}
              testID="scan-barcode-open-btn"
            >
              <Ionicons name="barcode" size={28} color={colors.white} />
              <Text style={styles.pickBtnText}>Scan Barcode</Text>
            </TouchableOpacity>
            <Text
              style={{
                textAlign: "center",
                color: "#64748B",
                fontSize: 12,
                fontWeight: "600",
              }}
            >
              or enter barcode number manually
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TextInput
                value={manualBarcode}
                onChangeText={setManualBarcode}
                placeholder="e.g. 3017624010701"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
                style={[styles.input, { flex: 1 }]}
                testID="scan-barcode-manual-input"
              />
              <TouchableOpacity
                onPress={onManualBarcode}
                disabled={!manualBarcode || barcodeLoading}
                style={styles.manualBtn}
                activeOpacity={0.85}
                testID="scan-barcode-manual-btn"
              >
                {barcodeLoading ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Ionicons name="search" size={20} color={colors.white} />
                )}
              </TouchableOpacity>
            </View>
            {barcodeLoading && <ActivityIndicator color={colors.accent} />}
          </View>
        )}

        {/* Confirmation Results Panel */}
        {result && (
          <View style={{ marginTop: 20 }} testID="scan-result-panel">
            <View style={styles.confidencePill}>
              <Ionicons name="sparkles" size={14} color={colors.accent} />
              <Text style={styles.confidenceText}>
                {Math.round((result.confidence || 0) * 100)}% Confidence
              </Text>
            </View>

            {/* Qloo Cultural Alignment Card */}
            {(result as any).cultural_context && (
              <View style={{
                backgroundColor: "rgba(167,139,250,0.08)",
                borderRadius: 14,
                borderWidth: 1,
                borderColor: "rgba(167,139,250,0.2)",
                padding: 14,
                marginTop: 12,
                gap: 8,
              }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="sparkles" size={16} color="#A78BFA" />
                  <Text style={{ color: "#A78BFA", fontSize: 13, fontWeight: "700", flex: 1 }}>
                    Qloo Cultural Intelligence
                  </Text>
                  {(result as any).cultural_context.taste_alignment_score > 0 && (
                    <View style={{
                      backgroundColor: "rgba(167,139,250,0.2)",
                      paddingHorizontal: 10, paddingVertical: 4,
                      borderRadius: 10,
                    }}>
                      <Text style={{ color: "#A78BFA", fontSize: 13, fontWeight: "800" }}>
                        {(result as any).cultural_context.taste_alignment_score}% match
                      </Text>
                    </View>
                  )}
                </View>
                {(result as any).cultural_context.cultural_tags?.length > 0 && (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {(result as any).cultural_context.cultural_tags.slice(0, 4).map((tag: string) => {
                      const tagMeta = getTasteEntityMeta(tag, "cuisines");
                      return (
                        <View
                          key={tag}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 5,
                            paddingHorizontal: 9,
                            paddingVertical: 4,
                            borderRadius: 10,
                            backgroundColor: tagMeta.bg,
                            borderWidth: 1,
                            borderColor: `${tagMeta.color}35`,
                          }}
                        >
                          <Ionicons name={tagMeta.icon} size={12} color={tagMeta.color} />
                          <Text style={{ color: tagMeta.color, fontSize: 12, fontWeight: "600" }}>{tag}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}
                {(result as any).cultural_context.cross_domain_note ? (
                  <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, lineHeight: 17 }}>
                    {(result as any).cultural_context.cross_domain_note}
                  </Text>
                ) : null}
                {(result as any).cultural_context.taste_dna_updated && (
                  <Text style={{ color: "#10B981", fontSize: 11, fontWeight: "600" }}>
                    ✓ Taste DNA auto-updated
                  </Text>
                )}
              </View>
            )}

            <MealForm
              title={title}
              setTitle={setTitle}
              mealType={mealType}
              setMealType={setMealType}
            />
            <TotalsCard
              totalCal={result.total_calories}
              p={result.total_protein_g}
              c={result.total_carbs_g}
              f={result.total_fat_g}
            />
            <Text style={styles.label}>Detected Ingredients</Text>
            <View style={{ gap: 8 }}>
              {result.foods.map((f, i) => (
                <View key={i} style={styles.foodRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.foodName}>{f.name}</Text>
                    <Text style={styles.foodPortion}>{f.portion}</Text>
                  </View>
                  <Text style={styles.foodCal}>
                    {Math.round(f.calories)} kcal
                  </Text>
                </View>
              ))}
            </View>

            {/* AI Reasoning Panel */}
            {result.reasoning_chain && (
              <View style={styles.reasoningCard}>
                <View style={styles.reasoningHeader}>
                  <Ionicons
                    name="hardware-chip"
                    size={16}
                    color={colors.accent}
                  />
                  <Text style={styles.reasoningTitle}>
                    AI Reasoning ({result.uncertainty_level || "Normal"}{" "}
                    Uncertainty)
                  </Text>
                </View>
                <Text style={styles.reasoningText}>
                  {result.reasoning_chain}
                </Text>

                {result.assumptions_made &&
                  result.assumptions_made.length > 0 && (
                    <View style={{ marginTop: 8 }}>
                      <Text style={styles.assumptionsTitle}>Assumptions:</Text>
                      {result.assumptions_made.map((a, i) => (
                        <Text key={i} style={styles.assumptionItem}>
                          • {a}
                        </Text>
                      ))}
                    </View>
                  )}
              </View>
            )}

            <SaveBar saving={saving} onSave={save} onReset={reset} />
          </View>
        )}

        {barcodeResult && (
          <View style={{ marginTop: 20 }} testID="scan-barcode-result-panel">
            <View style={styles.productHeader}>
              {barcodeResult.image_url ? (
                <Image
                  source={{ uri: barcodeResult.image_url }}
                  style={styles.productImage}
                />
              ) : (
                <View
                  style={[
                    styles.productImage,
                    {
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "#F1F5F9",
                    },
                  ]}
                >
                  <Ionicons name="cube" size={28} color="#64748B" />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.productName}>{barcodeResult.name}</Text>
                {barcodeResult.brand ? (
                  <Text style={styles.productBrand}>{barcodeResult.brand}</Text>
                ) : null}
                <View
                  style={{
                    flexDirection: "row",
                    gap: 6,
                    marginTop: 6,
                    flexWrap: "wrap",
                  }}
                >
                  {barcodeResult.nutrition_grade ? (
                    <Tag
                      label={`Nutri-Score ${barcodeResult.nutrition_grade.toUpperCase()}`}
                      color={gradeColor(barcodeResult.nutrition_grade)}
                    />
                  ) : null}
                  {barcodeResult.nova_group ? (
                    <Tag
                      label={`NOVA ${barcodeResult.nova_group}${barcodeResult.nova_group === 4 ? " (ultra-processed)" : ""}`}
                      color={
                        barcodeResult.nova_group >= 4 ? "#E11D48" : "#0F172A"
                      }
                    />
                  ) : null}
                  {typeof barcodeResult.health_score === "number" ? (
                    <Tag
                      label={`Health ${barcodeResult.health_score}/100`}
                      color={
                        barcodeResult.health_score >= 60 ? "#10B981" : "#E11D48"
                      }
                    />
                  ) : null}
                </View>
              </View>
            </View>
            <MealForm
              title={title}
              setTitle={setTitle}
              mealType={mealType}
              setMealType={setMealType}
            />

            {/* Serving Size Selector */}
            <View style={styles.servingSelectorCard}>
              <Text style={styles.servingHeaderTitle}>
                Serving Size: {barcodeResult.portion || `${baseServingGrams}g`}
              </Text>
              <View style={styles.servingControlsRow}>
                <View>
                  <Text style={styles.servingMainWeight}>{activeGrams}g</Text>
                  <Text style={styles.servingSubText}>
                    {servingsMultiplier}{" "}
                    {servingsMultiplier === 1 ? "serving" : "servings"}
                  </Text>
                </View>

                <View style={styles.stepperContainer}>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() =>
                      setServingsMultiplier((prev) =>
                        Math.max(0.25, prev - 0.25),
                      )
                    }
                  >
                    <Ionicons name="remove" size={18} color="#0F172A" />
                  </TouchableOpacity>
                  <Text style={styles.stepperVal}>{servingsMultiplier}x</Text>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => setServingsMultiplier((prev) => prev + 0.25)}
                  >
                    <Ionicons name="add" size={18} color="#0F172A" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.quickChipsRow}>
                {[0.5, 1.0, 1.5, 2.0, 3.0].map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.chipBtn,
                      servingsMultiplier === m && styles.chipBtnActive,
                    ]}
                    onPress={() => setServingsMultiplier(m)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        servingsMultiplier === m && styles.chipTextActive,
                      ]}
                    >
                      {m}x
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Text style={styles.label}>
              Nutrition Breakdown ({activeGrams}g)
            </Text>
            <TotalsCard
              totalCal={displayCal}
              p={displayP}
              c={displayC}
              f={displayF}
              extras={{
                fiber_g: displayFiber,
                sugar_g: displaySugar,
                sodium_mg: displaySodium,
              }}
            />
            {Array.isArray(barcodeResult?.allergens) &&
              barcodeResult.allergens.length > 0 && (
                <>
                  <Text style={styles.label}>Allergens</Text>
                  <View
                    style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}
                  >
                    {barcodeResult.allergens.map((a) => (
                      <Tag key={a} label={a} color="#E11D48" />
                    ))}
                  </View>
                </>
              )}
            {Array.isArray(barcodeResult?.additives) &&
              barcodeResult.additives.length > 0 && (
                <>
                  <Text style={styles.label}>
                    Additives ({barcodeResult.additives.length})
                  </Text>
                  <View
                    style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}
                  >
                    {barcodeResult.additives.slice(0, 8).map((a) => (
                      <Tag key={a} label={a} color="#64748B" />
                    ))}
                  </View>
                </>
              )}
            <SaveBar saving={saving} onSave={save} onReset={reset} />
          </View>
        )}
      </ScrollView>

      {/* In-app Photo Camera Modal */}
      <Modal
        visible={photoCamOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent
        onRequestClose={() => setPhotoCamOpen(false)}
      >
        <GestureHandlerRootView
          style={{ flex: 1, backgroundColor: colors.black }}
        >
          <GestureDetector gesture={pinchGesture}>
            <View style={{ flex: 1 }} collapsable={false}>
              <CameraView
                ref={photoCamRef}
                style={{ flex: 1 }}
                facing={photoCamFacing}
                enableTorch={torchOn}
                zoom={zoom}
              />
            </View>
          </GestureDetector>

          {/* Target Reticle Viewfinder Overlay */}
          <View style={styles.photoCamGuideWrap} pointerEvents="none">
            <View style={styles.reticleBox}>
              <View style={[styles.cornerBracket, styles.cornerTL]} />
              <View style={[styles.cornerBracket, styles.cornerTR]} />
              <View style={[styles.cornerBracket, styles.cornerBL]} />
              <View style={[styles.cornerBracket, styles.cornerBR]} />
            </View>
            <View style={styles.guidePill}>
              <Ionicons
                name="sparkles"
                size={15}
                color="#FF8A3D"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.photoCamGuideText}>
                Center plate within frame · Pinch to zoom
              </Text>
            </View>
          </View>

          {/* Top Control Bar */}
          <SafeAreaView edges={["top"]} style={styles.photoCamTopBar}>
            <TouchableOpacity
              onPress={() => setPhotoCamOpen(false)}
              style={styles.camGlassBtn}
              testID="scan-photo-close"
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={24} color={colors.white} />
            </TouchableOpacity>

            <View
              style={[
                styles.camTitlePill,
                { backgroundColor: "rgba(255, 255, 255, 1)" },
              ]}
            >
              <NutriLogo size={18} style={{ borderRadius: 4 }} />
              <Text style={{ ...styles.camTitleText, color: "#000000ff" }}>
                AI Food Scanner
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setTorchOn((v) => !v);
              }}
              style={[styles.camGlassBtn, torchOn && styles.torchOnGlass]}
              testID="scan-photo-torch"
              accessibilityLabel="Toggle torch"
              activeOpacity={0.8}
            >
              <Ionicons
                name={torchOn ? "flashlight" : "flashlight-outline"}
                size={20}
                color={torchOn ? "#0F172A" : colors.white}
              />
            </TouchableOpacity>
          </SafeAreaView>

          {/* Try Again / Reset Action Button (exact same style as barcode scanner modal) */}
          <View style={styles.photoCamTryAgainBar} pointerEvents="box-none">
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setPhotoCamOpen(false);
                reset();
              }}
              style={styles.manualEntryBtn}
              activeOpacity={0.85}
              testID="scan-photo-try-again-btn"
            >
              <Ionicons
                name="refresh-outline"
                size={18}
                color="#FFFFFF"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.manualEntryText}>Try Again</Text>
            </TouchableOpacity>
          </View>

          {/* Zoom Multiplier Bar */}
          <View style={styles.zoomWrap} pointerEvents="box-none">
            <View style={styles.zoomPresetsContainer}>
              {ZOOM_PRESETS.map((t) => {
                const isActive = Math.abs(zoom - t) < PRESET_SNAP_THRESHOLD;
                return (
                  <TouchableOpacity
                    key={t}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      zoomRef.current = t;
                      lastPresetRef.current = ZOOM_PRESETS.indexOf(t);
                      setZoom(t);
                    }}
                    style={[
                      styles.zoomPillItem,
                      isActive && styles.zoomPillActive,
                    ]}
                    hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                    testID={`scan-photo-zoom-${t}`}
                  >
                    <Text
                      style={[
                        styles.zoomPillText,
                        isActive && styles.zoomPillTextActive,
                      ]}
                    >
                      {(1 + t * 4).toFixed(t === 0 ? 0 : 1)}x
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Bottom Shutter Control Bar */}
          <SafeAreaView edges={["bottom"]} style={styles.photoCamBottomBar}>
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setPhotoCamFacing((f) => (f === "back" ? "front" : "back"));
              }}
              style={styles.photoCamSideBtn}
              testID="scan-photo-flip"
              activeOpacity={0.8}
            >
              <Ionicons
                name="camera-reverse-outline"
                size={24}
                color={colors.white}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
                  () => {},
                );
                capturePhoto();
              }}
              disabled={capturing}
              style={styles.photoCamShutterOuter}
              testID="scan-photo-capture"
              activeOpacity={0.7}
            >
              {capturing ? (
                <ActivityIndicator size="large" color="#0F172A" />
              ) : (
                <View style={styles.photoCamShutterInner} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setPhotoCamOpen(false);
                pick("gallery");
              }}
              style={styles.photoCamSideBtn}
              testID="scan-photo-gallery"
              activeOpacity={0.8}
            >
              <Ionicons name="images-outline" size={24} color={colors.white} />
            </TouchableOpacity>
          </SafeAreaView>
        </GestureHandlerRootView>
      </Modal>

      {/* Barcode Scanner Modal */}
      <Modal
        visible={scannerOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent
        onRequestClose={() => setScannerOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: colors.black }}>
          <CameraView
            style={{ flex: 1 }}
            enableTorch={scannerTorchOn}
            barcodeScannerSettings={{
              barcodeTypes: [
                "ean13",
                "ean8",
                "upc_a",
                "upc_e",
                "code128",
                "code39",
              ],
            }}
            onBarcodeScanned={onScanned}
          />
          <View style={styles.scannerOverlay}>
            <View style={styles.reticleBoxBarcode}>
              <View
                style={[
                  styles.cornerBracket,
                  styles.cornerBracketBarcode,
                  styles.cornerTL,
                ]}
              />
              <View
                style={[
                  styles.cornerBracket,
                  styles.cornerBracketBarcode,
                  styles.cornerTR,
                ]}
              />
              <View
                style={[
                  styles.cornerBracket,
                  styles.cornerBracketBarcode,
                  styles.cornerBL,
                ]}
              />
              <View
                style={[
                  styles.cornerBracket,
                  styles.cornerBracketBarcode,
                  styles.cornerBR,
                ]}
              />
              <View style={styles.barcodeScanLine} />
            </View>
            <View style={styles.guidePill}>
              <Ionicons
                name="scan-outline"
                size={16}
                color="#38BDF8"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.scannerHint}>
                Align UPC / EAN barcode inside frame to scan
              </Text>
            </View>
          </View>

          {/* Top Bar with Close, Title, and Torch Toggle */}
          <SafeAreaView edges={["top"]} style={styles.photoCamTopBar}>
            <TouchableOpacity
              onPress={() => setScannerOpen(false)}
              style={styles.camGlassBtn}
              testID="scan-barcode-close"
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={24} color={colors.white} />
            </TouchableOpacity>

            <View
              style={[
                styles.camTitlePill,
                { backgroundColor: "rgba(15, 23, 42, 0.65)" },
              ]}
            >
              <Ionicons
                name="barcode"
                size={16}
                color="#38BDF8"
                style={{ marginRight: 6 }}
              />
              <Text style={{ ...styles.camTitleText, color: "#ffffffff" }}>
                Barcode Reader
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setScannerTorchOn((v) => !v);
              }}
              style={[
                styles.camGlassBtn,
                scannerTorchOn && styles.torchOnGlass,
              ]}
              testID="scan-barcode-torch"
              accessibilityLabel="Toggle scanner torch"
              activeOpacity={0.8}
            >
              <Ionicons
                name={scannerTorchOn ? "flashlight" : "flashlight-outline"}
                size={20}
                color={scannerTorchOn ? "#0F172A" : colors.white}
              />
            </TouchableOpacity>
          </SafeAreaView>

          {/* Bottom Bar with Manual Fallback Entry */}
          <SafeAreaView edges={["bottom"]} style={styles.barcodeBottomBar}>
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setScannerOpen(false);
                setManualPromptOpen(true);
              }}
              style={styles.manualEntryBtn}
              activeOpacity={0.85}
              testID="scan-barcode-manual-btn"
            >
              <Ionicons
                name="keypad-outline"
                size={18}
                color="#FFFFFF"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.manualEntryText}>Type Barcode Manually</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Manual Barcode Entry Fallback Modal */}
      <Modal
        visible={manualPromptOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setManualPromptOpen(false)}
      >
        <View style={styles.manualModalBackdrop}>
          <View style={styles.manualModalCard}>
            <View style={styles.manualModalHeader}>
              <Ionicons
                name="barcode-outline"
                size={22}
                color="#0F172A"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.manualModalTitle}>Enter Barcode Number</Text>
            </View>
            <Text style={styles.manualModalSub}>
              Type the 12 or 13-digit UPC/EAN code printed on the product
              packaging.
            </Text>
            <View style={styles.manualInputGroup}>
              <Ionicons
                name="keypad-outline"
                size={18}
                color="#94A3B8"
                style={{ marginRight: 10 }}
              />
              <TextInput
                value={manualBarcode}
                onChangeText={setManualBarcode}
                placeholder="e.g. 012345678901"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
                style={styles.manualInput}
                autoFocus
                testID="scan-manual-barcode-input"
              />
            </View>
            <View style={styles.manualModalActions}>
              <TouchableOpacity
                onPress={() => setManualPromptOpen(false)}
                style={styles.manualCancelBtn}
              >
                <Text style={styles.manualCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (!manualBarcode.trim()) return;
                  setManualPromptOpen(false);
                  onManualBarcode();
                }}
                disabled={!manualBarcode.trim()}
                style={[
                  styles.manualSubmitBtn,
                  !manualBarcode.trim() && styles.manualSubmitDisabled,
                ]}
                testID="scan-manual-barcode-submit"
              >
                <Text style={styles.manualSubmitText}>Lookup Product</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function gradeColor(g: string) {
  const m: any = {
    a: "#10B981",
    b: "#84CC16",
    c: "#F59E0B",
    d: "#F97316",
    e: "#E11D48",
  };
  return m[g.toLowerCase()] || "#0F172A";
}

function Tag({ label, color }: { label: string; color: string }) {
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: color,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: "800",
          color,
          textTransform: "capitalize",
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function MealForm({
  title,
  setTitle,
  mealType,
  setMealType,
}: {
  title: string;
  setTitle: (s: string) => void;
  mealType: any;
  setMealType: (t: any) => void;
}) {
  return (
    <>
      <Text style={styles.label}>Meal Name</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        style={styles.input}
        placeholder="Meal name"
        placeholderTextColor="#94A3B8"
        testID="scan-title-input"
      />
      <Text style={styles.label}>Meal Type</Text>
      <View style={styles.typeRow}>
        {MEAL_TYPES.map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setMealType(t)}
            style={[styles.typeChip, mealType === t && styles.typeChipActive]}
            activeOpacity={0.8}
            testID={`scan-type-${t}`}
          >
            <Text
              style={[
                styles.typeChipText,
                mealType === t && { color: colors.white },
              ]}
            >
              {t}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );
}

function TotalsCard({
  totalCal,
  p,
  c,
  f,
  extras,
}: {
  totalCal: number;
  p: number;
  c: number;
  f: number;
  extras?: {
    fiber_g?: number | null;
    sugar_g?: number | null;
    sodium_mg?: number | null;
  };
}) {
  const rows: { l: string; v: string; macroType?: MacroType }[] = [
    { l: "Calories", v: `${Math.round(totalCal)} kcal` },
    { l: "Protein", v: `${Math.round(p)} g`, macroType: "protein" },
    { l: "Carbs", v: `${Math.round(c)} g`, macroType: "carbs" },
    { l: "Fat", v: `${Math.round(f)} g`, macroType: "fats" },
  ];
  if (extras) {
    if (extras.fiber_g != null)
      rows.push({ l: "Fiber", v: `${Math.round(extras.fiber_g)} g`, macroType: "fiber" });
    if (extras.sugar_g != null)
      rows.push({ l: "Sugar", v: `${Math.round(extras.sugar_g)} g`, macroType: "sugar" });
    if (extras.sodium_mg != null)
      rows.push({ l: "Sodium", v: `${Math.round(extras.sodium_mg)} mg`, macroType: "sodium" });
  }
  return (
    <View style={styles.totalsCard}>
      {rows.map((r, i) => (
        <View
          key={r.l}
          style={[
            styles.totalRow,
            i === rows.length - 1 && { borderBottomWidth: 0 },
          ]}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {r.macroType ? (
              <MacroIcon type={r.macroType} size={22} showBadge={false} />
            ) : (
              <Ionicons name="flame" size={16} color={colors.accent} />
            )}
            <Text style={styles.totalLabel}>{r.l}</Text>
          </View>
          <Text style={styles.totalVal}>{r.v}</Text>
        </View>
      ))}
    </View>
  );
}

function SaveBar({
  saving,
  onSave,
  onReset,
}: {
  saving: boolean;
  onSave: () => void;
  onReset: () => void;
}) {
  return (
    <>
      <TouchableOpacity
        style={styles.saveBtn}
        onPress={onSave}
        disabled={saving}
        activeOpacity={0.85}
        testID="scan-save-btn"
      >
        {saving ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <>
            <Ionicons name="checkmark" size={20} color={colors.white} />
            <Text style={styles.saveBtnText}>Log Meal</Text>
          </>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onReset}
        testID="scan-retake-btn"
        activeOpacity={0.7}
        style={{ marginTop: 14, alignItems: "center" }}
      >
        <Text style={styles.retakeText}>Try Again</Text>
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 140 },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  modeRow: { flexDirection: "row", gap: 8, marginTop: 14, marginBottom: 20 },
  modeChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...shadowSm,
  },
  modeChipActive: { backgroundColor: "#0F172A", borderColor: "#0F172A" },
  modeChipText: { fontWeight: "800", fontSize: 13, color: "#0F172A" },

  pickerRow: { flexDirection: "row", gap: 12 },
  pickBtn: {
    flex: 1,
    backgroundColor: "#0F172A",
    borderRadius: 22,
    paddingVertical: 26,
    alignItems: "center",
    gap: 10,
    ...shadowSm,
  },
  pickBtnText: { color: colors.white, fontWeight: "800", fontSize: 15 },
  previewWrap: {
    borderRadius: 24,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...shadowSm,
  },
  preview: { width: "100%", aspectRatio: 1, resizeMode: "cover" },
  retakeFloatingBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    zIndex: 10,
  },
  retakeFloatingText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "700",
  },
  analyzingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(15, 23, 42, 0.60)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    zIndex: 5,
  },
  scanLaserLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 6,
  },
  analysisGlassCard: {
    backgroundColor: "rgba(15, 23, 42, 0.88)",
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingVertical: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    width: "100%",
    maxWidth: 290,
    ...shadowMd,
  },
  analysisSpinnerBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  analyzingHeading: {
    color: colors.white,
    fontWeight: "900",
    fontSize: 16,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  analysisStepRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  analyzingStepText: {
    color: "#E2E8F0",
    fontWeight: "600",
    fontSize: 13,
  },
  retryContextCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 10,
    ...shadowSm,
  },
  retryHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  retryCardTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  analyzingText: { color: colors.white, fontWeight: "800", fontSize: 14 },
  voiceWrap: { alignItems: "center", paddingVertical: 20 },
  voiceCircle: {
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
    ...shadowMd,
  },
  voiceCircleActive: { backgroundColor: "#E11D48" },
  voiceTimer: {
    fontSize: 34,
    fontWeight: "900",
    color: "#0F172A",
    marginTop: 16,
    letterSpacing: -0.5,
  },
  voiceHint: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 6,
    textAlign: "center",
    paddingHorizontal: 20,
    fontWeight: "500",
  },
  voiceBtn: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#0F172A",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 999,
    ...shadowSm,
  },
  voiceBtnText: { color: colors.white, fontWeight: "800", fontSize: 15 },
  confidencePill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
    marginBottom: 8,
  },
  confidenceText: { color: colors.accent, fontWeight: "800", fontSize: 12 },
  label: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#64748B",
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 52,
    fontSize: 15,
    color: "#0F172A",
    fontWeight: "600",
    ...shadowSm,
  },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...shadowSm,
  },
  typeChipActive: { backgroundColor: "#0F172A", borderColor: "#0F172A" },
  typeChipText: {
    fontWeight: "700",
    color: "#0F172A",
    fontSize: 13,
    textTransform: "capitalize",
  },
  totalsCard: {
    marginTop: 16,
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 16,
    ...shadowSm,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  totalLabel: { fontSize: 14, fontWeight: "700", color: "#64748B" },
  totalVal: { fontSize: 15, fontWeight: "900", color: "#0F172A" },
  foodRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...shadowSm,
  },
  foodName: { fontSize: 14, fontWeight: "800", color: "#0F172A" },
  foodPortion: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "500",
  },
  foodCal: { fontSize: 14, fontWeight: "900", color: "#0F172A" },
  saveBtn: {
    marginTop: 22,
    backgroundColor: colors.accent,
    height: 56,
    borderRadius: 999,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    ...shadowSm,
  },
  saveBtnText: { color: colors.white, fontWeight: "900", fontSize: 16 },
  retakeText: {
    color: "#64748B",
    fontWeight: "700",
    fontSize: 13,
    textDecorationLine: "underline",
  },
  manualBtn: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
    ...shadowSm,
  },
  productHeader: {
    flexDirection: "row",
    gap: 14,
    padding: 14,
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    ...shadowSm,
  },
  productImage: { width: 72, height: 72, borderRadius: 14 },
  productName: { fontSize: 16, fontWeight: "900", color: "#0F172A" },
  productBrand: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "500",
  },
  scannerOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
  },
  scannerFrame: {
    width: 260,
    height: 160,
    borderWidth: 3,
    borderColor: colors.accent,
    borderRadius: 20,
  },
  scannerHint: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  cornerBracketBarcode: {
    borderColor: "#38BDF8",
  },
  barcodeScanLine: {
    position: "absolute",
    top: "50%",
    left: 12,
    right: 12,
    height: 2,
    backgroundColor: "#38BDF8",
    ...Platform.select({
      ios: {
        shadowColor: "#38BDF8",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  barcodeBottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingBottom: 40,
  },
  manualEntryBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  manualEntryText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  manualModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  manualModalCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    ...shadowMd,
  },
  manualModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  manualModalTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F172A",
  },
  manualModalSub: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
    marginBottom: 20,
  },
  manualInputGroup: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 52,
    backgroundColor: "#F8FAFC",
    marginBottom: 20,
  },
  manualInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    height: "100%",
  },
  manualModalActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  manualCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
  },
  manualCancelText: {
    color: "#64748B",
    fontWeight: "700",
    fontSize: 15,
  },
  manualSubmitBtn: {
    flex: 1.5,
    height: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F172A",
  },
  manualSubmitDisabled: {
    backgroundColor: "#CBD5E1",
  },
  manualSubmitText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
  },
  scannerTopBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "flex-end",
    padding: 12,
  },
  photoCamGuideWrap: {
    position: "absolute",
    top: 120,
    left: 20,
    right: 20,
    alignItems: "center",
  },
  reticleBox: {
    width: 270,
    height: 270,
    position: "relative",
    marginBottom: 24,
  },
  reticleBoxBarcode: {
    width: 280,
    height: 180,
    position: "relative",
    marginBottom: 24,
  },
  cornerBracket: {
    position: "absolute",
    width: 28,
    height: 28,
    borderColor: "#FFFFFF",
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3.5,
    borderLeftWidth: 3.5,
    borderTopLeftRadius: 16,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3.5,
    borderRightWidth: 3.5,
    borderTopRightRadius: 16,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3.5,
    borderLeftWidth: 3.5,
    borderBottomLeftRadius: 16,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3.5,
    borderRightWidth: 3.5,
    borderBottomRightRadius: 16,
  },
  guidePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
  },
  photoCamGuideText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  photoCamTopBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  camGlassBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
  },
  torchOnGlass: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FFFFFF",
  },
  camTitlePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
  },
  camTitleText: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  photoCamBottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingBottom: 40,
    paddingTop: 20,
  },
  photoCamSideBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
  },
  photoCamShutterOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  photoCamShutterInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FFFFFF",
  },
  photoCamTryAgainBar: {
    position: "absolute",
    bottom: 185,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  camTryAgainBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  camTryAgainText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  zoomWrap: {
    position: "absolute",
    bottom: 135,
    left: 24,
    right: 24,
    alignItems: "center",
  },
  zoomPresetsContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    borderRadius: 999,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
  },
  zoomPillItem: {
    width: 42,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  zoomPillActive: {
    backgroundColor: colors.accent || "#FF5E00",
  },
  zoomPillText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 13,
    fontWeight: "700",
  },
  zoomPillTextActive: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  reasoningCard: {
    backgroundColor: colors.accentSoft,
    borderRadius: 20,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.accent,
    ...shadowSm,
  },
  reasoningHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  reasoningTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.accent,
    letterSpacing: 0.5,
  },
  reasoningText: {
    fontSize: 14,
    color: "#0F172A",
    lineHeight: 22,
    fontWeight: "500",
  },
  assumptionsTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
    marginBottom: 4,
  },
  assumptionItem: { fontSize: 13, color: "#64748B", lineHeight: 20 },
  transcriptCard: {
    marginTop: 20,
    width: "100%",
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...shadowSm,
  },
  transcriptLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  transcriptText: {
    fontSize: 14,
    color: "#0F172A",
    marginTop: 6,
    fontStyle: "italic",
    lineHeight: 20,
  },
  servingSelectorCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 16,
    marginTop: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...shadowSm,
  },
  servingHeaderTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#64748B",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  servingControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  servingMainWeight: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0F172A",
  },
  servingSubText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
    marginTop: 2,
  },
  stepperContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    ...shadowSm,
  },
  stepperVal: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    paddingHorizontal: 12,
  },
  quickChipsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  chipBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  chipBtnActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
  },
  chipTextActive: {
    color: colors.white,
  },
});
