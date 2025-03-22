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
      // Call with no argument to use the default
      checkAuthStatus();
    }
  }, [checkAuthStatus]);
  
  // Initial auth check when the app loads
  useEffect(() => {
    const initialAuth = async () => {
      try {
        // Call with no argument to use the default
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
    
    if (isAuthenticated) {
      // If user is authenticated and on sign-in page, redirect to photos
      if (location === '/' || location === '/signin') {
        console.log("Redirecting to /photos after authentication");
        setLocation('/photos');
      }
    } else {
      // If user is not authenticated, redirect to sign-in
      if (location !== '/' && location !== '/signin') {
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

  // Helper function to create protected routes
  const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
    return isAuthenticated ? children : <SignInPage />;
  };

  return (
    <Switch>
      <Route path="/" render={() => <ProtectedRoute><PhotoUploadPage /></ProtectedRoute>} />
      <Route path="/photos" render={() => <ProtectedRoute><PhotoUploadPage /></ProtectedRoute>} />
      <Route path="/processing" render={() => <ProtectedRoute><ProcessingPage /></ProtectedRoute>} />
      <Route path="/confirmation" render={() => <ProtectedRoute><ConfirmationPage /></ProtectedRoute>} />
      <Route path="/error" render={() => <ProtectedRoute><ErrorPage /></ProtectedRoute>} />
      <Route render={() => <NotFound />} />
    </Switch>
  );
}

export default App;
