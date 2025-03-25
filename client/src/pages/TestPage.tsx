import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';

export default function TestPage() {
  const { toast } = useToast();
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [processingStatus, setProcessingStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [testImageLoaded, setTestImageLoaded] = useState<boolean>(false);

  // Check session status
  const checkSession = async () => {
    try {
      const response = await fetch('/api/auth/status', {
        credentials: 'include'
      });
      const data = await response.json();
      setSessionInfo(data);
    } catch (error) {
      console.error('Error checking session:', error);
      setSessionInfo({ error: 'Failed to check session status' });
    }
  };

  // Initial check
  useEffect(() => {
    checkSession();
  }, []);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      
      // Convert to base64
      const reader = new FileReader();
      reader.onload = () => {
        setBase64Image(reader.result as string);
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  // Load a test image directly
  const loadTestImage = () => {
    setIsLoading(true);
    // Use a placeholder image URL or embed a small base64 image directly
    fetch('https://via.placeholder.com/300')
      .then(response => response.blob())
      .then(blob => {
        const reader = new FileReader();
        reader.onload = () => {
          setBase64Image(reader.result as string);
          setTestImageLoaded(true);
          setIsLoading(false);
        };
        reader.readAsDataURL(blob);
      })
      .catch(error => {
        console.error('Error loading test image:', error);
        setIsLoading(false);
        toast({
          title: 'Error',
          description: 'Failed to load test image',
          variant: 'destructive'
        });
      });
  };

  // Upload image via API
  const uploadImage = async () => {
    if (!base64Image) {
      toast({
        title: 'No image',
        description: 'Please select or load a test image first',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    setUploadStatus('Uploading...');

    try {
      const response = await apiRequest('POST', '/api/photos/upload-base64', {
        photos: [base64Image]
      });
      
      const data = await response.json();
      setUploadStatus(`Upload successful! Photos count: ${data.count}, Session ID: ${data.sessionId}`);
      toast({
        title: 'Success',
        description: 'Image uploaded successfully',
      });
      
      // Check session status after upload
      await checkSession();
    } catch (error) {
      console.error('Error uploading image:', error);
      setUploadStatus('Upload failed');
      toast({
        title: 'Error',
        description: 'Failed to upload image',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Generate listing
  const generateListing = async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest('POST', '/api/listings/generate', {
        condition: 'Used - Good',
        conditionLevel: 3
      });
      
      const data = await response.json();
      toast({
        title: 'Success',
        description: `Listing generation started. ID: ${data.listingId}`,
      });
      
      // Start checking progress
      checkProgress();
    } catch (error) {
      console.error('Error generating listing:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate listing',
        variant: 'destructive'
      });
      setIsLoading(false);
    }
  };

  // Check progress
  const checkProgress = async () => {
    try {
      const response = await fetch('/api/listings/progress', {
        credentials: 'include'
      });
      
      const data = await response.json();
      setProcessingStatus(data);
      
      if (data.status !== 'completed' && data.status !== 'error') {
        // Continue checking if not completed
        setTimeout(checkProgress, 1000);
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error checking progress:', error);
      setProcessingStatus({ status: 'error', error: 'Failed to check progress' });
      setIsLoading(false);
    }
  };

  // Helper function to display session info
  const renderSessionInfo = () => {
    if (!sessionInfo) return <p>Loading session info...</p>;
    
    return (
      <div className="p-4 bg-gray-100 rounded-lg mb-4">
        <h2 className="font-bold mb-2">Session Info:</h2>
        <pre className="text-xs overflow-auto">{JSON.stringify(sessionInfo, null, 2)}</pre>
      </div>
    );
  };

  // Helper function to display processing status
  const renderProcessingStatus = () => {
    if (!processingStatus) return null;
    
    return (
      <div className="p-4 bg-gray-100 rounded-lg mb-4">
        <h2 className="font-bold mb-2">Processing Status:</h2>
        <pre className="text-xs overflow-auto">{JSON.stringify(processingStatus, null, 2)}</pre>
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-center mb-6">eBay Listing Assistant Diagnostics</h1>
      
      <div className="mb-6">
        {renderSessionInfo()}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold mb-4">Session & Auth Actions</h2>
            
            <div className="flex flex-col gap-3">
              <Button
                onClick={checkSession}
                variant="outline"
              >
                Refresh Session Info
              </Button>
              
              <a href="/api/auth/test-login-redirect" className="w-full">
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Test Login with Mock eBay Tokens
                </Button>
              </a>
              
              <Button
                onClick={async () => {
                  try {
                    await apiRequest('POST', '/api/auth/logout', {});
                    toast({ title: 'Success', description: 'Logged out successfully' });
                    await checkSession();
                  } catch (error) {
                    toast({ title: 'Error', description: 'Failed to log out' });
                  }
                }}
                variant="destructive"
              >
                Logout
              </Button>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold mb-4">Image Upload Test</h2>
            
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-full file:border-0
                    file:text-sm file:font-semibold
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100"
                />
                <Button onClick={loadTestImage} disabled={isLoading} variant="outline">
                  {isLoading ? 'Loading...' : 'Load Test Image'}
                </Button>
              </div>
              
              {base64Image && (
                <div className="mt-4">
                  <p className="text-sm mb-2">Preview:</p>
                  <img src={base64Image} alt="Preview" className="w-full max-h-40 object-contain" />
                </div>
              )}
              
              <Button
                onClick={uploadImage}
                disabled={!base64Image || isLoading}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                {isLoading ? 'Uploading...' : 'Upload Image to Session'}
              </Button>
              
              {uploadStatus && <p className="text-sm mt-2">{uploadStatus}</p>}
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Card className="mb-6">
        <CardContent className="p-6">
          <h2 className="text-xl font-semibold mb-4">Listing Generation</h2>
          
          <div className="space-y-4">
            <Button
              onClick={generateListing}
              disabled={isLoading || !sessionInfo?.isAuthenticated}
              className="w-full py-4 bg-gradient-to-r from-[#e53238] to-[#0064d2] hover:opacity-90 text-white font-semibold"
            >
              {isLoading ? 'Processing...' : 'Generate Listing from Uploaded Photo'}
            </Button>
            
            {renderProcessingStatus()}
          </div>
        </CardContent>
      </Card>
      
      <div className="flex flex-col gap-4">
        <a href="/direct-photos" className="w-full">
          <Button
            className="w-full py-4 rounded-full bg-gradient-to-r from-[#e53238] to-[#0064d2] hover:opacity-90 text-white font-semibold"
          >
            Go to Direct Photo Upload (Normal Flow)
          </Button>
        </a>
        
        <a href="/draft-listings" className="w-full">
          <Button
            className="w-full py-4 rounded-full bg-green-600 hover:bg-green-700 text-white font-semibold"
          >
            View Draft Listings
          </Button>
        </a>
      </div>
    </div>
  );
}