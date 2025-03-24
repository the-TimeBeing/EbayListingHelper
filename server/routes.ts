import express, { Request, Response, Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { ebayService } from "./services/ebayService";
import { openaiService } from "./services/openaiService";
import { saveBase64Image, getImageAsBase64, cleanupTempFiles, isValidBase64Image } from "./utils/fileUtils";
import { z } from "zod";
import { insertListingSchema } from "@shared/schema";
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
  
  // Test authentication endpoint (API returning JSON response)
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
    
    // Save the session and respond with JSON instead of redirecting
    req.session.save((err) => {
      if (err) {
        console.error("Error saving session:", err);
        return res.status(500).json({ success: false, error: "Session error" });
      }
      
      // Return success JSON instead of redirecting
      return res.status(200).json({ 
        success: true, 
        isAuthenticated: true,
        message: "Test login successful" 
      });
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

      if (!photos || !Array.isArray(photos) || photos.length === 0) {
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

      // 1. Analyze the first photo with OpenAI Vision to get product details
      const mainPhoto = req.session.photos[0];
      const imageAnalysis = await openaiService.analyzeImage(mainPhoto);
      
      req.session.processingProgress = {
        ...req.session.processingProgress,
        currentStep: 'searching_similar_items',
        stepsCompleted: 1
      };

      // 2. Use eBay search by image to find similar items (mocked for now)
      // In a real implementation, this would call ebayService.searchByImage
      // const searchResults = await ebayService.searchByImage(req.session.userId, mainPhoto);
      const searchResults = [
        {
          itemId: '123456789',
          title: 'Nike Air Zoom Pegasus 38 Men\'s Running Shoes',
          price: { value: '64.99', currency: 'USD' },
          category: 'Men\'s Athletic Shoes'
        }
      ];

      req.session.processingProgress = {
        ...req.session.processingProgress,
        currentStep: 'generating_content',
        stepsCompleted: 2
      };

      // 3. Generate listing content with ChatGPT
      const listingContent = await openaiService.generateListingContent(
        `${imageAnalysis}\nSimilar items found: ${searchResults.map(r => r.title).join(', ')}`,
        condition,
        conditionLevel
      );

      req.session.processingProgress = {
        ...req.session.processingProgress,
        currentStep: 'setting_price',
        stepsCompleted: 3
      };

      // 4. Determine optimal price based on similar items
      const suggestedPrice = searchResults.length > 0 
        ? searchResults[0].price.value 
        : '0.00';

      req.session.processingProgress = {
        ...req.session.processingProgress,
        currentStep: 'creating_draft',
        stepsCompleted: 4
      };

      // 5. Create a draft listing object
      const draftListing = {
        title: listingContent.title,
        description: listingContent.description,
        price: suggestedPrice,
        condition,
        conditionDescription: listingContent.conditionDescription,
        category: searchResults.length > 0 ? searchResults[0].category : '',
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
        error: error.message
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

  // Get listing details
  app.get("/api/listings/:id", isAuthenticated, async (req: Request, res: Response) => {
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
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(listing);
    } catch (error) {
      console.error("Get listing error:", error);
      res.status(500).json({ message: "Failed to get listing", error: error.message });
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
  app.post("/api/listings/:id/push-to-ebay", isAuthenticated, async (req: Request, res: Response) => {
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
        return res.status(403).json({ message: "Access denied" });
      }

      // In a real implementation, this would call ebayService.createDraftListing
      // const ebayDraftId = await ebayService.createDraftListing(req.session.userId, listing);
      const ebayDraftId = `draft-${Date.now()}`;

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
      res.status(500).json({ message: "Failed to push listing to eBay", error: error.message });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
