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

  // Function to check authentication status with improved rate limiting and error handling
  const checkAuthStatus = useCallback(async (force = false) => {
    try {
      // Don't check more than once every 3 seconds unless forced
      const now = Date.now();
      if (!force && now - lastCheckTime < 3000) {
        console.debug("Auth check skipped - too soon since last check");
        return;
      }

      // Track consecutive errors
      const errorCount = parseInt(sessionStorage.getItem('authErrorCount') || '0');
      if (errorCount > 5 && !force) {
        console.error("Too many consecutive auth check errors - skipping automatic checks");
        return;
      }
      
      setLastCheckTime(now);
      
      // Only set loading to true for initial checks or when forcing a check
      if (force) {
        setIsLoading(true);
      }
      
      // Add parameters to prevent caching
      const uniqueId = Math.random().toString(36).substring(2, 15);
      const url = `/api/auth/status?nocache=${now}&id=${uniqueId}`;
      console.debug(`Making auth status request to: ${url}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5-second timeout
      
      const res = await fetch(url, { 
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
          "X-Request-Id": uniqueId
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        console.error("Auth status check failed with status:", res.status);
        if (force) {
          setIsAuthenticated(false);
        }
        sessionStorage.setItem('authErrorCount', (errorCount + 1).toString());
        return;
      }
      
      const data = await res.json();
      console.log("Auth status checked:", data);
      
      // Reset error count on success
      sessionStorage.setItem('authErrorCount', '0');
      
      // Only update state if needed to prevent unnecessary rerenders
      if (data.isAuthenticated !== isAuthenticated) {
        console.log(`Auth state changed: ${isAuthenticated} → ${data.isAuthenticated}`);
        setIsAuthenticated(data.isAuthenticated);
      }
      
      // Log authentication details
      console.log(`Auth state updated: isAuthenticated=${data.isAuthenticated}, hasEbayToken=${data.hasEbayToken}`);
    } catch (error) {
      const errorCount = parseInt(sessionStorage.getItem('authErrorCount') || '0');
      sessionStorage.setItem('authErrorCount', (errorCount + 1).toString());
      
      console.error("Error checking auth status:", error);
      if (force) {
        setIsAuthenticated(false);
      }
    } finally {
      // Ensure loading state is turned off
      setIsLoading(false);
    }
  }, [lastCheckTime, isAuthenticated]);

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
