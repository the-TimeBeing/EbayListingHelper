import { createContext, useState, ReactNode, useEffect, useCallback } from "react";

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  checkAuthStatus: () => Promise<void>;
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

  // Function to check authentication status
  const checkAuthStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/auth/status", { 
        credentials: "include",
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache"
        }
      });
      const data = await res.json();
      
      if (data.isAuthenticated && data.hasEbayToken) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
      console.log("Auth status checked:", data);
    } catch (error) {
      console.error("Error checking auth status:", error);
      setIsAuthenticated(false);
    } finally {
      // Ensure loading state is turned off
      setIsLoading(false);
    }
  }, []);

  // Check for auth parameter in URL - this is added by our login endpoints
  useEffect(() => {
    const url = new URL(window.location.href);
    const hasAuthParam = url.searchParams.has('auth');

    if (hasAuthParam) {
      // Remove the auth parameter from URL to avoid unnecessary rechecks
      url.searchParams.delete('auth');
      window.history.replaceState({}, '', url.toString());

      // Recheck auth status if auth parameter was present
      checkAuthStatus();
    }
  }, [checkAuthStatus]);

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
