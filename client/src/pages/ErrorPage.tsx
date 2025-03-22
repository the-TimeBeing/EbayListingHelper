import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function ErrorPage() {
  const [location, navigate] = useLocation();
  
  const handleTryAgain = () => {
    navigate('/processing');
  };
  
  const handleBackToPhotos = () => {
    navigate('/photos');
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-md">
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="text-center mb-6">
            <div className="inline-block p-3 bg-red-100 rounded-full mb-4">
              <AlertCircle className="h-12 w-12 text-[#e53238]" />
            </div>
            <h2 className="text-xl font-semibold">Something Went Wrong</h2>
            <p className="text-gray-600 mt-2">We couldn't process your listing at this time.</p>
          </div>
          
          <div className="bg-gray-100 p-4 rounded-lg mb-6">
            <h3 className="font-medium mb-2">Try these solutions:</h3>
            <ul className="list-disc list-inside text-sm text-gray-700 space-y-2">
              <li>Check your internet connection</li>
              <li>Take clearer photos of your item</li>
              <li>Try a different item that's easier to identify</li>
              <li>Sign out and sign back in to refresh your eBay authorization</li>
            </ul>
          </div>
          
          <div className="flex flex-col space-y-3">
            <Button
              onClick={handleTryAgain}
              className="py-3 rounded-full bg-gradient-to-r from-[#e53238] to-[#0064d2] hover:opacity-90 text-white font-semibold"
            >
              Try Again
            </Button>
            <Button
              onClick={handleBackToPhotos}
              variant="outline"
              className="py-3 rounded-full border-2 border-[#0064d2] text-[#0064d2] font-semibold"
            >
              Back to Photos
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
