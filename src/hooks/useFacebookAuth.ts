import { useState, useCallback, useEffect, useRef } from 'react';
import { usePlatformAuth } from './usePlatformAuth';
import { FacebookUserProfile } from '../types';
import { getFacebookPages } from '../services/facebookApiService';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export function useFacebookAuth() {
  // Use generic auth logic for Facebook user
  const auth = usePlatformAuth<FacebookUserProfile>({
    statusUrl: `${API_BASE_URL}/api/facebook/status`,
    userInfoUrl: `${API_BASE_URL}/api/facebook/userinfo`,
    loginUrl: `${API_BASE_URL}/auth/facebook`,
    logoutUrl: `${API_BASE_URL}/auth/facebook/logout`,
    postMessageSuccessType: 'FB_AUTH_SUCCESS',
    postMessageErrorType: 'FB_AUTH_ERROR',
    extractUserInfo: (data: any) => data && data.user ? data.user : null,
    platformName: 'Facebook',
  });

  // Facebook-specific: fetch pages
  const [pages, setPages] = useState<any[]>([]);
  const [pagesLoading, setPagesLoading] = useState(false);
  const fetchPages = useCallback(async () => {
    setPagesLoading(true);
    const token = localStorage.getItem('accessToken');
    console.debug('[FacebookAuth] fetchPages called. accessToken:', token);
    try {
      const result = await getFacebookPages(token || undefined);
      
      if ('error' in result) {
        console.error('[FacebookAuth] fetchPages error:', result.error);
        throw new Error(result.error);
      }
      
      console.debug('[FacebookAuth] fetchPages data:', result);
      setPages(result);
    } catch (err) {
      console.error('[FacebookAuth] fetchPages exception:', err);
      setPages([]);
    } finally {
      setPagesLoading(false);
    }
  }, []);

  // Automatically fetch pages when authenticated and userInfo is available
  const didFetchRef = useRef(false);
  useEffect(() => {
    console.debug('[FacebookAuth] useEffect: isAuthenticated:', auth.isAuthenticated, 'userInfo:', auth.userInfo, 'didFetchRef:', didFetchRef.current);
    if (auth.isAuthenticated && auth.userInfo && !didFetchRef.current) {
      fetchPages();
      didFetchRef.current = true;
    } else if (!auth.isAuthenticated) {
      setPages([]);
      didFetchRef.current = false;
    }
  }, [auth.isAuthenticated, auth.userInfo, fetchPages]);

  return {
    ...auth,
    pages,
    pagesLoading,
    fetchPages,
  };
}