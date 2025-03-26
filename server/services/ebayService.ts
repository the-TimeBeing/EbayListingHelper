import fetch from 'node-fetch';
import { EbayOAuthResponse, EbayItemSummary, EbaySoldItem } from '@shared/types';
import { storage } from '../storage';

export class EbayService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private sandboxMode: boolean;

  constructor() {
    this.clientId = process.env.EBAY_CLIENT_ID || '';
    this.clientSecret = process.env.EBAY_CLIENT_SECRET || '';
    
    // Use the current domain for redirect URI if not provided
    // This ensures it works on Replit and other environments
    const deployedUrl = process.env.REPLIT_DEPLOYMENT_DOMAIN || '';
    
    // IMPORTANT: eBay OAuth requires a redirect to the EXACT URL registered with the app
    // So we must use the root URL with no path segments at all
    const defaultRedirectUrl = `https://${deployedUrl || 'pixly.replit.app'}`;
    
    // Override any stored redirect URI with the root URL for now
    // This is critical for the eBay OAuth flow to work properly in production
    this.redirectUri = defaultRedirectUrl.replace(/\/$/, '');
    console.log(`[EBAY SERVICE] Using callback URL: ${this.redirectUri}`);
    this.sandboxMode = process.env.EBAY_SANDBOX_MODE === 'true';

    if (!this.clientId || !this.clientSecret) {
      console.error('eBay API credentials are missing');
    }
    
    console.log(`[EBAY SERVICE] Initialized with redirect URI: ${this.redirectUri}`);
  }

  getBaseUrl(): string {
    return this.sandboxMode 
      ? 'https://api.sandbox.ebay.com' 
      : 'https://api.ebay.com';
  }

  getAuthUrl(): string {
    return this.sandboxMode 
      ? 'https://auth.sandbox.ebay.com/oauth2/authorize' 
      : 'https://auth.ebay.com/oauth2/authorize';
  }

  getOAuthUrl(): string {
    const scopes = [
      'https://api.ebay.com/oauth/api_scope',
      'https://api.ebay.com/oauth/api_scope/sell.inventory',
      'https://api.ebay.com/oauth/api_scope/sell.marketing',
      'https://api.ebay.com/oauth/api_scope/sell.account',
      'https://api.ebay.com/oauth/api_scope/sell.fulfillment'
    ];

    const authUrl = new URL(this.getAuthUrl());
    authUrl.searchParams.append('client_id', this.clientId);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('redirect_uri', this.redirectUri);
    authUrl.searchParams.append('scope', encodeURIComponent(scopes.join(' ')));
    authUrl.searchParams.append('prompt', 'login');
    
    return authUrl.toString();
  }

  async getAccessToken(code: string): Promise<EbayOAuthResponse> {
    console.log(`[EBAY SERVICE] Getting access token with code: ${code.substring(0, 10)}...`);
    console.log(`[EBAY SERVICE] Using redirect URI: ${this.redirectUri}`);
    
    const tokenUrl = `${this.getBaseUrl()}/identity/v1/oauth2/token`;
    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    
    try {
      console.log(`[EBAY SERVICE] Making token request to: ${tokenUrl}`);
      const requestBody = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.redirectUri
      });
      
      console.log(`[EBAY SERVICE] Token request params: grant_type=authorization_code, redirect_uri=${this.redirectUri}, code=${code.substring(0, 10)}...`);
      
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`
        },
        body: requestBody
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[EBAY SERVICE] Token request failed with status ${response.status}: ${errorText}`);
        throw new Error(`Failed to get eBay access token: ${errorText}`);
      }

      const tokenData = await response.json() as EbayOAuthResponse;
      console.log(`[EBAY SERVICE] Successfully got access token, expires in ${tokenData.expires_in} seconds`);
      return tokenData;
    } catch (error) {
      console.error(`[EBAY SERVICE] Exception in getAccessToken: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<EbayOAuthResponse> {
    const tokenUrl = `${this.getBaseUrl()}/identity/v1/oauth2/token`;
    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to refresh eBay access token: ${error}`);
    }

    return await response.json() as EbayOAuthResponse;
  }

  async ensureValidToken(userId: number): Promise<string> {
    console.log(`[EBAY SERVICE] Ensuring valid token for user ID: ${userId}`);
    
    try {
      const user = await storage.getUser(userId);
      if (!user) {
        console.error(`[EBAY SERVICE] User not found with ID: ${userId}`);
        throw new Error('User not found');
      }

      if (!user.ebayToken || !user.ebayRefreshToken) {
        console.error(`[EBAY SERVICE] User not authenticated with eBay, ID: ${userId}`);
        throw new Error('User not authenticated with eBay');
      }

      // Check if token is expired or about to expire (within 5 minutes)
      const now = new Date();
      const tokenExpiry = user.ebayTokenExpiry;
      const tokenNeedsRefresh = !tokenExpiry || tokenExpiry.getTime() - now.getTime() < 5 * 60 * 1000;

      if (tokenNeedsRefresh && user.ebayRefreshToken) {
        console.log('[EBAY SERVICE] Token needs refresh, refreshing...');
        try {
          const tokenData = await this.refreshAccessToken(user.ebayRefreshToken);
          const expiryDate = new Date(now.getTime() + tokenData.expires_in * 1000);
          
          await storage.updateUserEbayTokens(
            userId,
            tokenData.access_token,
            tokenData.refresh_token || user.ebayRefreshToken,
            expiryDate
          );
          
          console.log('[EBAY SERVICE] Token refreshed successfully');
          return tokenData.access_token;
        } catch (error) {
          console.error('[EBAY SERVICE] Failed to refresh token:', error);
          throw new Error('Failed to refresh eBay authentication');
        }
      }

      console.log('[EBAY SERVICE] Using existing valid token');
      return user.ebayToken;
    } catch (error) {
      console.error('[EBAY SERVICE] Error in ensureValidToken:', error);
      throw new Error('No valid eBay token available. Please authenticate with eBay first.');
    }
  }

  async searchByImage(userId: number, imageBase64: string): Promise<EbayItemSummary[]> {
    // No more test mode shortcut - always make real API calls
    console.log('[EBAY SERVICE] Performing real eBay image search');
    
    try {
      const accessToken = await this.ensureValidToken(userId);
      
      console.log(`[EBAY SERVICE] Searching by image (base64 string length: ${imageBase64.length})`);
      
      // Check if we need to trim the data:image prefix
      const imageData = imageBase64.includes('base64,') 
        ? imageBase64.split('base64,')[1] 
        : imageBase64;
      
      console.log(`[EBAY SERVICE] Prepared image data for search (length: ${imageData.length})`);
      
      const url = `${this.getBaseUrl()}/buy/browse/v1/item_summary/search_by_image`;
      console.log(`[EBAY SERVICE] eBay search by image URL: ${url}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image: imageData
        })
      });

      console.log(`[EBAY SERVICE] eBay search by image response status: ${response.status}`);
      
      if (!response.ok) {
        const error = await response.text();
        console.error(`[EBAY SERVICE] eBay search by image failed: ${error}`);
        throw new Error(`eBay search by image failed: ${error}`);
      }

      const data = await response.json() as { itemSummaries?: any[] };
      
      if (data.itemSummaries && data.itemSummaries.length > 0) {
        console.log(`[EBAY SERVICE] Found ${data.itemSummaries.length} items through image search`);
        // Log first few items for debugging
        data.itemSummaries.slice(0, 3).forEach((item: any, index: number) => {
          console.log(`[EBAY SERVICE] Image search result ${index + 1}:`, {
            id: item.itemId,
            title: item.title,
            price: item.price?.value,
            currency: item.price?.currency,
            url: item.itemWebUrl
          });
        });
        return data.itemSummaries;
      } else {
        console.log('[EBAY SERVICE] No items found through image search');
        return [];
      }
    } catch (error) {
      console.error('[EBAY SERVICE] Error in searchByImage:', error);
      // Re-throw the error instead of using fallback data
      throw error;
    }
  }

  async getSoldItems(userId: number, searchTerms: string): Promise<EbaySoldItem[]> {
    console.log(`[EBAY SERVICE] Getting sold items for search: "${searchTerms}"`);
    
    // No more test mode shortcuts - always make real API calls
    console.log('[EBAY SERVICE] Performing real eBay search for sold items');
    
    try {
      const accessToken = await this.ensureValidToken(userId);
      
      const url = `${this.getBaseUrl()}/buy/browse/v1/item_summary/search?q=${encodeURIComponent(searchTerms)}&filter=soldItems:true`;
      console.log(`[EBAY SERVICE] Fetching sold items with URL: ${url}`);
      
      // Using the Browse API with a filter for sold items
      const response = await fetch(url, 
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          }
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error(`[EBAY SERVICE] Sold items search failed: ${error}`);
        throw new Error(`eBay sold items search failed: ${error}`);
      }

      const data = await response.json() as { itemSummaries?: any[] };
      console.log(`[EBAY SERVICE] Sold items response:`, JSON.stringify(data, null, 2).substring(0, 1000) + '...');
      
      if (data.itemSummaries && data.itemSummaries.length > 0) {
        console.log(`[EBAY SERVICE] Found ${data.itemSummaries.length} sold items`);
        data.itemSummaries.forEach((item: any, index: number) => {
          console.log(`[EBAY SERVICE] Sold item ${index + 1}:`, {
            id: item.itemId,
            title: item.title,
            price: item.price?.value,
            currency: item.price?.currency,
            url: item.itemWebUrl,
            categories: item.categories?.map((c: any) => c.categoryName).join(', ')
          });
        });
        return data.itemSummaries;
      } else {
        console.log(`[EBAY SERVICE] No sold items found for search: "${searchTerms}"`);
        return [];
      }
    } catch (error) {
      console.error('[EBAY SERVICE] Error in getSoldItems:', error);
      // Re-throw the error instead of using fallback data
      throw error;
    }
  }

  async getItemDetails(userId: number, itemId: string): Promise<any> {
    const accessToken = await this.ensureValidToken(userId);
    
    const response = await fetch(`${this.getBaseUrl()}/buy/browse/v1/item/${itemId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`eBay item details fetch failed: ${error}`);
    }

    return await response.json();
  }

  async createDraftListing(userId: number, listingData: any): Promise<string> {
    const accessToken = await this.ensureValidToken(userId);
    
    try {
      console.log("Creating eBay draft listing with data:", JSON.stringify(listingData, null, 2));
      
      // Step 1: Create inventory item
      const inventoryItemSku = `sku-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      // Deep clone the data to avoid modifying the original
      const inventoryItemData = JSON.parse(JSON.stringify(listingData.inventory_item));
      
      // Ensure condition is properly formatted for eBay API
      if (inventoryItemData && inventoryItemData.condition) {
        // Convert to string and ensure it matches eBay's expected format
        const conditionId = String(inventoryItemData.condition).trim();
        
        // Validate that it's a valid eBay condition ID format
        const isValidConditionId = /^\d+$/.test(conditionId);
        
        if (!isValidConditionId) {
          throw new Error(`Invalid condition ID format: ${conditionId}. eBay requires numeric condition IDs.`);
        }
        
        // Ensure it's set as a string in the API request
        inventoryItemData.condition = conditionId;
        console.log(`Using eBay condition ID: ${conditionId}`);
      }
      
      // Log the final request to help debug
      console.log(`Sending inventory request to ${this.getBaseUrl()}/sell/inventory/v1/inventory_item/${inventoryItemSku}`);
      console.log("Inventory item request payload:", JSON.stringify(inventoryItemData, null, 2));
      
      const inventoryItemResponse = await fetch(`${this.getBaseUrl()}/sell/inventory/v1/inventory_item/${inventoryItemSku}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Content-Language': 'en-US'
        },
        body: JSON.stringify(inventoryItemData)
      });

      // Handle inventory API errors
      if (!inventoryItemResponse.ok) {
        let errorMessage = "";
        let errorDetails = {};
        
        try {
          // Try to parse structured JSON error
          errorDetails = await inventoryItemResponse.json();
          errorMessage = JSON.stringify(errorDetails);
          console.error("eBay API error details:", errorDetails);
        } catch (e) {
          // Fallback to raw text if not JSON
          errorMessage = await inventoryItemResponse.text();
        }
        
        console.error(`eBay inventory creation failed with status ${inventoryItemResponse.status}:`, errorMessage);
        throw new Error(`eBay inventory item creation failed (${inventoryItemResponse.status}): ${errorMessage}`);
      }
      
      console.log(`Successfully created eBay inventory item with SKU: ${inventoryItemSku}`);
      
      // Step 2: Create an offer for the inventory item
      const offerData = {
        ...listingData.offer,
        sku: inventoryItemSku, 
        marketplaceId: "EBAY_US",
        format: "FIXED_PRICE"
      };
      
      console.log("Sending offer creation request with data:", JSON.stringify(offerData, null, 2));
      
      const offerResponse = await fetch(`${this.getBaseUrl()}/sell/inventory/v1/offer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Content-Language': 'en-US'
        },
        body: JSON.stringify(offerData)
      });

      // Handle offer API errors
      if (!offerResponse.ok) {
        let errorMessage = "";
        let errorDetails = {};
        
        try {
          errorDetails = await offerResponse.json();
          errorMessage = JSON.stringify(errorDetails);
          console.error("eBay offer error details:", errorDetails);
        } catch (e) {
          errorMessage = await offerResponse.text();
        }
        
        console.error(`eBay offer creation failed with status ${offerResponse.status}:`, errorMessage);
        throw new Error(`eBay offer creation failed (${offerResponse.status}): ${errorMessage}`);
      }
      
      // Parse offer response to get the ID
      let offerId = '';
      try {
        const offerResponseData = await offerResponse.json() as { offerId?: string };
        
        if (!offerResponseData || !offerResponseData.offerId) {
          console.error("eBay offer creation succeeded but no offer ID was returned:", offerResponseData);
          throw new Error("eBay offer created but no offer ID returned");
        }
        
        offerId = offerResponseData.offerId;
        console.log(`Successfully created eBay offer with ID: ${offerId}`);
      } catch (e) {
        console.error("Failed to parse offer response:", e);
        throw new Error("Failed to parse eBay offer response: " + (e instanceof Error ? e.message : String(e)));
      }
      
      // Return the offer ID as the draft ID
      return offerId;
    } catch (error) {
      console.error("Error in createDraftListing:", error);
      throw error;
    }
  }

  async uploadImage(userId: number, imageBase64: string): Promise<string> {
    const accessToken = await this.ensureValidToken(userId);
    
    const response = await fetch(`${this.getBaseUrl()}/sell/marketing/v1/ad_media_upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        mediaData: {
          data: imageBase64
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`eBay image upload failed: ${error}`);
    }

    const data = await response.json() as { imageUrl?: string };
    return data.imageUrl || '';
  }
}

export const ebayService = new EbayService();
