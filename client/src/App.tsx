import { Switch, Route, useLocation } from "wouter";
import SignInPage from "./pages/SignInPage";
import PhotoUploadPage from "./pages/PhotoUploadPage";
import DirectPhotoUpload from "./pages/DirectPhotoUpload";
import ProcessingPage from "./pages/ProcessingPage";
import ConfirmationPage from "./pages/ConfirmationPage";
import ErrorPage from "./pages/ErrorPage";
import TestPage from "./pages/TestPage";
import DraftListingsPage from "./pages/DraftListingsPage";
import ListingDetailsPage from "./pages/ListingDetailsPage";
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
    
    if (isAuthenticated) {
      // If user is authenticated and on sign-in page, redirect to photos
      if (location === '/' || location === '/signin') {
        console.log("Redirecting to /photos after authentication");
        setLocation('/photos');
      }
    } else {
      // If user is not authenticated, redirect to sign-in, except for exempt pages
      if (location !== '/' && 
          location !== '/signin' && 
          location !== '/test' && 
          location !== '/direct-photos' &&
          location !== '/draft-listings' &&
          !location.startsWith('/listing/')) {
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
    <>
      {/* Floating draft listings button for easy access */}
      <div className="fixed bottom-6 right-6 z-50">
        <a href="/draft-listings">
          <button
            className="flex items-center justify-center p-4 rounded-full bg-green-600 hover:bg-green-700 text-white shadow-lg"
            title="View Draft Listings"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="24" 
              height="24" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
              <path d="M9 12h6"></path>
              <path d="M9 16h6"></path>
            </svg>
          </button>
        </a>
      </div>

      <Switch>
        <Route path="/">
          {isAuthenticated ? <PhotoUploadPage /> : <SignInPage />}
        </Route>
        <Route path="/photos">
          {isAuthenticated ? <PhotoUploadPage /> : <SignInPage />}
        </Route>
        {/* This is a direct route that bypasses authentication checks */}
        <Route path="/direct-photos">
          <DirectPhotoUpload />
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
        {/* Draft listings pages */}
        <Route path="/draft-listings">
          <DraftListingsPage />
        </Route>
        <Route path="/listing/:id">
          <ListingDetailsPage />
        </Route>
        {/* Test page that's always accessible regardless of auth state */}
        <Route path="/test">
          <TestPage />
        </Route>
        <Route>
          <NotFound />
        </Route>
      </Switch>
    </>
  );
}

export default App;
