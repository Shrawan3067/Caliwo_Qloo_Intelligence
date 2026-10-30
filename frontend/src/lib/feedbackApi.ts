import api from "./api";

export type PostType = "feature_request" | "bug_report" | "error_report" | "general_feedback";
export type PostStatus =
  | "under_review"
  | "planned"
  | "in_progress"
  | "testing"
  | "released"
  | "fixed"
  | "duplicate"
  | "needs_info"
  | "declined"
  | "closed";

export interface FeedbackPostItem {
  id: string;
  user_id: string;
  author_name: string;
  author_avatar?: string;
  post_type: PostType;
  title: string;
  description: string;
  category: string;
  status: PostStatus;
  votes_count: number;
  trending_score: number;
  comments_count: number;
  has_voted: boolean;
  is_following?: boolean;
  app_version?: string;
  platform?: string;
  device_model?: string;
  os_version?: string;
  steps_to_reproduce?: string;
  expected_behaviour?: string;
  actual_behaviour?: string;
  media_urls?: string[];
  created_at: string;
  updated_at: string;
}

export interface FeedbackCommentItem {
  id: string;
  post_id: string;
  user_id: string;
  author_name: string;
  author_avatar?: string;
  parent_id?: string;
  content: string;
  is_official_dev_response: boolean;
  is_accepted_answer: boolean;
  is_pinned: boolean;
  reactions: Record<string, string[]>;
  created_at: string;
}

export interface ChangelogReleaseItem {
  id: string;
  version: string;
  release_date: string;
  title: string;
  description: string;

  new_features: string[];
  improvements: string[];
  bug_fixes: string[];
  breaking_changes: string[];
  reactions: Record<string, number>;
  created_at: string;
}

export interface SimilarPostItem {
  id: string;
  title: string;
  category: string;
  status: PostStatus;
  votes_count: number;
  author_name: string;
}

export const feedbackApi = {
  // Feed & Filtering
  getPosts: async (params?: {
    post_type?: string;
    category?: string;
    status?: string;
    search?: string;
    sort?: "most_voted" | "trending" | "newest" | "recently_updated";
    my_posts?: boolean;
    page?: number;
  }): Promise<{ posts: FeedbackPostItem[] }> => {
    const res = await api.get("/feedback/posts", { params });
    return res.data;
  },

  // Duplicate Check
  checkDuplicates: async (title: string, category?: string): Promise<{ similar_posts: SimilarPostItem[] }> => {
    const res = await api.post("/feedback/check-duplicates", { title, category });
    return res.data;
  },

  // Create Post
  createPost: async (payload: {
    post_type: PostType;
    title: string;
    description: string;
    category: string;
    app_version?: string;
    platform?: string;
    device_model?: string;
    os_version?: string;
    locale?: string;
    timezone?: string;
    steps_to_reproduce?: string;
    expected_behaviour?: string;
    actual_behaviour?: string;
    media_urls?: string[];
  }): Promise<{ ok: boolean; id: string; message: string }> => {
    const res = await api.post("/feedback/posts", payload);
    return res.data;
  },

  // Post Details
  getPostDetails: async (postId: string): Promise<{ post: FeedbackPostItem }> => {
    const res = await api.get(`/feedback/posts/${postId}`);
    return res.data;
  },

  // Upvote Toggle
  toggleVote: async (postId: string): Promise<{ has_voted: boolean; votes_count: number }> => {
    const res = await api.post(`/feedback/posts/${postId}/vote`);
    return res.data;
  },

  // Follow Toggle
  toggleFollow: async (postId: string): Promise<{ is_following: boolean }> => {
    const res = await api.post(`/feedback/posts/${postId}/follow`);
    return res.data;
  },

  // Comments
  getComments: async (postId: string): Promise<{ comments: FeedbackCommentItem[] }> => {
    const res = await api.get(`/feedback/posts/${postId}/comments`);
    return res.data;
  },

  addComment: async (
    postId: string,
    content: string,
    parentId?: string,
    isOfficialDevResponse?: boolean
  ): Promise<{ comment: FeedbackCommentItem }> => {
    const res = await api.post(`/feedback/posts/${postId}/comments`, {
      content,
      parent_id: parentId,
      is_official_dev_response: isOfficialDevResponse,
    });
    return res.data;
  },

  // Status Change (Admin/Dev)
  updateStatus: async (
    postId: string,
    status: PostStatus,
    officialResponse?: string
  ): Promise<{ ok: boolean; status: PostStatus }> => {
    const res = await api.patch(`/feedback/posts/${postId}/status`, {
      status,
      official_response: officialResponse,
    });
    return res.data;
  },

  // Changelog Release Notes
  getChangelog: async (): Promise<{ releases: ChangelogReleaseItem[] }> => {
    const res = await api.get("/feedback/changelog");
    return res.data;
  },

  publishChangelog: async (payload: {
    version: string;
    release_date: string;
    title: string;
    description: string;
    new_features?: string[];
    improvements?: string[];
    bug_fixes?: string[];
    breaking_changes?: string[];
  }): Promise<{ ok: boolean; id: string }> => {
    const res = await api.post("/feedback/changelog", payload);
    return res.data;
  },
};
