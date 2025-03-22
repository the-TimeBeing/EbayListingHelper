import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2 } from "lucide-react";
import ListingPreview from "@/components/ListingPreview";
import { useQuery } from "@tanstack/react-query";
import { Listing } from "@shared/schema";
import { ThumbsUp, ThumbsDown } from "lucide-react";

export default function ConfirmationPage() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();

  const { data: listing, isLoading, error } = useQuery<Listing>({
    queryKey: ['/api/listings/last/generated'],
    retry: false
  });

  const handleViewOnEbay = async () => {
    try {
      if (!listing) return;

      const response = await fetch(`/api/listings/${listing.id}/push-to-ebay`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to push listing to eBay');
      }

      const data = await response.json();
      
      // In a real app, this would open the eBay listing in a new tab
      toast({
        title: "Success",
        description: "Your draft listing is now available on eBay",
      });
      
      // For demo purposes, just show a message
      window.alert("This would open your draft listing on eBay's website");
    } catch (error) {
      console.error('Error pushing to eBay:', error);
      toast({
        title: "Error",
        description: "Failed to push listing to eBay",
        variant: "destructive"
      });
    }
  };

  const handleCreateNewListing = () => {
    navigate('/photos');
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-md">
        <Card className="mb-6">
          <CardContent className="p-6 text-center">
            <div className="animate-pulse">Loading listing...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !listing) {
    navigate('/error');
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-md">
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="mb-6 text-center">
            <div className="inline-block p-3 bg-green-100 rounded-full mb-4">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold">Draft Listing Created!</h2>
            <p className="text-gray-600 mt-2">Your draft is now available in your eBay account</p>
          </div>
          
          <ListingPreview listing={listing} />
          
          <div className="flex flex-col space-y-3 mt-6">
            <Button
              onClick={handleViewOnEbay}
              className="py-3 rounded-full bg-gradient-to-r from-[#e53238] to-[#0064d2] hover:opacity-90 text-white font-semibold"
            >
              View & Edit on eBay
            </Button>
            <Button
              onClick={handleCreateNewListing}
              variant="outline"
              className="py-3 rounded-full border-2 border-[#0064d2] text-[#0064d2] font-semibold"
            >
              Create Another Listing
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <div className="text-center text-sm">
        <p className="text-gray-500">Remember to review and publish your draft on eBay</p>
        <div className="flex items-center justify-center mt-4">
          <p className="text-gray-700 mr-2">Was this helpful?</p>
          <Button variant="ghost" size="icon" className="mx-1 text-gray-500 hover:text-green-600">
            <ThumbsUp className="h-6 w-6" />
          </Button>
          <Button variant="ghost" size="icon" className="mx-1 text-gray-500 hover:text-red-600">
            <ThumbsDown className="h-6 w-6" />
          </Button>
        </div>
      </div>
    </div>
  );
}
