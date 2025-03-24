import { createContext, useState, ReactNode, useEffect, useCallback } from "react";

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  checkAuthStatus: (force?: boolean) => Promise<void>;
  setIsAuthenticated: (value: boolean) => void;
  setIsLoading: (value: boolean) => void;
}

export const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  checkAuthStatus: async () => {},
  setIsAuthenticated: () => {},
  setIsLoading: () => {}
});

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastCheckTime, setLastCheckTime] = useState<number>(0);

  // Function to check authentication status
  const checkAuthStatus = useCallback(async (force = false) => {
    try {
      // Don't check more than once every 2 seconds unless forced
      const now = Date.now();
      if (!force && now - lastCheckTime < 2000) {
        return;
      }
      
      setLastCheckTime(now);
      
      // Only set loading to true for initial checks or when forcing a check
      if (force) {
        setIsLoading(true);
      }
      
      // Add a random parameter to prevent browser caching
      const timestamp = new Date().getTime();
      const res = await fetch(`/api/auth/status?nocache=${timestamp}`, { 
        credentials: "include",
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
          // Add a timestamp to prevent caching
          "X-Timestamp": now.toString()
        }
      });
      
      if (!res.ok) {
        console.error("Auth status check failed with status:", res.status);
        if (force) {
          setIsAuthenticated(false);
        }
        return;
      }
      
      const data = await res.json();
      console.log("Auth status checked:", data);
      
      if (data.isAuthenticated && data.hasEbayToken) {
        // Always update if authenticated
        setIsAuthenticated(true);
      } else if (force) {
        // Only set to false when forced to avoid unwanted flickering
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error("Error checking auth status:", error);
      if (force) {
        setIsAuthenticated(false);
      }
    } finally {
      // Ensure loading state is turned off
      setIsLoading(false);
    }
  }, [lastCheckTime]);

  // Initial check on mount
  useEffect(() => {
    const initialCheck = async () => {
      await checkAuthStatus(true);
    };
    initialCheck();
  }, []);

  // Debug log for auth state changes
  useEffect(() => {
    console.log("AuthContext state changed:", { isAuthenticated, isLoading });
  }, [isAuthenticated, isLoading]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        checkAuthStatus,
        setIsAuthenticated,
        setIsLoading
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
