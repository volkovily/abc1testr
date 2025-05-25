import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';

interface PlatformAuthConfig<TUserInfo> {
  statusUrl: string;
  userInfoUrl: string;
  loginUrl: string;
  logoutUrl: string;
  postMessageSuccessType: string;
  postMessageErrorType: string;
  extractUserInfo: (data: any) => TUserInfo | null;
  platformName: string;
}

export function usePlatformAuth<TUserInfo>(config: PlatformAuthConfig<TUserInfo>) {
  const popupRef = useRef<Window | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userInfo, setUserInfo] = useState<TUserInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(config.statusUrl, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
      const data = await res.json();
      setIsAuthenticated(data.isAuthenticated);
      if (data.isAuthenticated) {
        await fetchUserInfo();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check status');
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchUserInfo = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(config.userInfoUrl, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`User fetch failed: ${res.status}`);
      const data = await res.json();
      setUserInfo(config.extractUserInfo(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch user');
      setUserInfo(null);
    }
  }, []);

  const logout = useCallback(async () => {
    const token = localStorage.getItem('accessToken');
    try {
      await fetch(config.logoutUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setIsAuthenticated(false);
      setUserInfo(null);
      toast.success(`Logged out from ${config.platformName}`);
    } catch (err) {
      toast.error(`Logout failed, but cleared local state`);
      setIsAuthenticated(false);
      setUserInfo(null);
    }
  }, []);

  const login = useCallback(async () => {
    setError(null);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(config.loginUrl, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Auth init failed: ${res.status}`);
      const { authUrl } = await res.json();
      const width = 600, height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
      popupRef.current = window.open(authUrl, `${config.platformName}Auth`, `width=${width},height=${height},top=${top},left=${left}`);
    } catch (err) {
      toast.error(`Failed to initiate ${config.platformName} login`);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== import.meta.env.VITE_API_BASE_URL) return;
      if (event.data?.type === config.postMessageSuccessType) {
        fetchStatus();
        toast.success(`Connected to ${config.platformName}!`);
      } else if (event.data?.type === config.postMessageErrorType) {
        setError(event.data.error);
        toast.error(`${config.platformName} login failed: ${event.data.error}`);
      }
      if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
    };
    window.addEventListener('message', handleMessage);
    return () => { window.removeEventListener('message', handleMessage); };
  }, [fetchStatus]);

  return {
    isAuthenticated,
    isLoading,
    userInfo,
    error,
    login,
    logout,
    fetchStatus,
  };
}
