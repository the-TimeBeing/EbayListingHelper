import { Switch, Route } from "wouter";
import { useAuth } from "./hooks/useAuth";
import SignInPage from "./pages/SignInPage";
import PhotoUploadPage from "./pages/PhotoUploadPage";
import ProcessingPage from "./pages/ProcessingPage";
import ConfirmationPage from "./pages/ConfirmationPage";
import ErrorPage from "./pages/ErrorPage";
import NotFound from "@/pages/not-found";
import { useContext, useEffect, useState } from "react";
import { AuthContext } from "./context/AuthContext";

function App() {
  const { checkAuthStatus, isAuthenticated } = useAuth();
  const authContext = useContext(AuthContext);
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  
  useEffect(() => {
    const fetchAuth = async () => {
      try {
        await checkAuthStatus();
      } catch (error) {
        console.error("Error in initial auth check:", error);
      } finally {
        // Ensure we exit the loading state no matter what
        setInitialCheckDone(true);
        authContext.setIsLoading(false);
      }
    };
    
    fetchAuth();
  }, [checkAuthStatus, authContext]);

  // Use our own loading state to ensure we don't get stuck
  if (!initialCheckDone) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-[#0064d2] text-xl">Loading...</div>
      </div>
    );
  }

  console.log("App rendered with auth state:", { isAuthenticated, isLoading: authContext.isLoading, initialCheckDone });

  // Even if authContext.isLoading is still true, we'll render the sign-in page
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
