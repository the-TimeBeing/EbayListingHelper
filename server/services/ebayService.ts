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
    try {
      // Get the current token for the user
      const tokenData = await storage.getEbayToken(userId);
      
      if (!tokenData) {
        console.error(`[EBAY SERVICE] No token found for user ${userId}`);
        throw new Error(`No eBay token found for user ${userId}. Please authenticate with eBay first.`);
      }
      
      // Check if the token is expired or will expire soon (within 5 minutes)
      const expiresAt = new Date(tokenData.expiresAt || 0);
      const now = new Date();
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
      
      // Log token expiration status
      console.log(`[EBAY SERVICE] Token expiration check for user ${userId}:`);
      console.log(`[EBAY SERVICE] Current time: ${now.toISOString()}`);
      console.log(`[EBAY SERVICE] Token expires: ${expiresAt.toISOString()}`);
      console.log(`[EBAY SERVICE] Token expired: ${expiresAt <= now}`);
      console.log(`[EBAY SERVICE] Token expires soon: ${expiresAt <= fiveMinutesFromNow}`);
      
      if (expiresAt <= now) {
        console.log(`[EBAY SERVICE] Token expired for user ${userId}, refreshing...`);
        // Token is expired, try to refresh
        if (!tokenData.refreshToken) {
          throw new Error("Refresh token not available. Please re-authenticate with eBay.");
        }
        
        return await this.refreshToken(userId, tokenData.refreshToken);
      } else if (expiresAt <= fiveMinutesFromNow) {
        console.log(`[EBAY SERVICE] Token expires soon for user ${userId}, refreshing proactively...`);
        // Token will expire soon, proactively refresh it
        if (!tokenData.refreshToken) {
          // If no refresh token but access token is still valid, return the current token
          return tokenData.accessToken;
        }
        
        return await this.refreshToken(userId, tokenData.refreshToken);
      }
      
      // Token is valid and not expiring soon
      console.log(`[EBAY SERVICE] Using existing valid token for user ${userId}`);
      return tokenData.accessToken;
    } catch (error) {
      console.error(`[EBAY SERVICE] Error ensuring valid token:`, error);
      throw new Error(`eBay authentication error: ${error instanceof Error ? error.message : String(error)}`);
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
      
      // Prepare a clean copy of the inventory item data for the API
      const inventoryItemData = { ...listingData.inventory_item };
      
      // Make sure condition is properly formatted for eBay API
      if (inventoryItemData.condition) {
        // Make sure it's a string
        inventoryItemData.condition = String(inventoryItemData.condition);
        
        // Validate that it's a valid eBay condition enum value
        const validConditionEnums = [
          "NEW", "NEW_WITH_TAGS", "NEW_WITHOUT_TAGS", "NEW_WITH_DEFECTS", 
          "LIKE_NEW", "VERY_GOOD", "GOOD", "ACCEPTABLE", "USED", 
          "FOR_PARTS_OR_NOT_WORKING"
        ];
        
        // First, check if it's already a valid enum (case-insensitive)
        const upperCondition = inventoryItemData.condition.toUpperCase();
        
        if (validConditionEnums.includes(upperCondition)) {
          // Use the validated uppercase version
          inventoryItemData.condition = upperCondition;
          console.log(`Using validated condition: ${inventoryItemData.condition}`);
        } else {
          // If not a valid enum, attempt to map from our frontend conditions
          const conditionMap: Record<string, string> = {
            "New": "NEW",
            "Like New": "LIKE_NEW",
            "Used - Good": "GOOD",
            "Used - Fair": "USED",
            "Used - Poor": "FOR_PARTS_OR_NOT_WORKING"
          };
          
          if (conditionMap[inventoryItemData.condition]) {
            inventoryItemData.condition = conditionMap[inventoryItemData.condition];
            console.log(`Mapped condition "${inventoryItemData.condition}" to eBay format`);
          } else {
            console.warn(`Invalid condition enum: ${inventoryItemData.condition}. Defaulting to NEW`);
            inventoryItemData.condition = "NEW";
          }
        }
      }
      
      // Log the final data being sent to eBay
      console.log("Sending inventory item data to eBay:", JSON.stringify(inventoryItemData, null, 2));
      
      // Make the API call with the validated data
      const inventoryItemResponse = await fetch(`${this.getBaseUrl()}/sell/inventory/v1/inventory_item/${inventoryItemSku}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Content-Language': 'en-US'
        },
        body: JSON.stringify(inventoryItemData)
      });

      if (!inventoryItemResponse.ok) {
        let errorMessage = "";
        let errorDetail: Record<string, any> = {};
        try {
          const errorJson = await inventoryItemResponse.json();
          errorDetail = errorJson as Record<string, any>;
          errorMessage = JSON.stringify(errorJson, null, 2);
        } catch (e) {
          errorMessage = await inventoryItemResponse.text();
        }
        console.error("eBay inventory item creation failed:", errorMessage);
        console.error("Request data sent to eBay:", JSON.stringify(inventoryItemData, null, 2));
        
        // Check for specific error types and provide more helpful messages
        if (typeof errorDetail === 'object' && errorDetail !== null) {
          // Handle specific eBay API error cases
          if ('errors' in errorDetail && Array.isArray(errorDetail.errors)) {
            const ebayErrors = errorDetail.errors;
            if (ebayErrors.length > 0) {
              const mainError = ebayErrors[0];
              console.error("eBay specific error:", mainError);
              
              // Build a more specific error message with additional request context
              const detailedError = `eBay error: ${mainError.message || 'Unknown eBay error'}. The sent inventory item data: ${JSON.stringify(inventoryItemData, null, 2)}`;
              throw new Error(detailedError);
            }
          }
        }
        
        // Full error context with request data
        throw new Error(`eBay inventory item creation failed: ${errorMessage}. Request data: ${JSON.stringify(inventoryItemData, null, 2)}`);
      }
      
      console.log(`Successfully created eBay inventory item with SKU: ${inventoryItemSku}`);
      
      // Step 2: Create an offer for the inventory item
      // Based on eBay API requirements, we need to use policy IDs instead of inline policies
      const offerData = {
        sku: inventoryItemSku,
        marketplaceId: "EBAY_US",
        format: "FIXED_PRICE",
        listingDescription: inventoryItemData.product.description,
        pricingSummary: {
          price: {
            value: listingData.offer.pricingSummary.price.value,
            currency: "USD"
          }
        },
        categoryId: listingData.offer.categoryId || "139971", // Use the category ID from the offer data or default to Video Game Accessories
        listingPolicies: {} as Record<string, string>
      };
      
      // Check if we have policy IDs in the incoming data (preferred method)
      if (listingData.offer.listingPolicies?.fulfillmentPolicyId) {
        // Using policy IDs is the recommended approach
        offerData.listingPolicies["fulfillmentPolicyId"] = listingData.offer.listingPolicies.fulfillmentPolicyId;
      }
      
      if (listingData.offer.listingPolicies?.paymentPolicyId) {
        offerData.listingPolicies["paymentPolicyId"] = listingData.offer.listingPolicies.paymentPolicyId;
      }
      
      if (listingData.offer.listingPolicies?.returnPolicyId) {
        offerData.listingPolicies["returnPolicyId"] = listingData.offer.listingPolicies.returnPolicyId;
      }
      
      // If no policy IDs are provided, use default IDs
      // These IDs should come from eBay Seller Hub in a production environment
      if (!listingData.offer.listingPolicies?.fulfillmentPolicyId && 
          !listingData.offer.listingPolicies?.paymentPolicyId && 
          !listingData.offer.listingPolicies?.returnPolicyId) {
        console.warn("No policy IDs found - using default values. In production, get these from eBay Seller Hub.");
        
        // Attempt to retrieve actual policy IDs from the seller's account
        try {
          const policies = await this.getSellerPolicies(userId);
          
          if (policies.fulfillmentPolicyId) {
            offerData.listingPolicies["fulfillmentPolicyId"] = policies.fulfillmentPolicyId;
          } else {
            console.warn("No fulfillment policy found for seller - creating eBay listings will likely fail");
          }
          
          if (policies.paymentPolicyId) {
            offerData.listingPolicies["paymentPolicyId"] = policies.paymentPolicyId;
          } else {
            console.warn("No payment policy found for seller - creating eBay listings will likely fail");
          }
          
          if (policies.returnPolicyId) {
            offerData.listingPolicies["returnPolicyId"] = policies.returnPolicyId;
          } else {
            console.warn("No return policy found for seller - creating eBay listings will likely fail");
          }
        } catch (policyError) {
          console.error("Failed to retrieve seller policies:", policyError);
          console.warn("Using placeholder policy IDs - this will likely fail in production");
          
          // For sandbox testing - these will NOT work in production
          // Production requires actual policy IDs from the seller's account
          offerData.listingPolicies["fulfillmentPolicyId"] = "3047524000";
          offerData.listingPolicies["paymentPolicyId"] = "3047397000";
          offerData.listingPolicies["returnPolicyId"] = "3047348000";
        }
      }
      
      console.log("Using offer data from template:", {
        categoryId: offerData.categoryId,
        hasFulfillmentPolicyId: !!offerData.listingPolicies["fulfillmentPolicyId"],
        hasPaymentPolicyId: !!offerData.listingPolicies["paymentPolicyId"], 
        hasReturnPolicyId: !!offerData.listingPolicies["returnPolicyId"]
      });
      
      // Map specific product types to more accurate eBay category IDs
      // This mapping helps ensure controllers go to the right category
      const title = inventoryItemData.product.title?.toLowerCase() || '';
      
      // For Nintendo Switch controllers, use the proper category
      if (title.includes('nintendo') && title.includes('switch') && title.includes('controller')) {
        // Nintendo Switch Controllers category
        offerData.categoryId = "117042";
        console.log("Mapped to Nintendo Switch Controllers category (117042)");
      }
      // For generic Nintendo accessories
      else if (title.includes('nintendo') && title.includes('switch')) {
        // Nintendo Switch Accessories category
        offerData.categoryId = "139971";
        console.log("Mapped to Nintendo Switch Accessories category (139971)");
      }
      // For any video game controllers
      else if (title.includes('controller')) {
        // Video Game Controllers category
        offerData.categoryId = "117042";
        console.log("Mapped to Video Game Controllers category (117042)");
      }
      
      console.log("Using category ID:", offerData.categoryId);
      
      const offerResponse = await fetch(`${this.getBaseUrl()}/sell/inventory/v1/offer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Content-Language': 'en-US'
        },
        body: JSON.stringify(offerData)
      });

      if (!offerResponse.ok) {
        let errorMessage = "";
        let errorDetail: Record<string, any> = {};
        try {
          const errorJson = await offerResponse.json();
          errorDetail = errorJson as Record<string, any>;
          errorMessage = JSON.stringify(errorJson, null, 2);
        } catch (e) {
          errorMessage = await offerResponse.text();
        }
        console.error("eBay offer creation failed:", errorMessage);
        console.error("Offer data sent to eBay:", JSON.stringify(offerData, null, 2));
        
        // Check for specific eBay API error cases
        if (typeof errorDetail === 'object' && errorDetail !== null) {
          if ('errors' in errorDetail && Array.isArray(errorDetail.errors)) {
            const ebayErrors = errorDetail.errors;
            if (ebayErrors.length > 0) {
              const mainError = ebayErrors[0];
              console.error("eBay specific offer error:", mainError);
              
              // Build a more specific error message with request data
              const detailedError = `eBay offer error: ${mainError.message || 'Unknown eBay error'}. The sent offer data: ${JSON.stringify(offerData, null, 2)}`;
              throw new Error(detailedError);
            }
          }
        }
        
        // Full error context with request data
        throw new Error(`eBay offer creation failed: ${errorMessage}. Offer data: ${JSON.stringify(offerData, null, 2)}`);
      }
      
      // Parse the successful response
      let offerId = '';
      try {
        const offerResponseData = await offerResponse.json() as Record<string, any>;
        console.log("Full offer response:", JSON.stringify(offerResponseData, null, 2));
        
        // Ensure we get a valid offerId or create a predictable fallback
        if (offerResponseData && typeof offerResponseData === 'object' && 'offerId' in offerResponseData && offerResponseData.offerId) {
          // Access through index notation and explicitly convert to string to satisfy TypeScript
          offerId = String(offerResponseData['offerId']);
        } else {
          // If we didn't get an offerId but the request was successful, generate a placeholder
          // This should rarely happen since the response should contain an offerId if successful
          console.warn("No offerId found in eBay response despite successful request");
          offerId = `offer-${Date.now()}`;
        }
      } catch (e) {
        console.error("Failed to parse offer response:", e);
        // If we couldn't parse the JSON at all, use an error fallback
        offerId = `offer-error-${Date.now()}`;
      }
      
      console.log(`Successfully created eBay offer with ID: ${offerId}`);
      
      // Return the offer ID as the draft ID
      return offerId || '';
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

  // Add the missing refreshToken method needed by ensureValidToken
  async refreshToken(userId: number, refreshToken: string): Promise<string> {
    console.log(`[EBAY SERVICE] Refreshing token for user ${userId} using refresh token`);
    try {
      const tokenData = await this.refreshAccessToken(refreshToken);
      
      if (!tokenData || !tokenData.access_token) {
        throw new Error("Failed to refresh eBay token - invalid response");
      }
      
      const now = new Date();
      const expiryDate = new Date(now.getTime() + (tokenData.expires_in || 7200) * 1000);
      
      // Update the storage with the new tokens
      await storage.updateUserEbayTokens(
        userId,
        tokenData.access_token,
        tokenData.refresh_token || refreshToken, // Use new refresh token if provided, otherwise keep the old one
        expiryDate
      );
      
      console.log(`[EBAY SERVICE] Token successfully refreshed for user ${userId}, expires at ${expiryDate.toISOString()}`);
      return tokenData.access_token;
    } catch (error) {
      console.error(`[EBAY SERVICE] Error refreshing token:`, error);
      throw new Error(`Failed to refresh eBay token: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Retrieves the seller's policy IDs for fulfillment, payment, and return policies.
   * This is necessary for creating offers with eBay's Inventory API.
   */
  async getSellerPolicies(userId: number): Promise<{
    fulfillmentPolicyId?: string;
    paymentPolicyId?: string;
    returnPolicyId?: string;
  }> {
    const accessToken = await this.ensureValidToken(userId);
    const policies = {
      fulfillmentPolicyId: undefined,
      paymentPolicyId: undefined,
      returnPolicyId: undefined
    };
    
    try {
      // Get fulfillment policies
      const fulfillmentResponse = await fetch(`${this.getBaseUrl()}/sell/account/v1/fulfillment_policy?marketplace_id=EBAY_US`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (fulfillmentResponse.ok) {
        const fulfillmentData = await fulfillmentResponse.json() as any;
        console.log("Retrieved fulfillment policies:", JSON.stringify(fulfillmentData, null, 2));
        
        if (fulfillmentData && 
            fulfillmentData.fulfillmentPolicies && 
            Array.isArray(fulfillmentData.fulfillmentPolicies) && 
            fulfillmentData.fulfillmentPolicies.length > 0) {
          // Use the first policy found (sellers typically have default policies)
          policies.fulfillmentPolicyId = fulfillmentData.fulfillmentPolicies[0].fulfillmentPolicyId;
          console.log(`Using fulfillment policy: ${policies.fulfillmentPolicyId}`);
        }
      } else {
        console.warn("Failed to retrieve fulfillment policies:", await fulfillmentResponse.text());
      }
      
      // Get payment policies
      const paymentResponse = await fetch(`${this.getBaseUrl()}/sell/account/v1/payment_policy?marketplace_id=EBAY_US`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (paymentResponse.ok) {
        const paymentData = await paymentResponse.json() as any;
        console.log("Retrieved payment policies:", JSON.stringify(paymentData, null, 2));
        
        if (paymentData && 
            paymentData.paymentPolicies && 
            Array.isArray(paymentData.paymentPolicies) && 
            paymentData.paymentPolicies.length > 0) {
          policies.paymentPolicyId = paymentData.paymentPolicies[0].paymentPolicyId;
          console.log(`Using payment policy: ${policies.paymentPolicyId}`);
        }
      } else {
        console.warn("Failed to retrieve payment policies:", await paymentResponse.text());
      }
      
      // Get return policies
      const returnResponse = await fetch(`${this.getBaseUrl()}/sell/account/v1/return_policy?marketplace_id=EBAY_US`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (returnResponse.ok) {
        const returnData = await returnResponse.json() as any;
        console.log("Retrieved return policies:", JSON.stringify(returnData, null, 2));
        
        if (returnData && 
            returnData.returnPolicies && 
            Array.isArray(returnData.returnPolicies) && 
            returnData.returnPolicies.length > 0) {
          policies.returnPolicyId = returnData.returnPolicies[0].returnPolicyId;
          console.log(`Using return policy: ${policies.returnPolicyId}`);
        }
      } else {
        console.warn("Failed to retrieve return policies:", await returnResponse.text());
      }
      
      return policies;
    } catch (error) {
      console.error("Error retrieving seller policies:", error);
      throw new Error(`Failed to get seller policies: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async generateSandboxToken(): Promise<{
    access_token: string;
    expires_in: number;
    refresh_token: string;
  }> {
    // Use sandbox credentials
    const sandboxCredentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    
    const response = await fetch('https://api.sandbox.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${sandboxCredentials}`
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'https://api.ebay.com/oauth/api_scope'
      })
    });

    if (!response.ok) {
      throw new Error('Failed to get sandbox token');
    }

    return await response.json() as EbayOAuthResponse;
  }
}

export const ebayService = new EbayService();
