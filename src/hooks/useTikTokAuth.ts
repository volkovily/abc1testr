import { usePlatformAuth } from './usePlatformAuth';
import { ProcessedTikTokUserInfo } from '../services/tiktokApiService';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export function useTikTokAuth() {
  return usePlatformAuth<ProcessedTikTokUserInfo>({
    statusUrl: `${API_BASE_URL}/api/tiktok/status`,
    userInfoUrl: `${API_BASE_URL}/api/tiktok/userinfo`,
    loginUrl: `${API_BASE_URL}/auth/tiktok`,
    logoutUrl: `${API_BASE_URL}/auth/tiktok/logout`,
    postMessageSuccessType: 'TT_AUTH_SUCCESS',
    postMessageErrorType: 'TT_AUTH_ERROR',
    extractUserInfo: (data: any) => {
      if (data && data.data && data.data.user) {
        return {
          openId: data.data.user.open_id,
          username: data.data.user.display_name,
          avatarUrl: data.data.user.avatar_url,
        };
      }
      return null;
    },
    platformName: 'TikTok',
  });
}