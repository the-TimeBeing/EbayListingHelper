import { useCallback, useState, useContext } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { AuthContext } from "@/context/AuthContext";

export function useAuth() {
  const [location, setLocation] = useLocation();
  const authContext = useContext(AuthContext);
  
  const checkAuthStatus = useCallback(async () => {
    try {
      authContext.setIsLoading(true);
      const res = await fetch("/api/auth/status", { credentials: "include" });
      const data = await res.json();
      
      if (data.isAuthenticated && data.hasEbayToken) {
        authContext.setIsAuthenticated(true);
      } else {
        authContext.setIsAuthenticated(false);
      }
      console.log("Auth status checked:", data);
    } catch (error) {
      console.error("Error checking auth status:", error);
      authContext.setIsAuthenticated(false);
    } finally {
      // Ensure loading state is turned off
      console.log("Setting isLoading to false");
      authContext.setIsLoading(false);
      
      // Force a re-render after a short delay if needed
      setTimeout(() => {
        console.log("Force update - confirming isLoading is false");
        authContext.setIsLoading(false);
      }, 500);
    }
  }, [authContext]);

  const getEbayAuthUrl = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/ebay/url");
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
