import api from "./api";

export interface SocialGroupItem {
  id: string;
  name: string;
  description: string;
  image_url?: string;
  cover_image_url?: string;
  category: string;
  privacy: "public" | "private";
  member_count: number;
  max_members?: number;
  average_streak: number;
  user_status: "none" | "active" | "pending" | "muted" | "banned";
  role?: "owner" | "moderator" | "member";
  unread_count?: number;
  invite_code: string;
}

export interface GroupDetailsResponse extends SocialGroupItem {
  user_role: "owner" | "moderator" | "member" | "none";
  user_status: "active" | "pending" | "muted" | "banned" | "none";
  rules: string[];
  owner: {
    user_id: string;
    name: string;
  };
  created_at: string;
}

export interface GroupMessageItem {
  id: string;
  user_id: string;
  sender_name: string;
  sender_avatar?: string;
  content: string;
  media_type?: "image" | "sticker" | "gif";
  media_url?: string;
  is_edited: boolean;
  is_deleted: boolean;
  is_pinned: boolean;
  parent_message?: {
    id: string;
    sender_name: string;
    content: string;
  };
  reactions: {
    emoji: string;
    users: string[];
  }[];
  created_at: string;
}

export interface LeaderboardMember {
  rank: number;
  user_id: string;
  username: string;
  avatar?: string;
  current_streak: number;
  longest_streak: number;
  total_meals: number;
  score: number;
  is_current_user: boolean;
}

export interface PublicUserProfile {
  user_id: string;
  username: string;
  avatar?: string;
  bio: string;
  join_date: string;
  current_streak: number;
  longest_streak: number;
  total_meals_logged?: number;
  water_streak?: number;
  workout_streak?: number;
  groups_joined: number;
  badges: {
    id: string;
    name: string;
    category: string;
    rarity: "common" | "rare" | "epic" | "legendary";
    unlocked_at: string;
  }[];
}

export const groupsApi = {
  // Discovery & Fetching
  getDiscoverGroups: async (
    query?: string,
    category?: string,
    tab: string = "trending",
    page: number = 1,
  ): Promise<{ groups: SocialGroupItem[]; page: number }> => {
    const res = await api.get("/groups/discover", {
      params: { query, category, tab, page, limit: 15 },
    });
    return res.data;
  },

  getMyGroups: async (): Promise<{ groups: SocialGroupItem[] }> => {
    const res = await api.get("/groups/my");
    return res.data;
  },

  getGroupDetails: async (groupId: string): Promise<GroupDetailsResponse> => {
    const res = await api.get(`/groups/${groupId}`);
    return res.data;
  },

  // Creation & Actions
  createGroup: async (payload: {
    name: string;
    description: string;
    category: string;
    privacy: "public" | "private";
    max_members?: number;
    invite_code?: string;
    image_url?: string;
    rules?: string[];
  }) => {
    const res = await api.post("/groups", payload);
    return res.data;
  },

  joinGroup: async (groupId: string) => {
    const res = await api.post(`/groups/${groupId}/join`);
    return res.data;
  },

  joinGroupCode: async (inviteCode: string) => {
    const res = await api.post("/groups/join-by-code", {
      invite_code: inviteCode,
    });
    return res.data;
  },

  leaveGroup: async (groupId: string) => {
    const res = await api.post(`/groups/${groupId}/leave`);
    return res.data;
  },

  // Members & Roles
  getMembers: async (groupId: string, query?: string, role?: string) => {
    const res = await api.get(`/groups/${groupId}/members`, {
      params: { query, role },
    });
    return res.data;
  },

  changeRole: async (groupId: string, targetUserId: string, role: string) => {
    const res = await api.post(
      `/groups/${groupId}/members/${targetUserId}/role`,
      { role },
    );
    return res.data;
  },

  kickMember: async (groupId: string, targetUserId: string) => {
    const res = await api.post(
      `/groups/${groupId}/members/${targetUserId}/kick`,
    );
    return res.data;
  },

  // Messages & Realtime
  getMessages: async (
    groupId: string,
    before?: string,
  ): Promise<{ messages: GroupMessageItem[] }> => {
    const res = await api.get(`/groups/${groupId}/messages`, {
      params: { before, limit: 40 },
    });
    return res.data;
  },

  sendMessage: async (
    groupId: string,
    content: string,
    mediaType?: string,
    mediaUrl?: string,
    parentId?: string,
  ) => {
    const res = await api.post(`/groups/${groupId}/messages`, {
      content,
      media_type: mediaType,
      media_url: mediaUrl,
      parent_id: parentId,
    });
    return res.data;
  },

  reactToMessage: async (groupId: string, messageId: string, emoji: string) => {
    const res = await api.post(
      `/groups/${groupId}/messages/${messageId}/react`,
      { emoji },
    );
    return res.data;
  },

  togglePinMessage: async (groupId: string, messageId: string) => {
    const res = await api.post(`/groups/${groupId}/messages/${messageId}/pin`);
    return res.data;
  },

  deleteMessage: async (groupId: string, messageId: string) => {
    const res = await api.delete(`/groups/${groupId}/messages/${messageId}`);
    return res.data;
  },

  // Leaderboard
  getLeaderboard: async (
    groupId: string,
    timeframe: string = "weekly",
  ): Promise<{ leaderboard: LeaderboardMember[] }> => {
    const res = await api.get(`/groups/${groupId}/leaderboard`, {
      params: { timeframe },
    });
    return res.data;
  },

  // User Mini Profile
  getPublicProfile: async (userId: string): Promise<PublicUserProfile> => {
    const res = await api.get(`/groups/users/${userId}/public-profile`);
    return res.data;
  },

  // Moderation Report
  submitReport: async (payload: {
    group_id: string;
    target_user_id?: string;
    message_id?: string;
    reason: string;
    details?: string;
  }) => {
    const res = await api.post("/groups/reports", payload);
    return res.data;
  },
};
