import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius } from "@/src/theme";
import { groupsApi } from "@/src/lib/groupsApi";

interface Props {
  visible: boolean;
  groupId: string;
  targetUserId?: string;
  messageId?: string;
  onClose: () => void;
}

const REASONS = [
  "Spam or Advertising",
  "Harassment or Bullying",
  "Inappropriate Content",
  "Hate Speech",
  "Fake Profile / Impersonation",
  "Other",
];

export const ReportModal: React.FC<Props> = ({
  visible,
  groupId,
  targetUserId,
  messageId,
  onClose,
}) => {
  const [selectedReason, setSelectedReason] = useState(REASONS[0]);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await groupsApi.submitReport({
        group_id: groupId,
        target_user_id: targetUserId,
        message_id: messageId,
        reason: selectedReason,
        details,
      });
      Alert.alert("Report Received", "Thank you. Our moderation team will review this report shortly.");
      onClose();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Report Content</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <Text style={styles.label}>Select Reason</Text>
            <View style={styles.reasonsList}>
              {REASONS.map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => setSelectedReason(r)}
                  style={[styles.reasonOption, selectedReason === r && styles.reasonSelected]}
                >
                  <Ionicons
                    name={selectedReason === r ? "radio-button-on" : "radio-button-off"}
                    size={18}
                    color={selectedReason === r ? colors.accent : colors.textTertiary}
                  />
                  <Text style={[styles.reasonText, selectedReason === r && styles.reasonTextSelected]}>
                    {r}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Additional Details (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Describe the issue..."
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={3}
              value={details}
              onChangeText={setDetails}
            />

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={submitting}
              style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
            >
              <Text style={styles.submitBtnText}>
                {submitting ? "Submitting..." : "Submit Report"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 32,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  closeButton: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
  },
  content: {
    padding: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.textPrimary,
    marginBottom: 10,
    marginTop: 8,
  },
  reasonsList: {
    gap: 8,
    marginBottom: 16,
  },
  reasonOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 10,
  },
  reasonSelected: {
    borderColor: colors.accent,
    backgroundColor: "#FFF0E5",
  },
  reasonText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  reasonTextSelected: {
    color: colors.accent,
    fontWeight: "800",
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    fontSize: 13,
    color: colors.textPrimary,
    textAlignVertical: "top",
    marginBottom: 20,
  },
  submitBtn: {
    backgroundColor: colors.danger,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: "center",
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
});
