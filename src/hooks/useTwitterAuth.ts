import { usePlatformAuth } from './usePlatformAuth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export interface TwitterUserInfo {
  id: string;
  name: string;
  username: string;
  avatarUrl: string;
}

export function useTwitterAuth() {
  return usePlatformAuth<TwitterUserInfo>({
    statusUrl: `${API_BASE_URL}/api/twitter/status`,
    userInfoUrl: `${API_BASE_URL}/api/twitter/userinfo`,
    loginUrl: `${API_BASE_URL}/auth/twitter`,
    logoutUrl: `${API_BASE_URL}/auth/twitter/logout`,
    postMessageSuccessType: 'TW_AUTH_SUCCESS',
    postMessageErrorType: 'TW_AUTH_ERROR',
    extractUserInfo: (data: any) => {
      const user = data && data.user;
      return user && user.id && user.name && user.avatarUrl
        ? {
            id: user.id,
            name: user.name,
            username: user.username,
            avatarUrl: user.avatarUrl,
          }
        : null;
    },
    platformName: 'Twitter',
  });
}
