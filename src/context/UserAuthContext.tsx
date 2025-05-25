import { createContext, useState, useEffect, ReactNode, useContext } from 'react';
import toast from 'react-hot-toast';

// Define user type
export interface User {
  id: string;
  name: string;
  email: string;
  profilePicture: string;
  role: string;
}

// Define context type
interface UserAuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
}

// Create context with default values
const UserAuthContext = createContext<UserAuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
    login: () => {},
    logout: () => {},
});

// Create provider component
export const UserAuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is authenticated on component mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('accessToken');
      
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/users/profile`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        } else {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          toast.error('Your session has expired. Please sign in again.');
        }
      } catch {
        toast.error('Authentication check failed. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Handle messages from the auth popup
  useEffect(() => {
    const handleAuthMessage = (event: MessageEvent) => {
      if (!event.data || !event.data.type) return;
      
      if (event.data.type === 'USER_AUTH_SUCCESS') {
        localStorage.setItem('accessToken', event.data.accessToken);
        localStorage.setItem('refreshToken', event.data.refreshToken);
        setUser(event.data.user);
        toast.success('Signed in successfully!');
      } else if (event.data.type === 'USER_AUTH_ERROR') {
        toast.error(`Login failed: ${event.data.error || 'Unknown error'}`);
      }
    };

    window.addEventListener('message', handleAuthMessage);
    return () => window.removeEventListener('message', handleAuthMessage);
  }, []);

  // Login function - opens Google auth popup
  const login = () => {
    const width = 600;
    const height = 700;
    const left = window.innerWidth / 2 - width / 2;
    const top = window.innerHeight / 2 - height / 2;
    
    window.open(
      `${import.meta.env.VITE_API_BASE_URL}/api/users/login/google`,
      'Google Login',
      `width=${width},height=${height},left=${left},top=${top}`
    );
  };

  // Logout function
  const logout = async () => {
    const token = localStorage.getItem('accessToken');
    
    if (token) {
      try {
        await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/users/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } catch {
        // Continue with frontend logout even if API call fails
      }
    }

    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
    toast.success('Signed out successfully');
  };

  return (
    <UserAuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </UserAuthContext.Provider>
  );
};

// Custom hook for using the context
export const useUserAuth = () => useContext(UserAuthContext);