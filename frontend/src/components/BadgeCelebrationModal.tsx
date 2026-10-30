import React, { useEffect, useRef } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PremiumBadge } from "./Badges";
import { BadgeItem, markCelebrationSeen } from "@/src/modules/activity/engines/achievement.engine";

interface CelebrationModalProps {
  badge: BadgeItem | null;
  visible: boolean;
  onClose: () => void;
  onShare?: (badge: BadgeItem) => void;
}

export function BadgeCelebrationModal({
  badge,
  visible,
  onClose,
  onShare,
}: CelebrationModalProps) {
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && badge) {
      scaleAnim.setValue(0.3);
      opacityAnim.setValue(0);

      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
      ]).start();

      // Mark as seen on server asynchronously
      markCelebrationSeen([badge.id]).catch(() => {});
    }
  }, [visible, badge]);

  if (!badge) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.card,
            {
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
        >
          {/* Sparkles Top Decoration */}
          <View style={styles.topIconWrap}>
            <Ionicons name="sparkles" size={28} color="#F59E0B" />
          </View>

          <Text style={styles.kicker}>BADGE UNLOCKED</Text>

          {/* Badge Medallion */}
          <View style={styles.badgeContainer}>
            <PremiumBadge
              id={badge.id}
              kind={badge.icon_kind}
              unlocked={true}
              value={badge.value}
            />
          </View>

          <Text style={styles.title}>{badge.name}</Text>
          <Text style={styles.desc}>{badge.desc}</Text>

          {/* Action Buttons */}
          <View style={styles.btnRow}>
            {onShare && (
              <TouchableOpacity
                style={styles.shareBtn}
                onPress={() => {
                  onShare(badge);
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="share-outline" size={18} color="#FFFFFF" />
                <Text style={styles.shareBtnText}>Share</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.continueBtn}
              onPress={onClose}
              activeOpacity={0.85}
            >
              <Text style={styles.continueBtnText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#FFFFFF",
    borderRadius: 32,
    padding: 28,
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.15,
        shadowRadius: 30,
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  topIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  kicker: {
    fontSize: 11,
    fontWeight: "900",
    color: "#10B981",
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  badgeContainer: {
    marginVertical: 10,
    transform: [{ scale: 1.15 }],
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.4,
    marginTop: 12,
    marginBottom: 6,
    textAlign: "center",
  },
  desc: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
    fontWeight: "500",
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  shareBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#0F172A",
    paddingVertical: 14,
    borderRadius: 16,
  },
  shareBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  continueBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#10B981",
    paddingVertical: 14,
    borderRadius: 16,
  },
  continueBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
});
