import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Camera, X, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PhotoUploaderProps {
  photos: string[];
  setPhotos: (photos: string[]) => void;
  maxPhotos: number;
}

export default function PhotoUploader({ photos, setPhotos, maxPhotos }: PhotoUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  // Completely rewritten file upload handler
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    
    // Reset input value immediately to ensure it can be used again
    const input = event.target;
    const inputValue = input.value;
    input.value = '';
    
    // No files selected
    if (!files || files.length === 0) {
      console.log("No files selected");
      return;
    }

    console.log("File upload triggered with", files.length, "files");
    
    // Check if already processing files
    if (isProcessing) {
      console.log("Already processing files, ignoring this selection");
      return;
    }
    
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
    
    // Convert FileList to array and process in sequence
    const filesArray = Array.from(files);
    const newPhotos = [...photos];
    
    // Process files one by one
    const processNextFile = (index: number) => {
      if (index >= filesArray.length) {
        // All files processed
        setPhotos(newPhotos);
        setIsProcessing(false);
        console.log("All files processed, photos array updated with", newPhotos.length, "photos");
        return;
      }
      
      const file = filesArray[index];
      const reader = new FileReader();
      
      reader.onload = (e) => {
        if (e.target?.result) {
          newPhotos.push(e.target.result.toString());
          // Process the next file
          processNextFile(index + 1);
        } else {
          // Error reading file, move to next
          console.error("Error reading file:", file.name);
          processNextFile(index + 1);
        }
      };
      
      reader.onerror = () => {
        console.error("FileReader error for file:", file.name);
        processNextFile(index + 1);
      };
      
      // Start reading the file
      reader.readAsDataURL(file);
    };
    
    // Start processing files
    processNextFile(0);
  }, [photos, setPhotos, maxPhotos, toast, isProcessing]);

  const removePhoto = useCallback((index: number) => {
    const newPhotos = [...photos];
    newPhotos.splice(index, 1);
    setPhotos(newPhotos);
  }, [photos, setPhotos]);

  // Fixed version: Only trigger file selection
  const triggerFileInput = useCallback(() => {
    if (fileInputRef.current && !isProcessing) {
      console.log("Triggering file input click");
      fileInputRef.current.click();
    } else if (isProcessing) {
      console.log("Cannot trigger file input while processing files");
      toast({
        title: "Please wait",
        description: "Still processing images...",
        variant: "default"
      });
    }
  }, [isProcessing, toast]);

  return (
    <div>
      {photos.length === 0 ? (
        // Empty state - big upload area
        <div
          className="block w-full h-40 border-2 border-dashed border-[#0064d2] rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition duration-300"
          onClick={triggerFileInput}
        >
          <Camera className="h-12 w-12 text-[#0064d2] mb-2" />
          <span className="text-[#0064d2] font-medium">
            {isProcessing ? "Processing..." : "Take photos or upload from gallery"}
          </span>
        </div>
      ) : (
        // Grid view of photos with add button
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
              <div 
                className={`aspect-square rounded-lg border border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:bg-gray-100 ${isProcessing ? 'opacity-50' : ''}`}
                onClick={triggerFileInput}
              >
                {isProcessing ? (
                  <div className="h-6 w-6 border-2 border-gray-500 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Plus className="h-6 w-6 text-gray-500" />
                )}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Hidden file input element - always kept at the component root level */}
      <input
        type="file"
        id="photo-upload"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={handleFileUpload}
        ref={fileInputRef}
        disabled={isProcessing}
      />
    </div>
  );
}
