import { useCallback, useContext } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { AuthContext } from "@/context/AuthContext";

export function useAuth() {
  const [location, setLocation] = useLocation();
  const authContext = useContext(AuthContext);
  
  // Use the checkAuthStatus directly from the context
  const { checkAuthStatus } = authContext;

  const getEbayAuthUrl = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/ebay/url", {
        // Add no-cache headers to prevent browser caching
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache"
        }
      });
      const data = await res.json();
      return data.url;
    } catch (error) {
      console.error("Error getting eBay auth URL:", error);
      throw new Error("Failed to get eBay authorization URL");
    }
  }, []);
  
  const getTestLoginUrl = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/test-login-url", {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache"
        }
      });
      const data = await res.json();
      return data.url;
    } catch (error) {
      console.error("Error getting test login URL:", error);
      throw new Error("Failed to get test login URL");
    }
  }, []);

  const signInWithEbay = useCallback(async () => {
    try {
      // Add a special parameter to explicitly reset auth state
      const timestamp = new Date().getTime();
      await fetch(`/api/auth/status?forceCheck=${timestamp}`, { 
        credentials: "include",
        cache: "no-store"
      });
      
      // Force an authentication check
      const authResult = await checkAuthStatus(true);
      
      // If we're already authenticated, don't redirect
      if (authContext.isAuthenticated) {
        setLocation('/photos');
        return;
      }
      
      // Otherwise get the eBay auth URL and redirect
      const url = await getEbayAuthUrl();
      window.location.href = url;
    } catch (error) {
      console.error("Error signing in with eBay:", error);
      throw new Error("Failed to initiate eBay sign-in");
    }
  }, [getEbayAuthUrl, authContext.isAuthenticated, checkAuthStatus, setLocation]);

  const signOut = useCallback(async () => {
    try {
      await apiRequest("POST", "/api/auth/logout", {});
      authContext.setIsAuthenticated(false);
      setLocation("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  }, [authContext, setLocation]);

  return {
    isAuthenticated: authContext.isAuthenticated,
    isLoading: authContext.isLoading,
    checkAuthStatus,
    signInWithEbay,
    getTestLoginUrl,
    signOut
  };
}
