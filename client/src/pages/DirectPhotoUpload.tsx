import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import PhotoUploader from "@/components/PhotoUploader";
import ConditionSlider from "@/components/ConditionSlider";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ChevronLeft } from "lucide-react";

export default function DirectPhotoUpload() {
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  
  const [photos, setPhotos] = useState<string[]>([]);
  const [condition, setCondition] = useState(3);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerateListing = async () => {
    if (photos.length === 0) {
      toast({
        title: "No photos",
        description: "Please add at least one photo of your item",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsLoading(true);
      
      // First upload the photos
      await apiRequest("POST", "/api/photos/upload-base64", { photos });
      
      // Then generate the listing
      const conditionLabels = ["", "Used - Poor", "Used - Fair", "Used - Good", "Like New", "New"];
      
      await apiRequest("POST", "/api/listings/generate", {
        condition: conditionLabels[condition],
        conditionLevel: condition
      });
      
      // Navigate to processing page
      navigate("/processing");
    } catch (error) {
      console.error("Error generating listing:", error);
      toast({
        title: "Error",
        description: "Failed to generate listing. Please try again.",
        variant: "destructive"
      });
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout", {});
      navigate("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-md">
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-center mb-6">
            <Button 
              variant="ghost" 
              size="icon" 
              className="mr-4 p-0"
              onClick={handleSignOut}
            >
              <ChevronLeft className="h-6 w-6 text-gray-800" />
            </Button>
            <h2 className="text-xl font-semibold">Add Photos</h2>
          </div>
          
          <p className="text-gray-600 mb-4">Take clear photos of your item from different angles. Better photos help create better listings!</p>
          
          <div className="mb-6">
            <PhotoUploader 
              photos={photos} 
              setPhotos={setPhotos} 
              maxPhotos={5} 
            />
          </div>
          
          <div className="mb-8">
            <ConditionSlider 
              value={condition} 
              onChange={setCondition} 
            />
          </div>
          
          <Button
            onClick={handleGenerateListing}
            disabled={isLoading || photos.length === 0}
            className="w-full py-6 rounded-full bg-gradient-to-r from-[#e53238] to-[#0064d2] hover:opacity-90 text-white font-semibold text-lg"
          >
            {isLoading ? "Preparing..." : "Generate Listing"}
          </Button>
        </CardContent>
      </Card>
      
      <div className="text-center text-sm text-gray-500">
        <p>For best results, include clear front and back images.</p>
        <Button 
          variant="link" 
          onClick={handleSignOut} 
          className="mt-2 text-[#0064d2]"
        >
          Sign Out
        </Button>
      </div>
    </div>
  );
}