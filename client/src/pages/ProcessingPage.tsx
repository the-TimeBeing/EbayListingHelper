import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import ProcessSteps from "@/components/ProcessSteps";
import { useToast } from "@/hooks/use-toast";

interface ProgressState {
  status: string;
  currentStep: string;
  stepsCompleted: number;
  totalSteps: number;
  error?: string;
}

export default function ProcessingPage() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const [progress, setProgress] = useState<ProgressState>({
    status: 'started',
    currentStep: 'analyzing_photos',
    stepsCompleted: 0,
    totalSteps: 5
  });

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    let timeoutId: NodeJS.Timeout;
    let pollCount = 0;
    const maxPolls = 30; // Maximum number of polls before giving up
    
    const checkProgress = async () => {
      try {
        console.log("[PROCESSING] Checking progress...");
        pollCount++;
        
        if (pollCount > maxPolls) {
          console.warn("[PROCESSING] Maximum poll attempts reached");
          clearInterval(intervalId);
          toast({
            title: 'Process timed out',
            description: 'Please check your draft listings to see if your listing was created successfully.',
            variant: 'destructive',
          });
          navigate('/draft-listings');
          return;
        }
        
        const response = await fetch('/api/listings/progress', {
          credentials: 'include'
        });
        
        if (!response.ok) {
          console.error(`[PROCESSING] Progress check failed with status ${response.status}`);
          const errorText = await response.text();
          console.error(`[PROCESSING] Error response:`, errorText);
          throw new Error(`Failed to fetch progress: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`[PROCESSING] Progress update: ${data.status}, step: ${data.currentStep}, completed: ${data.stepsCompleted}/${data.totalSteps}`);
        setProgress(data);
        
        if (data.status === 'completed') {
          console.log("[PROCESSING] Process completed, navigating to confirmation page");
          clearInterval(intervalId);
          
          // First check if the last generated listing ID is actually set
          try {
            const listingCheck = await fetch('/api/listings/last/generated', {
              credentials: 'include'
            });
            
            if (listingCheck.ok) {
              const listingData = await listingCheck.json();
              console.log("[PROCESSING] Listing found:", listingData);
              
              if (listingData && listingData.id) {
                // Redirect directly to the listing details page
                console.log(`[PROCESSING] Redirecting to listing details page for ID: ${listingData.id}`);
                toast({
                  title: 'Success!',
                  description: 'Your listing has been created successfully',
                });
                navigate(`/listing/${listingData.id}`);
              } else {
                console.error("[PROCESSING] Listing data is missing ID");
                toast({
                  title: 'Process completed',
                  description: 'Your listing has been created, viewing all drafts.',
                });
                navigate('/draft-listings');
              }
            } else {
              console.error("[PROCESSING] Can't find the listing after completion, redirecting to drafts");
              toast({
                title: 'Process completed',
                description: 'Your listing has been created, viewing all drafts.',
              });
              navigate('/draft-listings');
            }
          } catch (e) {
            console.error("[PROCESSING] Error checking listing after completion:", e);
            navigate('/draft-listings');
          }
        } else if (data.status === 'error') {
          console.error("[PROCESSING] Process error:", data.error);
          clearInterval(intervalId);
          toast({
            title: 'Error',
            description: data.error || 'Something went wrong during processing',
            variant: 'destructive',
          });
          navigate('/draft-listings'); // Send to drafts instead of error page
        }
      } catch (error) {
        console.error('[PROCESSING] Error checking progress:', error);
      }
    };

    // Start checking progress immediately
    checkProgress();
    
    // Then check progress every 1 second
    intervalId = setInterval(checkProgress, 1000);
    
    // Set a timeout of 60 seconds for the entire process
    timeoutId = setTimeout(() => {
      clearInterval(intervalId);
      toast({
        title: 'Process taking too long',
        description: 'The listing generation is taking longer than expected. Please try again.',
        variant: 'destructive',
      });
      navigate('/error');
    }, 60000); // 60 seconds timeout

    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [navigate, toast]);

  return (
    <div className="container mx-auto px-4 py-6 max-w-md">
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="text-center">
            <div className="animate-pulse mb-6">
              <svg className="w-20 h-20 mx-auto" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <circle cx="50" cy="50" r="40" stroke="#e6e6e6" strokeWidth="8" fill="none" />
                <circle cx="50" cy="50" r="40" stroke="#0064d2" strokeWidth="8" fill="none" strokeDasharray="251.2" strokeDashoffset="125.6" />
              </svg>
            </div>
            
            <h2 className="text-xl font-semibold mb-4">Creating Your eBay Listing</h2>
            
            <ProcessSteps currentStep={progress.currentStep} />
            
            <p className="mt-6 text-sm text-gray-500">This usually takes 20-30 seconds</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
