import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import {
  useAudioRecorder,
  createAudioPlayer,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  RecordingPresets,
  AudioPlayer,
} from "expo-audio";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Paths, writeAsStringAsync } from "expo-file-system";
import { colors } from "@/src/theme";
import { getToken, BASE_URL } from "@/src/lib/api";

type State = "idle" | "listening" | "processing" | "speaking";

export default function VoiceMode() {
  const router = useRouter();
  const [state, setState] = useState<State>("idle");
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [player, setPlayer] = useState<AudioPlayer | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [reply, setReply] = useState<string>("");

  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    requestRecordingPermissionsAsync();
    setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
    });
    return () => {
      if (player) player.release();
      // recorder is managed by useAudioRecorder
    };
  }, [player]);

  useEffect(() => {
    if (
      state === "listening" ||
      state === "processing" ||
      state === "speaking"
    ) {
      const fast = state === "listening" || state === "speaking";
      scale.value = withRepeat(
        withSequence(
          withTiming(1.5, {
            duration: fast ? 500 : 1200,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(1, {
            duration: fast ? 500 : 1200,
            easing: Easing.inOut(Easing.ease),
          }),
        ),
        -1, // infinite repeat
        true, // reverse
      );
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.2, { duration: fast ? 500 : 1200 }),
          withTiming(0.8, { duration: fast ? 500 : 1200 }),
        ),
        -1,
        true,
      );
    } else {
      scale.value = withTiming(1);
      opacity.value = withTiming(0.5);
    }
  }, [state, opacity, scale]);

  const animatedOrbStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
      backgroundColor: state === "processing" ? colors.border : colors.accent,
    };
  });

  const startRecording = async () => {
    try {
      if (player) player.release();

      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) return;

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await recorder.prepareToRecordAsync();
      recorder.record();
      setState("listening");
      setTranscript("");
      setReply("");
    } catch (err) {
      console.error("Failed to start recording", err);
    }
  };

  const stopRecording = async () => {
    if (!recorder.isRecording) return;
    setState("processing");
    try {
      await recorder.stop();
      const uri = recorder.uri;

      if (uri) {
        await uploadAudio(uri);
      } else {
        setState("idle");
      }
    } catch (error) {
      console.error(error);
      setState("idle");
    }
  };

  const uploadAudio = async (uri: string) => {
    try {
      const formData = new FormData();
      formData.append("audio", {
        uri,
        name: "voice.m4a",
        type: "audio/m4a",
      } as any);

      const token = await getToken();

      // We use fetch directly because Axios with FormData + React Native can be tricky
      const response = await fetch(`${BASE_URL}/api/coach/voice`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Voice processing failed");
      }

      setTranscript(data.user_text);
      setReply(data.reply_text);

      // Play Audio
      await playBase64Audio(data.audio_base64);
    } catch (err) {
      console.error(err);
      setState("idle");
    }
  };

  const playBase64Audio = async (base64Audio: string) => {
    try {
      setState("speaking");
      const uri = (Paths.document.uri || "") + "reply.mp3";
      await writeAsStringAsync(uri, base64Audio, {
        encoding: "base64",
      });

      const newPlayer = createAudioPlayer(uri);
      newPlayer.play();
      setPlayer(newPlayer);

      // We can't easily listen to just finish natively without useAudioPlayerStatus or a listener,
      // but in expo-audio the player stops automatically. We can simulate idle after duration,
      // or we can just leave it as speaking and let user interrupt.
      // For now, let's just set state to idle after an estimated time or assume it's speaking.
      setTimeout(() => setState("idle"), 3000); // Temporary fallback for didJustFinish
    } catch (err) {
      console.error(err);
      setState("idle");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
        <Ionicons name="close" size={28} color={colors.textPrimary} />
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.orbContainer}>
          <Animated.View style={[styles.orb, animatedOrbStyle]} />
        </View>

        <Text style={styles.statusText}>
          {state === "idle"
            ? "Tap to speak"
            : state === "listening"
              ? "Listening..."
              : state === "processing"
                ? "Thinking..."
                : "Caliwo Coach"}
        </Text>

        {transcript ? (
          <Text style={styles.transcriptText}>&quot;{transcript}&quot;</Text>
        ) : null}

        {reply ? <Text style={styles.replyText}>{reply}</Text> : null}
      </View>

      <View style={styles.footer}>
        {state === "idle" || state === "speaking" ? (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.black }]}
            onPress={startRecording}
          >
            <Ionicons name="mic" size={32} color={colors.white} />
          </TouchableOpacity>
        ) : state === "listening" ? (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.accent }]}
            onPress={stopRecording}
          >
            <Ionicons name="stop" size={32} color={colors.white} />
          </TouchableOpacity>
        ) : (
          <View
            style={[styles.actionBtn, { backgroundColor: colors.border }]}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  closeBtn: {
    position: "absolute",
    top: 60,
    right: 24,
    zIndex: 10,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  orbContainer: {
    width: 200,
    height: 200,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 40,
  },
  orb: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  statusText: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.textPrimary,
    marginBottom: 20,
    textAlign: "center",
  },
  transcriptText: {
    fontSize: 16,
    color: colors.textSecondary,
    fontStyle: "italic",
    textAlign: "center",
    marginBottom: 10,
  },
  replyText: {
    fontSize: 18,
    color: colors.textPrimary,
    fontWeight: "500",
    textAlign: "center",
    marginTop: 20,
    lineHeight: 26,
  },
  footer: {
    height: 140,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
});
