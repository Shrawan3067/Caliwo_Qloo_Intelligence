import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import Svg, { Rect, Path } from "react-native-svg";
import { colors, radius } from "@/src/theme";

interface Props {
  visible: boolean;
  groupName: string;
  inviteCode: string;
  onClose: () => void;
}

export const GroupShareModal: React.FC<Props> = ({
  visible,
  groupName,
  inviteCode,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  const shareUrl = `caliwo://group/${inviteCode}`;

  const copyCode = async () => {
    await Clipboard.setStringAsync(inviteCode);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        title: `Join ${groupName} on Nutri AI`,
        message: `Hey! Join my fitness & nutrition community "${groupName}" on Nutri AI! Use Invite Code: ${inviteCode} or open: ${shareUrl}`,
      });
    } catch (e) {
      console.error(e);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Share Group</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <Text style={styles.groupNameText}>{groupName}</Text>
            <Text style={styles.subText}>Invite friends to track streaks and meals together!</Text>

            {/* Simulated QR Code Canvas */}
            <View style={styles.qrContainer}>
              <Svg width={140} height={140} viewBox="0 0 100 100">
                <Rect x="0" y="0" width="100" height="100" fill="#FFFFFF" />
                {/* Corner Markers */}
                <Rect x="10" y="10" width="25" height="25" fill="#0F172A" />
                <Rect x="14" y="14" width="17" height="17" fill="#FFFFFF" />
                <Rect x="18" y="18" width="9" height="9" fill="#FF5E00" />

                <Rect x="65" y="10" width="25" height="25" fill="#0F172A" />
                <Rect x="69" y="14" width="17" height="17" fill="#FFFFFF" />
                <Rect x="73" y="18" width="9" height="9" fill="#FF5E00" />

                <Rect x="10" y="65" width="25" height="25" fill="#0F172A" />
                <Rect x="14" y="69" width="17" height="17" fill="#FFFFFF" />
                <Rect x="18" y="73" width="9" height="9" fill="#FF5E00" />

                {/* Random Matrix Pattern */}
                <Path
                  d="M 45 10 h 10 v 10 h -10 z M 40 30 h 15 v 10 h -15 z M 65 45 h 10 v 15 h -10 z M 45 65 h 20 v 10 h -20 z M 50 80 h 15 v 10 h -15 z M 75 75 h 10 v 15 h -10 z"
                  fill="#0F172A"
                />
              </Svg>
            </View>

            {/* Invite Code Box */}
            <View style={styles.codeBox}>
              <View>
                <Text style={styles.codeLabel}>INVITE CODE</Text>
                <Text style={styles.codeValue}>{inviteCode}</Text>
              </View>
              <TouchableOpacity onPress={copyCode} style={styles.copyBtn} activeOpacity={0.8}>
                <Ionicons
                  name={copied ? "checkmark-circle" : "copy-outline"}
                  size={18}
                  color="#FFFFFF"
                />
                <Text style={styles.copyBtnText}>{copied ? "Copied!" : "Copy"}</Text>
              </TouchableOpacity>
            </View>

            {/* Native Share Button */}
            <TouchableOpacity onPress={handleShare} style={styles.shareBtn} activeOpacity={0.85}>
              <Ionicons name="share-social-outline" size={20} color="#FFFFFF" />
              <Text style={styles.shareBtnText}>Share Invite Link</Text>
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
    backgroundColor: "rgba(0, 0, 0, 0.5)",
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
    padding: 24,
    alignItems: "center",
  },
  groupNameText: {
    fontSize: 22,
    fontWeight: "900",
    color: colors.textPrimary,
    textAlign: "center",
  },
  subText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: "center",
  },
  qrContainer: {
    marginVertical: 20,
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: "#F1F5F9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  codeBox: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16,
  },
  codeLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: colors.textTertiary,
    letterSpacing: 0.5,
  },
  codeValue: {
    fontSize: 20,
    fontWeight: "900",
    color: colors.accent,
    letterSpacing: 2,
    marginTop: 2,
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.sm,
    gap: 6,
  },
  copyBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  shareBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: radius.md,
    gap: 8,
  },
  shareBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
});
