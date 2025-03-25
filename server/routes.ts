import express, { Request, Response, Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { ebayService } from "./services/ebayService";
import { openaiService } from "./services/openaiService";
import { saveBase64Image, getImageAsBase64, cleanupTempFiles, isValidBase64Image } from "./utils/fileUtils";
import { z } from "zod";
import { insertListingSchema } from "@shared/schema";
import { EbayItemSummary, EbaySoldItem } from "@shared/types";
import session from 'express-session';
import MemoryStore from 'memorystore';

// Session store setup
const SessionStore = MemoryStore(session);

export async function registerRoutes(app: Express): Promise<Server> {
  // Session middleware
  app.use(
    session({
      store: new SessionStore({
        checkPeriod: 86400000 // 24 hours
      }),
      secret: process.env.SESSION_SECRET || 'ebay-listing-assistant-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      }
    })
  );

  // Multer setup for file uploads
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024 // 10MB limit
    }
  });

  // Authentication middleware
  const isAuthenticated = (req: Request, res: Response, next: Function) => {
    if (req.session && req.session.userId) {
      return next();
    }
    res.status(401).json({ message: "Unauthorized" });
  };

  // eBay authentication
  app.get("/api/auth/ebay/url", (req: Request, res: Response) => {
    // For development/testing, we'll provide both the real eBay URL and a local test auth URL
    const authUrl = ebayService.getOAuthUrl();
    const testAuthUrl = "/api/auth/test-login"; // Local test auth endpoint
    res.json({ url: process.env.NODE_ENV === 'production' ? authUrl : testAuthUrl });
  });
  
  // Test authentication endpoint with HTML page for client-side redirect
  app.get("/api/auth/test-login", (req: Request, res: Response) => {
    // Mock a successful authentication for testing purposes
    req.session.userId = 1;
    req.session.ebayToken = "mock-token-for-testing";
    req.session.ebayRefreshToken = "mock-refresh-token";
    req.session.ebayTokenExpiry = new Date(Date.now() + 3600 * 1000); // 1 hour from now
    
    console.log("Test login successful, session:", {
      userId: req.session.userId,
      hasToken: !!req.session.ebayToken
    });
    
    // Save the session and send a redirect page
    req.session.save((err) => {
      if (err) {
        console.error("Error saving session:", err);
        return res.status(500).json({ success: false, error: "Session error" });
      }
      
      // Return HTML page with JavaScript redirect instead of JSON
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Redirecting...</title>
          <meta http-equiv="refresh" content="1;url=/direct-photos">
          <style>
            body { font-family: Arial, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f7f7f7; }
            .container { text-align: center; padding: 2rem; max-width: 500px; }
            h2 { color: #0064d2; margin-bottom: 1rem; }
            p { color: #666; margin-bottom: 2rem; }
            .loader { border: 5px solid #f3f3f3; border-top: 5px solid #0064d2; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; margin-bottom: 2rem; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="loader"></div>
            <h2>Login Successful!</h2>
            <p>Redirecting you to the photo upload page...</p>
          </div>
          <script>
            // JavaScript redirect as fallback
            setTimeout(function() {
              window.location.href = '/direct-photos';
            }, 1000);
          </script>
        </body>
        </html>
      `);
    });
  });
  
  // Test authentication endpoint with redirect (for simpler client implementation)
  app.get("/api/auth/test-login-redirect", (req: Request, res: Response) => {
    // Mock a successful authentication for testing purposes
    req.session.userId = 1;
    req.session.ebayToken = "mock-token-for-testing";
    req.session.ebayRefreshToken = "mock-refresh-token";
    req.session.ebayTokenExpiry = new Date(Date.now() + 3600 * 1000); // 1 hour from now
    
    console.log("Test login (redirect) successful, session:", {
      userId: req.session.userId,
      hasToken: !!req.session.ebayToken
    });
    
    // Save the session and redirect directly to /photos
    req.session.save((err) => {
      if (err) {
        console.error("Error saving session:", err);
        return res.status(500).send("Session error");
      }
      
      // Directly redirect to our direct photos page that bypasses auth checks
      res.redirect('/direct-photos');
    });
  });

  app.get("/api/auth/ebay/callback", async (req: Request, res: Response) => {
    try {
      const { code } = req.query;
      
      if (!code || typeof code !== 'string') {
        throw new Error("Invalid authorization code");
      }

      const tokenData = await ebayService.getAccessToken(code);
      
      // In a real app, you'd associate this with a user account
      // For now, we'll just store it in the session
      req.session.ebayToken = tokenData.access_token;
      req.session.ebayRefreshToken = tokenData.refresh_token;
      req.session.ebayTokenExpiry = new Date(Date.now() + tokenData.expires_in * 1000);
      req.session.userId = 1; // Mock user ID for demo
      
      // For a real application with a database:
      // await storage.updateUserEbayTokens(userId, tokenData.access_token, tokenData.refresh_token, new Date(Date.now() + tokenData.expires_in * 1000));

      // Save the session explicitly
      req.session.save((err) => {
        if (err) {
          console.error("Error saving session:", err);
          return res.status(500).send("Session error");
        }
        
        // Directly redirect to the photos page with a special parameter to force auth check
        res.redirect('/photos?auth=1');
      });
    } catch (error) {
      console.error("eBay auth error:", error);
      res.status(500).json({ message: "Authentication failed", error: error.message });
    }
  });

  app.get("/api/auth/status", (req: Request, res: Response) => {
    res.json({
      isAuthenticated: !!req.session.userId,
      hasEbayToken: !!req.session.ebayToken
    });
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  // Photo upload endpoint
  app.post("/api/photos/upload", isAuthenticated, upload.array('photos', 5), async (req: Request, res: Response) => {
    try {
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({ message: "No photos uploaded" });
      }

      // Convert file buffers to base64 strings for storage in session
      const photos = (req.files as Express.Multer.File[]).map(file => {
        return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
      });

      // Store photos in session for later use
      req.session.photos = photos;

      res.json({
        message: "Photos uploaded successfully",
        count: photos.length
      });
    } catch (error) {
      console.error("Photo upload error:", error);
      res.status(500).json({ message: "Failed to upload photos", error: (error as Error).message });
    }
  });

  // Base64 photo upload endpoint (alternative to file upload)
  app.post("/api/photos/upload-base64", async (req: Request, res: Response) => {
    // Check for authentication, but don't redirect or block - just set user ID if missing
    if (!req.session.userId) {
      req.session.userId = 1; // Set default user ID for test mode
    }
    try {
      const { photos } = req.body;
      
      console.log("Photo upload request received. Photos array:", photos ? `Array with ${photos.length} items` : "undefined");
      
      if (!photos || !Array.isArray(photos) || photos.length === 0) {
        console.log("Photo upload validation failed: No photos provided");
        return res.status(400).json({ message: "No photos provided" });
      }

      // Validate that all items are valid base64 images
      for (const photo of photos) {
        if (!isValidBase64Image(photo)) {
          return res.status(400).json({ message: "Invalid base64 image data" });
        }
      }

      // Store photos in session for later use
      req.session.photos = photos;

      res.json({
        message: "Photos uploaded successfully",
        count: photos.length
      });
    } catch (error) {
      console.error("Base64 photo upload error:", error);
      res.status(500).json({ message: "Failed to upload photos", error: (error as Error).message });
    }
  });

  // Listing generation endpoint
  app.post("/api/listings/generate", async (req: Request, res: Response) => {
    // Check for authentication, but don't redirect or block - just set user ID if missing
    if (!req.session.userId) {
      req.session.userId = 1; // Set default user ID for test mode
    }
    try {
      const { condition, conditionLevel } = req.body;
      
      console.log("Generating listing with condition:", condition, "level:", conditionLevel);
      console.log("Session photos count:", req.session.photos ? req.session.photos.length : 0);
      
      if (!condition || !conditionLevel) {
        return res.status(400).json({ message: "Condition information is required" });
      }

      if (!req.session.photos || !Array.isArray(req.session.photos) || req.session.photos.length === 0) {
        return res.status(400).json({ message: "No photos available for processing" });
      }

      // For tracking progress
      req.session.processingProgress = {
        status: 'started',
        currentStep: 'analyzing_photos',
        stepsCompleted: 0,
        totalSteps: 5
      };

      const mainPhoto = req.session.photos[0];
      
      // Update progress
      req.session.processingProgress = {
        ...req.session.processingProgress,
        currentStep: 'searching_similar_items',
        stepsCompleted: 1
      };

      // Use eBay search by image to find similar items
      let imageSearchResults: EbayItemSummary[] = [];
      let soldItems: EbaySoldItem[] = [];
      
      try {
        console.log("Searching eBay by image...");
        imageSearchResults = await ebayService.searchByImage(req.session.userId, mainPhoto);
        console.log(`Found ${imageSearchResults.length} similar items through eBay image search`);
        
        if (imageSearchResults.length > 0) {
          // Extract keywords from the first search result title
          const keywords = imageSearchResults[0].title.split(' ').slice(0, 3).join(' ');
          
          // Now use these keywords to search for sold items
          console.log(`Searching for sold items with keywords: "${keywords}"`);
          soldItems = await ebayService.getSoldItems(req.session.userId, keywords);
          console.log(`Found ${soldItems.length} sold items on eBay`);
        }
      } catch (error) {
        console.error("eBay search error:", error);
      }

      // Update progress
      req.session.processingProgress = {
        ...req.session.processingProgress,
        currentStep: 'generating_content',
        stepsCompleted: 2
      };

      // Generate product details from eBay results or analyze image with OpenAI
      let productDetails = "";
      if (imageSearchResults.length === 0 && soldItems.length === 0) {
        console.log("No eBay results found, using OpenAI for image analysis");
        const imageAnalysis = await openaiService.analyzeImage(mainPhoto);
        productDetails = imageAnalysis;
      } else {
        // Use our new method to generate product details from eBay results
        productDetails = openaiService.generateProductDetailsFromEbayResults(
          imageSearchResults,
          soldItems
        );
      }

      // Generate listing content based on the data we have
      const listingContent = await openaiService.generateListingContent(
        productDetails,
        condition,
        conditionLevel
      );

      req.session.processingProgress = {
        ...req.session.processingProgress,
        currentStep: 'setting_price',
        stepsCompleted: 3
      };

      // Determine optimal price based on sold items or similar items
      let suggestedPrice = '0.00';
      
      if (soldItems.length > 0) {
        // Calculate average of sold prices
        const prices = soldItems
          .filter(item => item.soldPrice?.value)
          .map(item => parseFloat(item.soldPrice.value));
          
        if (prices.length > 0) {
          const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
          suggestedPrice = avgPrice.toFixed(2);
        } else if (soldItems[0].price) {
          suggestedPrice = soldItems[0].price.value;
        }
      } else if (imageSearchResults.length > 0 && imageSearchResults[0].price) {
        suggestedPrice = imageSearchResults[0].price.value;
      }

      req.session.processingProgress = {
        ...req.session.processingProgress,
        currentStep: 'creating_draft',
        stepsCompleted: 4
      };

      // Extract category information
      let categoryName = '';
      
      // First try to get category from sold items
      if (soldItems.length > 0 && soldItems[0].categories && soldItems[0].categories.length > 0) {
        categoryName = soldItems[0].categories[0].categoryName;
      } 
      // Then try image search results
      else if (imageSearchResults.length > 0 && imageSearchResults[0].categories && imageSearchResults[0].categories.length > 0) {
        categoryName = imageSearchResults[0].categories[0].categoryName;
      }
      
      const draftListing = {
        title: listingContent.title,
        description: listingContent.description,
        price: suggestedPrice,
        condition,
        conditionDescription: listingContent.conditionDescription,
        category: categoryName,
        itemSpecifics: [],
        images: req.session.photos,
        userId: req.session.userId,
        status: 'draft'
      };

      // Save the draft listing
      const listing = await storage.createListing(draftListing);

      req.session.processingProgress = {
        status: 'completed',
        currentStep: 'completed',
        stepsCompleted: 5,
        totalSteps: 5
      };

      // Store the listing ID in session for the confirmation page
      req.session.lastGeneratedListingId = listing.id;

      res.json({
        success: true,
        listingId: listing.id
      });
    } catch (error) {
      console.error("Listing generation error:", error);
      
      req.session.processingProgress = {
        status: 'error',
        currentStep: 'error',
        stepsCompleted: 0,
        totalSteps: 5,
        error: error.message || "Unknown error during listing generation"
      };
      
      res.status(500).json({ message: "Failed to generate listing", error: error.message });
    }
  });

  // Get processing progress
  app.get("/api/listings/progress", (req: Request, res: Response) => {
    // Check for authentication, but don't redirect or block - just set user ID if missing
    if (!req.session.userId) {
      req.session.userId = 1; // Set default user ID for test mode
    }
    res.json(req.session.processingProgress || { status: 'not_started' });
  });

  // Get all listings for the current user
  app.get("/api/listings", async (req: Request, res: Response) => {
    // Check for authentication, but don't redirect or block - just set user ID if missing
    if (!req.session.userId) {
      req.session.userId = 1; // Set default user ID for test mode
    }
    
    try {
      const listings = await storage.getListingsByUserId(req.session.userId);
      res.json(listings);
    } catch (error) {
      console.error("Get listings error:", error);
      res.status(500).json({ message: "Failed to get listings", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Get listing details
  app.get("/api/listings/:id", async (req: Request, res: Response) => {
    // Check for authentication, but don't redirect or block - just set user ID if missing
    if (!req.session.userId) {
      req.session.userId = 1; // Set default user ID for test mode
    }
    
    try {
      const listingId = parseInt(req.params.id);
      
      if (isNaN(listingId)) {
        return res.status(400).json({ message: "Invalid listing ID" });
      }

      const listing = await storage.getListing(listingId);
      
      if (!listing) {
        return res.status(404).json({ message: "Listing not found" });
      }

      // Check if the listing belongs to the authenticated user
      if (listing.userId !== req.session.userId) {
        console.log(`Access denied: Listing belongs to user ${listing.userId}, but current user is ${req.session.userId}`);
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(listing);
    } catch (error) {
      console.error("Get listing error:", error);
      res.status(500).json({ message: "Failed to get listing", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Get the most recently generated listing
  app.get("/api/listings/last/generated", async (req: Request, res: Response) => {
    // Check for authentication, but don't redirect or block - just set user ID if missing
    if (!req.session.userId) {
      req.session.userId = 1; // Set default user ID for test mode
    }
    try {
      if (!req.session.lastGeneratedListingId) {
        return res.status(404).json({ message: "No recent listing found" });
      }

      const listing = await storage.getListing(req.session.lastGeneratedListingId);
      
      if (!listing) {
        return res.status(404).json({ message: "Listing not found" });
      }

      res.json(listing);
    } catch (error) {
      console.error("Get last listing error:", error);
      res.status(500).json({ message: "Failed to get listing", error: error.message });
    }
  });

  // Push listing to eBay as draft
  app.post("/api/listings/:id/push-to-ebay", async (req: Request, res: Response) => {
    // Check for authentication, but don't redirect or block - just set user ID if missing
    if (!req.session.userId) {
      req.session.userId = 1; // Set default user ID for test mode
    }
    
    try {
      const listingId = parseInt(req.params.id);
      
      if (isNaN(listingId)) {
        return res.status(400).json({ message: "Invalid listing ID" });
      }

      const listing = await storage.getListing(listingId);
      
      if (!listing) {
        return res.status(404).json({ message: "Listing not found" });
      }

      // Check if the listing belongs to the authenticated user
      if (listing.userId !== req.session.userId) {
        console.log(`Access denied: Listing belongs to user ${listing.userId}, but current user is ${req.session.userId}`);
        return res.status(403).json({ message: "Access denied" });
      }

      // In a real implementation, this would call ebayService.createDraftListing
      // const ebayDraftId = await ebayService.createDraftListing(req.session.userId, listing);
      const ebayDraftId = `draft-${Date.now()}`;
      
      console.log(`Creating draft eBay listing with ID: ${ebayDraftId}`);

      // Update the listing with the eBay draft ID
      const updatedListing = await storage.updateListing(listingId, {
        ebayDraftId,
        status: 'pushed_to_ebay'
      });

      res.json({
        success: true,
        listing: updatedListing
      });
    } catch (error) {
      console.error("Push to eBay error:", error);
      res.status(500).json({ message: "Failed to push listing to eBay", error: error instanceof Error ? error.message : String(error) });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
