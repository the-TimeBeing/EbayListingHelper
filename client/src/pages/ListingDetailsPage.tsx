import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalLink, ArrowLeft, Truck, Expand, ShoppingCart, Heart } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Listing } from "@shared/schema";

export default function ListingDetailsPage() {
  const [_, navigate] = useLocation();
  const [match, params] = useRoute<{ id: string }>("/listing/:id");
  const { toast } = useToast();

  const [listing, setListing] = useState<Listing | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPushing, setIsPushing] = useState(false);  // New state for push to eBay operation
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  useEffect(() => {
    if (!match || !params) {
      console.log("[LISTING DETAILS] No match or params, redirecting to draft listings");
      navigate("/draft-listings");
      return;
    }

    const fetchListing = async () => {
      try {
        const id = parseInt(params.id);
        console.log(`[LISTING DETAILS] Fetching listing with ID: ${id}`);
        
        if (isNaN(id)) {
          console.error("[LISTING DETAILS] Invalid listing ID:", params.id);
          throw new Error("Invalid listing ID");
        }

        // First, ensure we have authentication/session set up
        await apiRequest("GET", "/api/auth/status");
        
        const response = await apiRequest("GET", `/api/listings/${id}`);
        console.log(`[LISTING DETAILS] Response status: ${response.status}`);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[LISTING DETAILS] Error response (${response.status}):`, errorText);
          throw new Error(`Error ${response.status}: ${errorText}`);
        }
        
        const result = await response.json();
        console.log("[LISTING DETAILS] Successfully fetched listing:", result.id);
        setListing(result as Listing);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("[LISTING DETAILS] Error fetching listing:", errorMessage);
        
        toast({
          title: "Error",
          description: "Failed to fetch listing details. Please try again.",
          variant: "destructive"
        });
        
        // Delay navigation to allow the user to see the toast
        setTimeout(() => navigate("/draft-listings"), 1500);
      } finally {
        setIsLoading(false);
      }
    };

    fetchListing();
  }, [match, params, navigate, toast]);

  const handlePushToEbay = async () => {
    if (!listing) return;
    
    try {
      // Show specific loading state for push action
      setIsPushing(true);
      
      console.log(`[LISTING DETAILS] Pushing listing ${listing.id} to eBay`);
      const response = await apiRequest("POST", `/api/listings/${listing.id}/push-to-ebay`);
      const result = await response.json();
      
      if (result.success === false) {
        // Handle error response
        console.error("[LISTING DETAILS] Failed to push to eBay:", result);
        toast({
          title: "eBay Push Failed",
          description: result.message || "Failed to push listing to eBay. Please check your eBay account connection.",
          variant: "destructive"
        });
        return;
      }
      
      console.log("[LISTING DETAILS] Successfully pushed to eBay:", result);
      toast({
        title: "Success!",
        description: "Listing pushed to eBay as a draft",
      });
      
      if (result && typeof result === 'object' && 'listing' in result) {
        const updatedListing = result.listing as Partial<Listing>;
        
        setListing({
          ...listing,
          ebayDraftId: updatedListing.ebayDraftId || listing.ebayDraftId,
          status: updatedListing.status || listing.status
        });
      }
    } catch (error) {
      console.error("[LISTING DETAILS] Error pushing to eBay:", error);
      
      // Show more detailed error information if available
      let errorMessage = "Failed to push listing to eBay";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      toast({
        title: "eBay Connection Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsPushing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center mb-6">
          <Button variant="ghost" size="icon" className="mr-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Skeleton className="h-8 w-48" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <Skeleton className="h-80 w-full rounded-lg mb-4" />
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="aspect-square rounded-md" />
              ))}
            </div>
          </div>
          
          <div className="space-y-6">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <div className="flex gap-4 mt-8">
              <Skeleton className="h-12 w-36" />
              <Skeleton className="h-12 w-36" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Listing Not Found</h1>
        <Button onClick={() => navigate("/draft-listings")}>Back to Listings</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center mb-6">
        <Button 
          variant="ghost" 
          size="icon" 
          className="mr-2"
          onClick={() => navigate("/draft-listings")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">Listing Details</h1>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Image Gallery */}
        <div>
          <div className="bg-white rounded-lg overflow-hidden border border-gray-200 mb-4 aspect-square relative">
            {listing.images && 
             typeof listing.images === 'object' && 
             Array.isArray(listing.images) && 
             listing.images.length > 0 ? (
              <img 
                src={String(listing.images[selectedImageIndex])} 
                alt={listing.title ?? 'Product image'} 
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                <span className="text-gray-400 text-lg">No image available</span>
              </div>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute bottom-2 right-2 bg-white/80 hover:bg-white"
            >
              <Expand className="h-5 w-5" />
            </Button>
          </div>
          
          {listing.images && 
           typeof listing.images === 'object' && 
           Array.isArray(listing.images) && 
           listing.images.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {listing.images.map((image, index) => (
                <div 
                  key={index} 
                  className={`aspect-square rounded-md overflow-hidden border-2 cursor-pointer ${selectedImageIndex === index ? 'border-blue-500' : 'border-transparent'}`}
                  onClick={() => setSelectedImageIndex(index)}
                >
                  <img 
                    src={String(image)} 
                    alt={`Product view ${index + 1}`} 
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Listing Details */}
        <div>
          <h2 className="text-2xl font-bold mb-3">{listing.title}</h2>
          <p className="text-2xl font-semibold text-green-600 mb-6">${listing.price}</p>
          
          <div className="mb-6">
            <h3 className="font-semibold mb-2">Condition</h3>
            <p className="text-gray-700 mb-1">{listing.condition}</p>
            <p className="text-sm text-gray-500">{listing.conditionDescription}</p>
          </div>
          
          <Tabs defaultValue="description" className="mb-8">
            <TabsList>
              <TabsTrigger value="description">Description</TabsTrigger>
              <TabsTrigger value="shipping">Shipping</TabsTrigger>
              <TabsTrigger value="details">Item Details</TabsTrigger>
            </TabsList>
            <TabsContent value="description" className="mt-4">
              <div className="prose max-w-none">
                <p>{listing.description}</p>
              </div>
            </TabsContent>
            <TabsContent value="shipping" className="mt-4">
              <div className="flex items-start space-x-3">
                <Truck className="h-5 w-5 text-gray-600 mt-0.5" />
                <div>
                  <p className="font-medium">Standard Shipping</p>
                  <p className="text-sm text-gray-600">Estimated delivery: 3-5 business days</p>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="details" className="mt-4">
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-gray-600">Category:</span>
                  <span className="col-span-2">{listing.category || 'Not specified'}</span>
                </div>
                {listing.itemSpecifics && 
                 typeof listing.itemSpecifics === 'object' && 
                 Array.isArray(listing.itemSpecifics) && 
                 listing.itemSpecifics.length > 0 && 
                  listing.itemSpecifics.map((spec, index) => {
                    if (typeof spec === 'object' && spec !== null) {
                      const key = Object.keys(spec)[0];
                      const value = Object.values(spec)[0];
                      return (
                        <div key={index} className="grid grid-cols-3 gap-2">
                          <span className="text-gray-600">{key}:</span>
                          <span className="col-span-2">{String(value)}</span>
                        </div>
                      );
                    }
                    return null;
                  })
                }
              </div>
            </TabsContent>
          </Tabs>
          
          <div className="flex flex-wrap gap-4">
            {listing.status === 'pushed_to_ebay' ? (
              <Button
                className="flex items-center gap-2 bg-gray-200 text-gray-700 hover:bg-gray-300 cursor-default"
                disabled
              >
                <ExternalLink className="h-4 w-4" />
                On eBay as Draft
              </Button>
            ) : isPushing ? (
              <Button 
                disabled
                className="flex items-center gap-2 bg-[#0064d2] hover:bg-[#004b9e] text-white"
              >
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Connecting to eBay...
              </Button>
            ) : (
              <Button 
                onClick={handlePushToEbay}
                className="flex items-center gap-2 bg-[#0064d2] hover:bg-[#004b9e] text-white"
              >
                <ExternalLink className="h-4 w-4" />
                Push to eBay
              </Button>
            )}
            
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={() => navigate(`/draft-listings`)}
            >
              Back to Listings
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}