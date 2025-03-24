import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Listing } from "@shared/schema";

export default function DraftListingsPage() {
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchListings = async () => {
      try {
        const result = await apiRequest("GET", "/api/listings");
        setListings(result as Listing[]);
      } catch (error) {
        console.error("Error fetching listings:", error);
        toast({
          title: "Error",
          description: "Failed to fetch your listings",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchListings();
  }, [toast]);

  const handlePushToEbay = async (listingId: number) => {
    try {
      const result = await apiRequest("POST", `/api/listings/${listingId}/push-to-ebay`);
      
      toast({
        title: "Success!",
        description: "Listing pushed to eBay as a draft",
      });
      
      // Update the listing in state
      if (result && typeof result === 'object' && 'listing' in result) {
        const updatedListing = result.listing as Partial<Listing>;
        
        setListings(prevListings => 
          prevListings.map(listing => 
            listing.id === listingId 
              ? { 
                  ...listing, 
                  ebayDraftId: updatedListing.ebayDraftId || listing.ebayDraftId, 
                  status: updatedListing.status || listing.status
                } 
              : listing
          )
        );
      }
    } catch (error) {
      console.error("Error pushing to eBay:", error);
      toast({
        title: "Error",
        description: "Failed to push listing to eBay",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center mb-8">
        <Button 
          variant="ghost" 
          size="icon" 
          className="mr-4"
          onClick={() => navigate("/test")}
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-2xl font-bold">Your Draft Listings</h1>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <Skeleton className="h-32 w-32 rounded-md" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-10 w-40 mt-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : listings.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-lg text-gray-600 mb-4">No draft listings found</p>
            <Button onClick={() => navigate("/direct-photos")}>Create New Listing</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {listings.map((listing) => (
            <Card key={listing.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex flex-col md:flex-row">
                  {listing.images && typeof listing.images === 'object' && Array.isArray(listing.images) && listing.images.length > 0 ? (
                    <div className="w-full md:w-48 h-48 overflow-hidden">
                      <img 
                        src={String(listing.images[0])} 
                        alt={listing.title ?? 'Product image'} 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-full md:w-48 h-48 bg-gray-200 flex items-center justify-center">
                      <span className="text-gray-400">No image</span>
                    </div>
                  )}
                  
                  <div className="p-6 flex-1">
                    <h2 className="text-xl font-semibold mb-2">{listing.title}</h2>
                    <p className="text-green-600 font-medium mb-2">${listing.price}</p>
                    <p className="text-gray-500 mb-4">Condition: {listing.condition}</p>
                    
                    <div className="flex flex-wrap gap-3 mt-4">
                      <Button 
                        onClick={() => navigate(`/listing/${listing.id}`)}
                        variant="outline"
                      >
                        View Details
                      </Button>
                      
                      {listing.status === 'pushed_to_ebay' ? (
                        <Button 
                          variant="secondary"
                          className="flex items-center gap-2"
                          disabled
                        >
                          <ExternalLink className="h-4 w-4" />
                          On eBay as Draft
                        </Button>
                      ) : (
                        <Button 
                          onClick={() => handlePushToEbay(listing.id)}
                          className="bg-[#0064d2] hover:bg-[#004b9e] text-white"
                        >
                          Push to eBay
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}