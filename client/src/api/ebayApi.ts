import { apiRequest } from "@/lib/queryClient";

export async function getEbayAuthUrl() {
  try {
    const response = await fetch('/api/auth/ebay/url');
    const data = await response.json();
    return data.url;
  } catch (error) {
    console.error('Error getting eBay auth URL:', error);
    throw new Error('Failed to get eBay authorization URL');
  }
}

export async function uploadPhotos(photos: string[]) {
  try {
    return await apiRequest('POST', '/api/photos/upload-base64', { photos });
  } catch (error) {
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
  } catch (error) {
    console.error('Error generating listing:', error);
    throw new Error('Failed to generate listing');
  }
}

export async function getListingProgress() {
  try {
    const response = await fetch('/api/listings/progress', {
      credentials: 'include'
    });
    return await response.json();
  } catch (error) {
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
  } catch (error) {
    console.error('Error getting last generated listing:', error);
    throw new Error('Failed to get listing');
  }
}

export async function pushListingToEbay(listingId: number) {
  try {
    return await apiRequest('POST', `/api/listings/${listingId}/push-to-ebay`, {});
  } catch (error) {
    console.error('Error pushing listing to eBay:', error);
    throw new Error('Failed to push listing to eBay');
  }
}
