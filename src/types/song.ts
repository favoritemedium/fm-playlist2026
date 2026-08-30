export interface Song {
  id: string;
  source: "airtable" | "app";
  airtableRecordId: string | null;
  submitterUserId: string | null;
  submitterName: string;
  submitterEmail: string | null;
  artistName: string | null;
  songTitle: string | null;
  description: string | null;
  youtubeUrl: string;
  youtubeVideoId: string;
  submittedDate: string;
  month: number;
  year: number;
  likeCount: number;
  commentCount: number;
  userLiked: boolean;
  bookmarked?: boolean;
}

export interface EngagementUser {
  id: string;
  name: string;
  email: string;
  picture: string | null;
}

export interface SongLiker {
  user: EngagementUser;
  likedAt: string;
}

export interface SongCommentReply {
  id: number;
  songId: string;
  parentCommentId: number;
  body: string;
  author: EngagementUser;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
  canDelete: boolean;
}

export interface SongComment {
  id: number;
  songId: string;
  parentCommentId: null;
  body: string;
  author: EngagementUser;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
  canDelete: boolean;
  replies: SongCommentReply[];
}

export interface SongEngagementSummary {
  songId: string;
  likeCount: number;
  commentCount: number;
  userLiked: boolean;
}

export type SongEngagementEvent =
  | {
      type: "song_engagement_updated";
      songId: string;
      likeCount: number;
      commentCount: number;
      actorUserId?: string;
      actorLiked?: boolean;
    }
  | {
      type: "song_comment_notification";
      songId: string;
      commentId: number;
      commenterName: string;
      songSubmitterUserId: string;
      recipientUserId?: string;
      notificationType?: NotificationType;
      createdAt: string;
    };

export type NotificationType = "comment" | "reply";

export interface AppNotification {
  id: number;
  type: NotificationType;
  songId: string;
  songTitle: string | null;
  actorName: string;
  commentId: number | null;
  createdAt: string;
  readAt: string | null;
}

export type ActivityType = "submission" | "like" | "comment" | "reply";

export interface ActivityItem {
  id: string;
  type: ActivityType;
  songId: string;
  songTitle: string | null;
  actorName: string;
  occurredAt: string;
}

export interface CreateSongInput {
  youtubeUrl: string;
  description?: string;
  allowDuplicate?: boolean;
}
