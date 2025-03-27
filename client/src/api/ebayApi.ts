import { apiRequest } from "@/lib/queryClient";

export async function getEbayAuthUrl() {
  try {
    const response = await fetch('/api/auth/ebay/url');
    const data = await response.json();
    return data.url;
  } catch (error: any) {
    console.error('Error getting eBay auth URL:', error);
    throw new Error('Failed to get eBay authorization URL');
  }
}

export async function uploadPhotos(photos: string[]) {
  try {
    return await apiRequest('POST', '/api/photos/upload-base64', { photos });
  } catch (error: any) {
    console.error('Error uploading photos:', error);
    throw new Error('Failed to upload photos');
  }
}

export async function generateListing(condition: string, conditionLevel: number) {
  try {
    return await apiRequest('POST', '/api/listings/generate', {
      condition,
      conditionLevel
    });
  } catch (error: any) { // Type assertion to access properties
    console.error('Error generating listing:', {
      error,
      response: error.response,
      status: error.status,
      data: error.response?.data
    });
    throw error;
  }
}

export async function getListingProgress() {
  try {
    const response = await fetch('/api/listings/progress', {
      credentials: 'include'
    });
    return await response.json();
  } catch (error: any) {
    console.error('Error getting listing progress:', error);
    throw new Error('Failed to get listing progress');
  }
}

export async function getLastGeneratedListing() {
  try {
    const response = await fetch('/api/listings/last/generated', {
      credentials: 'include'
    });
    return await response.json();
  } catch (error: any) {
    console.error('Error getting last generated listing:', error);
    throw new Error('Failed to get listing');
  }
}

export async function pushListingToEbay(listingId: number) {
  try {
    return await apiRequest('POST', `/api/listings/${listingId}/push-to-ebay`, {});
  } catch (error: any) { // Type assertion to properly access error properties
    console.error('Error pushing listing to eBay:', error);
    // Extract detailed error message from the response if available
    let errorMessage = 'Failed to push listing to eBay';
    
    // Check if we have a response with detailed error data
    if (error.response && error.response.data) {
      const responseData = error.response.data;
      
      // If we have a detailed error field with request data, use that
      if (responseData.error) {
        errorMessage = responseData.error;
      } else if (responseData.message) {
        errorMessage = responseData.message;
      }
      
      // Log the full response data for debugging
      console.error('eBay API error details:', responseData);
    }
    
    throw new Error(errorMessage);
  }
}
