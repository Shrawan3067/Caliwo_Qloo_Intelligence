import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PremiumBadge } from "./Badges";
import { BadgeItem } from "@/src/modules/activity/engines/achievement.engine";

interface ShareBadgeModalProps {
  badge: BadgeItem | null;
  userStreak?: number;
  visible: boolean;
  onClose: () => void;
}

export function ShareBadgeModal({
  badge,
  userStreak = 0,
  visible,
  onClose,
}: ShareBadgeModalProps) {
  if (!badge) return null;

  const handleNativeShare = async () => {
    try {
      await Share.share({
        message: `🏆 I just unlocked the "${badge.name}" badge on Caliwo! ${badge.desc}. Download Caliwo and join me: https://caliwo.app`,
      });
      onClose();
    } catch (err) {
      console.warn("Share failed:", err);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={20} color="#64748B" />
          </TouchableOpacity>

          {/* Dynamic Share Card Template */}
          <View style={styles.shareCardPreview}>
            <View style={styles.brandRow}>
              <View style={styles.logoPill}>
                <Ionicons name="leaf" size={14} color="#10B981" />
                <Text style={styles.brandText}>CALIWO</Text>
              </View>
              {userStreak > 0 && (
                <View style={styles.streakPill}>
                  <Ionicons name="flame" size={14} color="#E11D48" />
                  <Text style={styles.streakText}>{userStreak} DAY STREAK</Text>
                </View>
              )}
            </View>

            <View style={styles.badgeWrapper}>
              <PremiumBadge
                id={badge.id}
                kind={badge.icon_kind}
                unlocked={badge.unlocked}
                value={badge.value}
              />
            </View>

            <Text style={styles.badgeTitle}>{badge.name}</Text>
            <Text style={styles.badgeDesc}>"{badge.desc}"</Text>

            <View style={styles.cardFooter}>
              <Text style={styles.footerTag}>CALIWO MILESTONES</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handleNativeShare}
            activeOpacity={0.85}
          >
            <Ionicons name="share-outline" size={18} color="#FFFFFF" />
            <Text style={styles.actionBtnText}>Share Achievement</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    justifyContent: "flex-end",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: 36,
    alignItems: "center",
  },
  closeBtn: {
    alignSelf: "flex-end",
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    marginBottom: 12,
  },
  shareCardPreview: {
    width: "100%",
    backgroundColor: "#0F172A",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  brandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 20,
  },
  logoPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  brandText: {
    color: "#34D399",
    fontWeight: "900",
    fontSize: 11,
    letterSpacing: 1,
  },
  streakPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(225, 29, 72, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  streakText: {
    color: "#FB7185",
    fontWeight: "900",
    fontSize: 11,
    letterSpacing: 0.5,
  },
  badgeWrapper: {
    marginVertical: 12,
    transform: [{ scale: 1.2 }],
  },
  badgeTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -0.4,
    marginTop: 12,
    marginBottom: 6,
  },
  badgeDesc: {
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
    fontStyle: "italic",
    marginBottom: 20,
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
    paddingTop: 12,
    width: "100%",
    alignItems: "center",
  },
  footerTag: {
    color: "#64748B",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  actionBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#10B981",
    paddingVertical: 16,
    borderRadius: 18,
  },
  actionBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
});
