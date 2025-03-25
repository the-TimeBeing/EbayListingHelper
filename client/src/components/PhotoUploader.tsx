import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, X, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PhotoUploaderProps {
  photos: string[];
  setPhotos: (photos: string[]) => void;
  maxPhotos: number;
}

export default function PhotoUploader({ photos, setPhotos, maxPhotos }: PhotoUploaderProps) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  // Simple handleFileUpload with direct input element approach
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    
    if (!files || files.length === 0) {
      console.log("No files selected");
      return;
    }

    console.log("File upload triggered with", files.length, "files");
    
    // Check if adding new files would exceed the max
    if (photos.length + files.length > maxPhotos) {
      toast({
        title: "Too many photos",
        description: `You can only upload up to ${maxPhotos} photos`,
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    
    // Create a new array to collect all photos
    const newPhotos = [...photos];
    let processed = 0;
    
    // Process each file
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        if (e.target?.result) {
          newPhotos.push(e.target.result.toString());
        }
        
        processed++;
        if (processed === files.length) {
          setPhotos(newPhotos);
          setIsProcessing(false);
          console.log("All files processed, photos array updated with", newPhotos.length, "photos");
        }
      };
      
      reader.onerror = () => {
        console.error("Error reading file:", file.name);
        processed++;
        if (processed === files.length) {
          setPhotos(newPhotos);
          setIsProcessing(false);
        }
      };
      
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index: number) => {
    const newPhotos = [...photos];
    newPhotos.splice(index, 1);
    setPhotos(newPhotos);
  };

  return (
    <div>
      {/* Empty state */}
      {photos.length === 0 && (
        <div className="block w-full h-40 border-2 border-dashed border-[#0064d2] rounded-lg flex flex-col items-center justify-center hover:bg-gray-100 transition duration-300">
          <Camera className="h-12 w-12 text-[#0064d2] mb-2" />
          <span className="text-[#0064d2] font-medium">
            {isProcessing ? "Processing..." : "Take photos or upload from gallery"}
          </span>
          <input
            type="file"
            id="photo-upload-empty"
            name="photo-upload-empty"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileUpload}
            disabled={isProcessing}
          />
          <label 
            htmlFor="photo-upload-empty" 
            className="mt-3 px-4 py-2 bg-[#0064d2] text-white rounded cursor-pointer hover:bg-[#004fa3]"
          >
            Select Photos
          </label>
        </div>
      )}
      
      {/* Photos grid */}
      {photos.length > 0 && (
        <div className="mb-4">
          <div className="grid grid-cols-3 gap-2 mb-2">
            {photos.map((photo, index) => (
              <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200">
                <img
                  src={photo}
                  alt={`Product photo ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => removePhoto(index)}
                  className="absolute top-1 right-1 bg-white rounded-full p-1 shadow-md"
                  disabled={isProcessing}
                >
                  <X className="h-4 w-4 text-red-500" />
                </button>
              </div>
            ))}
            
            {photos.length < maxPhotos && (
              <div className="aspect-square rounded-lg border border-dashed border-gray-300 flex flex-col items-center justify-center">
                {isProcessing ? (
                  <div className="h-6 w-6 border-2 border-gray-500 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Plus className="h-6 w-6 text-gray-500 mb-2" />
                    <input
                      type="file"
                      id="photo-upload-grid"
                      name="photo-upload-grid"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={isProcessing}
                    />
                    <label 
                      htmlFor="photo-upload-grid" 
                      className="text-xs text-gray-600 cursor-pointer hover:text-gray-900"
                    >
                      Add more
                    </label>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
