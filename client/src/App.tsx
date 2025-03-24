import { Switch, Route, useLocation } from "wouter";
import SignInPage from "./pages/SignInPage";
import PhotoUploadPage from "./pages/PhotoUploadPage";
import ProcessingPage from "./pages/ProcessingPage";
import ConfirmationPage from "./pages/ConfirmationPage";
import ErrorPage from "./pages/ErrorPage";
import NotFound from "@/pages/not-found";
import { useContext, useEffect, useState, useCallback } from "react";
import { AuthContext } from "./context/AuthContext";

function App() {
  const authContext = useContext(AuthContext);
  const { isAuthenticated, isLoading, checkAuthStatus } = authContext;
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  const [location, setLocation] = useLocation();
  
  // Check for auth parameter in URL
  const checkAuthParam = useCallback(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has('auth')) {
      console.log("Auth parameter detected, rechecking authentication");
      // Remove the parameter and force a check
      url.searchParams.delete('auth');
      window.history.replaceState({}, '', url.toString());
      // Call checkAuthStatus without arguments
      checkAuthStatus();
    }
  }, [checkAuthStatus]);
  
  // Initial auth check when the app loads
  useEffect(() => {
    const initialAuth = async () => {
      try {
        await checkAuthStatus();
        checkAuthParam();
      } catch (error) {
        console.error("Error in initial auth check:", error);
      } finally {
        setInitialCheckDone(true);
      }
    };
    
    initialAuth();
  }, [checkAuthStatus, checkAuthParam]);

  // Redirect after authentication changes
  useEffect(() => {
    if (!initialCheckDone) return;
    
    // Get the current URL to check if we're coming from a test login
    const url = new URL(window.location.href);
    const hasAuthParam = url.searchParams.has('auth');
    
    if (isAuthenticated) {
      // If user is authenticated and on sign-in page, redirect to photos
      if (location === '/' || location === '/signin') {
        console.log("Redirecting to /photos after authentication");
        setLocation('/photos');
      }
    } else {
      // If user is not authenticated, redirect to sign-in
      // But don't redirect if we have the auth parameter (we're in the process of authenticating)
      if (!hasAuthParam && location !== '/' && location !== '/signin') {
        console.log("Redirecting to / due to no authentication");
        setLocation('/');
      }
    }
  }, [isAuthenticated, initialCheckDone, location, setLocation]);

  // Listen for location changes to recheck auth param
  useEffect(() => {
    checkAuthParam();
  }, [location, checkAuthParam]);

  // Show loading spinner while checking authentication
  if (isLoading && !initialCheckDone) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-[#0064d2] text-xl">Loading...</div>
      </div>
    );
  }

  console.log("App rendered with auth state:", { isAuthenticated, isLoading, initialCheckDone, currentLocation: location });

  // Simplified routing - direct check for authentication
  return (
    <Switch>
      <Route path="/">
        {isAuthenticated ? <PhotoUploadPage /> : <SignInPage />}
      </Route>
      <Route path="/photos">
        {isAuthenticated ? <PhotoUploadPage /> : <SignInPage />}
      </Route>
      <Route path="/processing">
        {isAuthenticated ? <ProcessingPage /> : <SignInPage />}
      </Route>
      <Route path="/confirmation">
        {isAuthenticated ? <ConfirmationPage /> : <SignInPage />}
      </Route>
      <Route path="/error">
        {isAuthenticated ? <ErrorPage /> : <SignInPage />}
      </Route>
      <Route>
        <NotFound />
      </Route>
    </Switch>
  );
}

export default App;
