export interface Platform {
  id: string;
  name: string;
  iconName: string;
  maxSizeMB?: number;
  requiresAuth?: boolean;
}

export interface SelectedPlatform {
  id: string;
  name: string;
  iconName: string;
  settings: UploadSettings;
  isAuthenticated?: boolean;
}

export type Visibility = 'public' | 'private' | 'unlisted' | 'scheduled';

export interface PlatformUploadResult {
  status: 'pending' | 'uploading' | 'processing' | 'success' | 'error';
  videoId?: string;
  videoUrl?: string;
  error?: string;
  progress: number;
}

export interface UploadSettings {
  title: string;
  description?: string;
  visibility: Visibility;
  scheduledDate?: Date | null;
  tags?: string[];
  selectedPageId?: string;
}

export interface AuthInfo {
  name: string;
  id?: string;
  imageUrl?: string;
  profileUrl?: string;
  email?: string;
  additionalInfo?: string;
}

export interface FacebookUserProfile {
  id: string;
  name: string;
  email?: string;
  picture?: {
    data?: {
      url?: string;
    };
  };
}

export interface FacebookPageInfo {
  id: string;
  name: string;
  access_token: string;
  picture?: {
    data?: {
      url?: string;
    };
  };
}

export interface TikTokUserInfo {
  avatarUrl: string | null;
  openId: string | null;
  username: string | null;
}

export interface YouTubeChannelInfo {
  id: string;
  title: string;
  thumbnailUrl: string;
}