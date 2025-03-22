import { Switch, Route } from "wouter";
import { useAuth } from "./hooks/useAuth";
import SignInPage from "./pages/SignInPage";
import PhotoUploadPage from "./pages/PhotoUploadPage";
import ProcessingPage from "./pages/ProcessingPage";
import ConfirmationPage from "./pages/ConfirmationPage";
import ErrorPage from "./pages/ErrorPage";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";

function App() {
  const { checkAuthStatus, isAuthenticated, isLoading } = useAuth();
  
  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-ebay-blue text-xl">Loading...</div>
      </div>
    );
  }

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
