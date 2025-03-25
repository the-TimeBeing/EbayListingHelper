import { Badge } from "@/components/ui/badge";
import { Listing } from "@shared/schema";

interface ListingPreviewProps {
  listing: Listing;
}

export default function ListingPreview({ listing }: ListingPreviewProps) {
  // Safely get the item specifics
  let itemSpecifics = [];
  try {
    if (listing.itemSpecifics) {
      if (typeof listing.itemSpecifics === 'string') {
        itemSpecifics = JSON.parse(listing.itemSpecifics);
      } else if (Array.isArray(listing.itemSpecifics)) {
        itemSpecifics = listing.itemSpecifics;
      } else {
        console.log("Unexpected itemSpecifics format:", listing.itemSpecifics);
      }
    }
  } catch (e) {
    console.error("Error parsing itemSpecifics:", e);
  }

  // Safely get images
  let images = [];
  try {
    if (listing.images) {
      if (typeof listing.images === 'string') {
        images = JSON.parse(listing.images);
      } else if (Array.isArray(listing.images)) {
        images = listing.images;
      } else {
        console.log("Unexpected images format:", listing.images);
      }
    }
  } catch (e) {
    console.error("Error parsing images:", e);
  }
  
  console.log("Processed listing:", {
    id: listing.id,
    title: listing.title,
    imageCount: images.length,
    hasImages: images.length > 0
  });

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <h3 className="font-semibold text-lg mb-2">{listing.title}</h3>
      
      <div className="flex items-center mb-4">
        <span className="text-xl font-bold text-gray-800 mr-2">${listing.price}</span>
        <Badge className="bg-green-600 text-white">Suggested Price</Badge>
      </div>
      
      <div className="mb-4">
        <p className="text-sm text-gray-800 line-clamp-3">
          {listing.description}
        </p>
      </div>
      
      {images && images.length > 0 && (
        <div className="flex space-x-2 mb-4">
          {images.slice(0, 2).map((image: string, index: number) => (
            <div key={index} className="w-20 h-20 rounded overflow-hidden">
              <img 
                src={image} 
                alt={`Product ${index + 1}`} 
                className="w-full h-full object-cover"
              />
            </div>
          ))}
        </div>
      )}
      
      <div className="flex flex-wrap gap-2">
        {listing.category && (
          <Badge variant="outline" className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
            {listing.category}
          </Badge>
        )}
        
        {listing.condition && (
          <Badge variant="outline" className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
            {listing.condition}
          </Badge>
        )}
        
        {Array.isArray(itemSpecifics) && itemSpecifics.map((specific, index) => (
          <Badge 
            key={index}
            variant="outline" 
            className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded"
          >
            {typeof specific === 'string' ? specific : Object.values(specific)[0]}
          </Badge>
        ))}
      </div>
    </div>
  );
}
