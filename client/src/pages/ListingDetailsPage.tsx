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
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  useEffect(() => {
    if (!match) {
      navigate("/draft-listings");
      return;
    }

    const fetchListing = async () => {
      try {
        const id = parseInt(params.id);
        if (isNaN(id)) {
          throw new Error("Invalid listing ID");
        }

        const result = await apiRequest<Listing>("GET", `/api/listings/${id}`);
        setListing(result);
      } catch (error) {
        console.error("Error fetching listing:", error);
        toast({
          title: "Error",
          description: "Failed to fetch listing details",
          variant: "destructive"
        });
        navigate("/draft-listings");
      } finally {
        setIsLoading(false);
      }
    };

    fetchListing();
  }, [match, params.id, navigate, toast]);

  const handlePushToEbay = async () => {
    if (!listing) return;
    
    try {
      const result = await apiRequest("POST", `/api/listings/${listing.id}/push-to-ebay`);
      
      toast({
        title: "Success!",
        description: "Listing pushed to eBay as a draft",
      });
      
      setListing({
        ...listing,
        ebayDraftId: result.listing.ebayDraftId,
        status: result.listing.status
      });
    } catch (error) {
      console.error("Error pushing to eBay:", error);
      toast({
        title: "Error",
        description: "Failed to push listing to eBay",
        variant: "destructive"
      });
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
            {listing.images && listing.images.length > 0 ? (
              <img 
                src={listing.images[selectedImageIndex]} 
                alt={listing.title} 
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
          
          {listing.images && listing.images.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {listing.images.map((image, index) => (
                <div 
                  key={index} 
                  className={`aspect-square rounded-md overflow-hidden border-2 cursor-pointer ${selectedImageIndex === index ? 'border-blue-500' : 'border-transparent'}`}
                  onClick={() => setSelectedImageIndex(index)}
                >
                  <img 
                    src={image} 
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
                {listing.itemSpecifics && listing.itemSpecifics.length > 0 && 
                  listing.itemSpecifics.map((spec, index) => (
                    <div key={index} className="grid grid-cols-3 gap-2">
                      <span className="text-gray-600">{Object.keys(spec)[0]}:</span>
                      <span className="col-span-2">{Object.values(spec)[0]}</span>
                    </div>
                  ))
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
              onClick={() => navigate(`/edit-listing/${listing.id}`)}
            >
              Edit Listing
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}