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

  // Redirect after authentication changes (using Wouter's setLocation to prevent full page refresh)
  useEffect(() => {
    if (!initialCheckDone || isLoading) return;
    
    // Mark this check to prevent multiple redirects in quick succession
    const redirectTime = Date.now();
    const lastRedirect = parseInt(sessionStorage.getItem('lastRedirectTime') || '0');
    
    // Don't redirect if we just did one within the last second
    if (redirectTime - lastRedirect < 1000) {
      return;
    }
    
    if (isAuthenticated) {
      // If user is authenticated and on sign-in page, redirect to photos
      if (location === '/' || location === '/signin') {
        console.log("Redirecting to /photos after authentication");
        sessionStorage.setItem('lastRedirectTime', redirectTime.toString());
        setLocation('/photos');
      }
    } else {
      // If user is not authenticated, redirect to sign-in, except for exempt pages
      const exemptPages = ['/', '/signin', '/test', '/direct-photos', '/draft-listings', '/processing'];
      const isExempt = exemptPages.includes(location) || location.startsWith('/listing/');
      
      if (!isExempt) {
        console.log("Redirecting to / due to no authentication", location);
        sessionStorage.setItem('lastRedirectTime', redirectTime.toString());
        setLocation('/');
      } else {
        console.log("Not redirecting, exempt page:", location);
      }
    }
  }, [isAuthenticated, initialCheckDone, isLoading, location, setLocation]);

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
      {/* Floating menu buttons for easy access */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
        {/* Test & Debug Page */}
        <button
          onClick={() => setLocation('/test')}
          className="flex items-center justify-center p-4 rounded-full bg-purple-600 hover:bg-purple-700 text-white shadow-lg"
          title="Test & Debug Tools"
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
            <path d="M14 4h6v6"></path>
            <path d="M10 20H4v-6"></path>
            <path d="M20 10 4 10"></path>
            <path d="M4 4v4"></path>
            <path d="M4 16v4"></path>
          </svg>
        </button>
        
        {/* View Listings Button */}
        <button
          onClick={() => setLocation('/draft-listings')}
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
        
        {/* Create New Listing Button */}
        <button
          onClick={() => setLocation('/direct-photos')}
          className="flex items-center justify-center p-4 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
          title="Create New Listing"
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
            <path d="M12 5v14M5 12h14"></path>
          </svg>
        </button>
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
          <ProcessingPage />
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
