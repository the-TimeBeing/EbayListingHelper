import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useState } from "react";

export default function SignInPage() {
  const { signInWithEbay } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isTestLoading, setIsTestLoading] = useState(false);

  const handleSignIn = async () => {
    try {
      setIsLoading(true);
      await signInWithEbay();
    } catch (error) {
      console.error("Sign in error:", error);
      setIsLoading(false);
    }
  };

  const handleTestLogin = async () => {
    try {
      setIsTestLoading(true);
      // Directly access the test login endpoint
      window.location.href = "/api/auth/test-login";
    } catch (error) {
      console.error("Test login error:", error);
      setIsTestLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-md">
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex justify-center mb-6">
            <svg className="w-24 h-auto" viewBox="0 0 300 120" xmlns="http://www.w3.org/2000/svg">
              <path d="M38.866 26.735h21.868v8.06h-11.962v7.42h11.516v8.06h-11.516v13.332h-9.906V26.735z" fill="#e53238"/>
              <path d="M63.63 26.735h10.357l7.554 11.962 7.554-11.962h10.357v36.872h-9.906v-23.13l-8.005 11.962h-.223l-8.006-11.962v23.13H63.63V26.735z" fill="#0064d2"/>
              <path d="M104.5 26.735h10.8l6.21 22.685 5.99-22.685h8.228l5.99 22.685 6.21-22.685h10.8l-11.516 36.872h-9.457l-6.21-22.016-6.21 22.016h-9.456L104.5 26.735z" fill="#f5af02"/>
              <path d="M161.03 26.735h10.133v36.872H161.03V26.735z" fill="#86b817"/>
              <path d="M175.748 45.17c0-10.8 8.228-19.363 19.698-19.363 11.47 0 19.697 8.562 19.697 19.364 0 10.8-8.227 19.363-19.697 19.363-11.47 0-19.698-8.562-19.698-19.363zm29.38 0c0-5.765-3.883-10.02-9.682-10.02-5.8 0-9.682 4.255-9.682 10.02 0 5.765 3.883 10.02 9.682 10.02 5.8 0 9.683-4.255 9.683-10.02z" fill="#e53238"/>
              <path d="M219.606 26.735h9.905v5.542h.223c2.23-3.658 6.658-6.47 13.092-6.47 9.235 0 17.352 8.562 17.352 19.363 0 10.8-8.117 19.363-17.352 19.363-6.434 0-10.862-2.812-13.092-6.47h-.223v18.588h-9.905V26.735zM250.09 45.17c0-5.765-3.883-10.02-9.682-10.02-5.8 0-9.682 4.255-9.682 10.02 0 5.765 3.883 10.02 9.682 10.02 5.8 0 9.683-4.255 9.683-10.02z" fill="#0064d2"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-center mb-6">AI-Powered Listing Assistant</h1>
          <p className="text-center text-gray-600 mb-6">Create eBay draft listings in seconds with just a few photos and one tap</p>
          
          <div className="bg-gray-100 p-4 rounded-lg mb-6">
            <div className="flex items-center mb-2">
              <div className="w-10 h-10 bg-[#0064d2] rounded-full flex items-center justify-center text-white mr-3">1</div>
              <p className="font-medium">Take photos of your item</p>
            </div>
            <div className="flex items-center mb-2">
              <div className="w-10 h-10 bg-[#0064d2] rounded-full flex items-center justify-center text-white mr-3">2</div>
              <p className="font-medium">Select item condition</p>
            </div>
            <div className="flex items-center">
              <div className="w-10 h-10 bg-[#0064d2] rounded-full flex items-center justify-center text-white mr-3">3</div>
              <p className="font-medium">Get an AI-generated draft listing</p>
            </div>
          </div>
          
          <Button
            onClick={handleSignIn}
            disabled={isLoading}
            className="w-full py-6 mb-4 rounded-full bg-gradient-to-r from-[#e53238] to-[#0064d2] hover:opacity-90 text-white font-semibold text-lg"
          >
            {isLoading ? "Connecting..." : "Sign in with eBay"}
          </Button>
          
          {/* Developer testing button */}
          <Button
            onClick={handleTestLogin}
            disabled={isTestLoading}
            className="w-full py-4 rounded-full bg-gray-700 hover:bg-gray-800 text-white"
          >
            {isTestLoading ? "Connecting..." : "Developer Test Login"}
          </Button>
        </CardContent>
      </Card>
      
      <div className="text-center text-sm text-gray-500">
        <p>Your eBay credentials are securely handled by eBay.</p>
        <p className="mt-2">We only receive authorization to create draft listings on your behalf.</p>
      </div>
    </div>
  );
}
