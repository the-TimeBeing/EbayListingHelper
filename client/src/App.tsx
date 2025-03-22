import { Switch, Route, useLocation } from "wouter";
import SignInPage from "./pages/SignInPage";
import PhotoUploadPage from "./pages/PhotoUploadPage";
import ProcessingPage from "./pages/ProcessingPage";
import ConfirmationPage from "./pages/ConfirmationPage";
import ErrorPage from "./pages/ErrorPage";
import NotFound from "@/pages/not-found";
import { useContext, useEffect, useState } from "react";
import { AuthContext } from "./context/AuthContext";

function App() {
  const authContext = useContext(AuthContext);
  const { isAuthenticated, isLoading, checkAuthStatus } = authContext;
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  const [location, setLocation] = useLocation();
  
  // Initial auth check when the app loads
  useEffect(() => {
    const initialAuth = async () => {
      try {
        await checkAuthStatus();
      } catch (error) {
        console.error("Error in initial auth check:", error);
      } finally {
        setInitialCheckDone(true);
      }
    };
    
    initialAuth();
  }, [checkAuthStatus]);

  // Redirect after authentication changes
  useEffect(() => {
    if (isAuthenticated && initialCheckDone) {
      // If user is authenticated and on sign-in page, redirect to photos
      if (location === '/' || location === '/signin') {
        setLocation('/photos');
      }
    } else if (!isAuthenticated && initialCheckDone) {
      // If user is not authenticated, redirect to sign-in
      if (location !== '/' && location !== '/signin') {
        setLocation('/');
      }
    }
  }, [isAuthenticated, initialCheckDone, location, setLocation]);

  // Show loading spinner while checking authentication
  if (isLoading && !initialCheckDone) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-[#0064d2] text-xl">Loading...</div>
      </div>
    );
  }

  console.log("App rendered with auth state:", { isAuthenticated, isLoading, initialCheckDone });

  return (
    <Switch>
      <Route path="/" component={isAuthenticated ? PhotoUploadPage : SignInPage} />
      <Route path="/photos" component={isAuthenticated ? PhotoUploadPage : SignInPage} />
      <Route path="/processing" component={isAuthenticated ? ProcessingPage : SignInPage} />
      <Route path="/confirmation" component={isAuthenticated ? ConfirmationPage : SignInPage} />
      <Route path="/error" component={isAuthenticated ? ErrorPage : SignInPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default App;
