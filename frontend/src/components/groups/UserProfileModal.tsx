import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius } from "@/src/theme";
import { groupsApi, PublicUserProfile } from "@/src/lib/groupsApi";

interface Props {
  visible: boolean;
  userId: string | null;
  onClose: () => void;
}

export const UserProfileModal: React.FC<Props> = ({ visible, userId, onClose }) => {
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && userId) {
      loadProfile(userId);
    } else {
      setProfile(null);
    }
  }, [visible, userId]);

  const loadProfile = async (uid: string) => {
    setLoading(true);
    try {
      const data = await groupsApi.getPublicProfile(uid);
      setProfile(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Member Profile</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {loading || !profile ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={colors.accent} />
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
              {/* Avatar & Main Badge Info */}
              <View style={styles.avatarSection}>
                <View style={styles.avatarWrapper}>
                  {profile.avatar ? (
                    <Image source={{ uri: profile.avatar }} style={styles.avatarImage} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarText}>{profile.username[0]?.toUpperCase() || "U"}</Text>
                    </View>
                  )}
                  <View style={styles.onlineBadge} />
                </View>
                <Text style={styles.username}>{profile.username}</Text>
                <Text style={styles.bio}>{profile.bio}</Text>
                <Text style={styles.joinedDate}>Joined {profile.join_date}</Text>
              </View>

              {/* Streaks & Quick Stats Grid */}
              <View style={styles.statsGrid}>
                <View style={[styles.statCard, { backgroundColor: "#FFF4EC" }]}>
                  <Ionicons name="flame" size={24} color="#FF5E00" />
                  <Text style={styles.statValue}>{profile.current_streak} Days</Text>
                  <Text style={styles.statLabel}>Current Streak</Text>
                </View>

                <View style={[styles.statCard, { backgroundColor: "#EEF2FF" }]}>
                  <Ionicons name="flash" size={24} color="#4F46E5" />
                  <Text style={styles.statValue}>{profile.longest_streak} Days</Text>
                  <Text style={styles.statLabel}>Best Streak</Text>
                </View>

                <View style={[styles.statCard, { backgroundColor: "#ECFDF5" }]}>
                  <Ionicons name="restaurant" size={24} color="#10B981" />
                  <Text style={styles.statValue}>
                    {profile.total_meals_logged !== undefined ? profile.total_meals_logged : "Hidden"}
                  </Text>
                  <Text style={styles.statLabel}>Meals Logged</Text>
                </View>

                <View style={[styles.statCard, { backgroundColor: "#FEF3C7" }]}>
                  <Ionicons name="people" size={24} color="#D97706" />
                  <Text style={styles.statValue}>{profile.groups_joined}</Text>
                  <Text style={styles.statLabel}>Groups Joined</Text>
                </View>
              </View>

              {/* Achievements & Badges Section */}
              <View style={styles.badgesSection}>
                <Text style={styles.sectionTitle}>Unlocked Achievements</Text>

                {profile.badges && profile.badges.length > 0 ? (
                  <View style={styles.badgesGrid}>
                    {profile.badges.map((b) => (
                      <View key={b.id} style={styles.badgeCard}>
                        <View style={[styles.badgeIcon, getRarityStyle(b.rarity)]}>
                          <Ionicons name="trophy" size={20} color={getRarityColor(b.rarity)} />
                        </View>
                        <Text style={styles.badgeName}>{b.name}</Text>
                        <Text style={[styles.badgeRarity, { color: getRarityColor(b.rarity) }]}>
                          {b.rarity.toUpperCase()}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyBadges}>
                    <Ionicons name="ribbon-outline" size={36} color={colors.textTertiary} />
                    <Text style={styles.emptyText}>No achievements unlocked yet.</Text>
                  </View>
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const getRarityColor = (rarity: string) => {
  switch (rarity) {
    case "legendary":
      return "#F59E0B";
    case "epic":
      return "#8B5CF6";
    case "rare":
      return "#3B82F6";
    default:
      return "#10B981";
  }
};

const getRarityStyle = (rarity: string) => {
  switch (rarity) {
    case "legendary":
      return { backgroundColor: "#FEF3C7", borderColor: "#F59E0B" };
    case "epic":
      return { backgroundColor: "#F3E8FF", borderColor: "#8B5CF6" };
    case "rare":
      return { backgroundColor: "#EFF6FF", borderColor: "#3B82F6" };
    default:
      return { backgroundColor: "#ECFDF5", borderColor: "#10B981" };
  }
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
    maxHeight: Dimensions.get("window").height * 0.85,
    minHeight: 400,
    paddingBottom: 24,
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
  loadingBox: {
    paddingVertical: 80,
    alignItems: "center",
  },
  content: {
    padding: 20,
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 20,
  },
  avatarWrapper: {
    position: "relative",
    marginBottom: 12,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "900",
  },
  onlineBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#10B981",
    borderWidth: 2.5,
    borderColor: "#FFFFFF",
  },
  username: {
    fontSize: 20,
    fontWeight: "900",
    color: colors.textPrimary,
  },
  bio: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: "center",
  },
  joinedDate: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 6,
    fontWeight: "600",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  statCard: {
    width: "48%",
    padding: 14,
    borderRadius: radius.md,
    marginBottom: 12,
    alignItems: "center",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "900",
    color: colors.textPrimary,
    marginTop: 6,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
    fontWeight: "600",
  },
  badgesSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.textPrimary,
    marginBottom: 14,
  },
  badgesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  badgeCard: {
    width: "30%",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  badgeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  badgeName: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.textPrimary,
    textAlign: "center",
  },
  badgeRarity: {
    fontSize: 9,
    fontWeight: "900",
    marginTop: 2,
  },
  emptyBadges: {
    alignItems: "center",
    paddingVertical: 24,
    backgroundColor: "#F8FAFC",
    borderRadius: radius.md,
  },
  emptyText: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 6,
  },
});
