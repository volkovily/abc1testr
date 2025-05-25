import { usePlatformAuth } from './usePlatformAuth';
import { YouTubeChannelInfo } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export function useYouTubeAuth() {
  return usePlatformAuth<YouTubeChannelInfo>({
    statusUrl: `${API_BASE_URL}/api/youtube/status`,
    userInfoUrl: `${API_BASE_URL}/api/youtube/channel`,
    loginUrl: `${API_BASE_URL}/auth/google`,
    logoutUrl: `${API_BASE_URL}/auth/google/logout`,
    postMessageSuccessType: 'YT_AUTH_SUCCESS',
    postMessageErrorType: 'YT_AUTH_ERROR',
    extractUserInfo: (data: any) => data && data.id && data.title ? data : null,
    platformName: 'YouTube',
  });
}