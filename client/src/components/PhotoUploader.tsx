import { useState, useRef } from "react";
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

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    // Check if adding new files would exceed the max
    if (photos.length + files.length > maxPhotos) {
      toast({
        title: "Too many photos",
        description: `You can only upload up to ${maxPhotos} photos`,
        variant: "destructive"
      });
      return;
    }

    // Process each file
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setPhotos([...photos, e.target.result.toString()]);
        }
      };
      reader.readAsDataURL(file);
    });

    // Reset the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removePhoto = (index: number) => {
    const newPhotos = [...photos];
    newPhotos.splice(index, 1);
    setPhotos(newPhotos);
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div>
      {photos.length === 0 ? (
        <label
          htmlFor="photo-upload"
          className="block w-full h-40 border-2 border-dashed border-[#0064d2] rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition duration-300"
          onClick={triggerFileInput}
        >
          <Camera className="h-12 w-12 text-[#0064d2] mb-2" />
          <span className="text-[#0064d2] font-medium">Take photos or upload from gallery</span>
          <input
            type="file"
            id="photo-upload"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={handleFileUpload}
            ref={fileInputRef}
          />
        </label>
      ) : (
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
                >
                  <X className="h-4 w-4 text-red-500" />
                </button>
              </div>
            ))}
            
            {photos.length < maxPhotos && (
              <div 
                className="aspect-square rounded-lg border border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:bg-gray-100"
                onClick={triggerFileInput}
              >
                <Plus className="h-6 w-6 text-gray-500" />
              </div>
            )}
          </div>
          
          <input
            type="file"
            id="photo-upload"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={handleFileUpload}
            ref={fileInputRef}
          />
        </div>
      )}
    </div>
  );
}
