import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import axios from 'axios';

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
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await axios.get(config.statusUrl, { headers });
      setIsAuthenticated(response.data.isAuthenticated);
      
      if (response.data.isAuthenticated) {
        await fetchUserInfo();
      }
    } catch (err) {
      let errorMessage = 'Failed to check status';
      if (axios.isAxiosError(err)) {
        errorMessage = err.response?.data?.error || err.message || errorMessage;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      setError(errorMessage);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchUserInfo = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await axios.get(config.userInfoUrl, { headers });
      setUserInfo(config.extractUserInfo(response.data));
    } catch (err) {
      let errorMessage = 'Failed to fetch user';
      if (axios.isAxiosError(err)) {
        errorMessage = err.response?.data?.error || err.message || errorMessage;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      setError(errorMessage);
      setUserInfo(null);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      await axios.post(config.logoutUrl, {}, { headers });
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
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await axios.get(config.loginUrl, { headers });
      const { authUrl } = response.data;
      
      const width = 600, height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
      
      popupRef.current = window.open(authUrl, `${config.platformName}Auth`, `width=${width},height=${height},top=${top},left=${left}`);
    } catch (err) {
      let errorMessage = `Failed to initiate ${config.platformName} login`;
      if (axios.isAxiosError(err)) {
        errorMessage = err.response?.data?.error || err.message || errorMessage;
      }
      toast.error(errorMessage);
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
