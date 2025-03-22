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

  const signInWithEbay = useCallback(async () => {
    try {
      const url = await getEbayAuthUrl();
      // Redirect to the eBay auth URL or our test login endpoint
      window.location.href = url;
    } catch (error) {
      console.error("Error signing in with eBay:", error);
      throw new Error("Failed to initiate eBay sign-in");
    }
  }, [getEbayAuthUrl]);

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
    signOut
  };
}
