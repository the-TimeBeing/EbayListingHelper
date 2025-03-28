import express, { Request, Response, Express, NextFunction } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { ebayService } from "./services/ebayService";
import { openaiService } from "./services/openaiService";
import { imgbbService } from "./services/imgbbService";
import { saveBase64Image, getImageAsBase64, cleanupTempFiles, isValidBase64Image } from "./utils/fileUtils";
import { z } from "zod";
import { insertListingSchema } from "@shared/schema";
import { EbayItemSummary, EbaySoldItem } from "@shared/types";
import session from 'express-session';
import MemoryStore from 'memorystore';

// Define types for eBay listing data
interface EbayOfferPolicies {
  // Only using policy IDs as required by eBay API
  fulfillmentPolicyId?: string;
  paymentPolicyId?: string;
  returnPolicyId?: string;
}

interface EbayOffer {
  pricingSummary: {
    price: {
      value: number;
      currency: string;
    }
  };
  categoryId: string;
  listingPolicies: EbayOfferPolicies;
}

interface EbayInventoryItem {
  product: {
    title: string;
    description: string;
    imageUrls?: string[];
    aspects: Record<string, string[]>; // Removed optional to match implementation
  };
  condition: string;
  conditionDescription?: string;
  availability: {
    shipToLocationAvailability: {
      quantity: number;
    }
  };
  packageWeightAndSize?: {
    dimensions?: {
      height: number;
      length: number;
      width: number;
      unit: string;
    };
    packageType?: string;
    weight: {
      value: number;
      unit: string;
    }
  };
}

interface EbayListingData {
  inventory_item: EbayInventoryItem;
  offer: EbayOffer;
}

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
      resave: true, // Changed to true to ensure session is saved
      saveUninitialized: true, // Changed to true to ensure new sessions are saved
      cookie: {
        secure: false, // Set to false to work in all environments
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      }
    })
  );
  
  // Debug middleware to track session consistency
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Ignore static asset requests
    if (!req.path.startsWith('/api') && req.path !== '/') {
      return next();
    }
    
    // Log session data for debugging
    console.log(`Request to ${req.path} | Session ID: ${req.session.id} | User ID: ${req.session.userId || 'none'} | Has Photos: ${req.session.photos ? 'yes' : 'no'}`);
    
    // Continue processing
    next();
  });

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
    // Return the actual eBay OAuth URL
    const authUrl = ebayService.getOAuthUrl();
    res.json({ url: authUrl });
  });
  
  // Separate endpoint for test login
  app.get("/api/auth/test-login-url", (req: Request, res: Response) => {
    const testAuthUrl = "/api/auth/test-login"; // Local test auth endpoint
    res.json({ url: testAuthUrl });
  });
  
  // Test authentication endpoint with HTML page for client-side redirect
  app.get("/api/auth/test-login", async (req: Request, res: Response) => {
    try {
      // Check if we already have a test user
      let user = await storage.getUserByUsername("test_user");
      
      if (!user) {
        // Create a test user with eBay tokens if it doesn't exist
        console.log("Creating test user in storage");
        user = await storage.createUser({
          username: "test_user",
          password: "test_password",
          ebayToken: "mock-token-for-testing",
          ebayRefreshToken: "mock-refresh-token",
          ebayTokenExpiry: new Date(Date.now() + 3600 * 1000)
        });
      } else {
        // Update tokens for the existing test user
        console.log("Updating tokens for existing test user");
        user = await storage.updateUserEbayTokens(
          user.id,
          "mock-token-for-testing",
          "mock-refresh-token",
          new Date(Date.now() + 3600 * 1000)
        );
      }
      
      // Set session variables
      req.session.userId = user.id;
      req.session.ebayToken = user.ebayToken || undefined;
      req.session.ebayRefreshToken = user.ebayRefreshToken || undefined;
      req.session.ebayTokenExpiry = user.ebayTokenExpiry || undefined;
      
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
    } catch (error) {
      console.error("Test login error:", error);
      res.status(500).send("Test login failed");
    }
  });
  
  // Test authentication endpoint with redirect (for simpler client implementation)
  app.get("/api/auth/test-login-redirect", async (req: Request, res: Response) => {
    // Get the redirect target from query params or default to test page
    const redirectTarget = req.query.redirect || '/test';
    
    try {
      // Check if we already have a test user
      let user = await storage.getUserByUsername("test_user");
      
      if (!user) {
        // Create a test user with eBay tokens if it doesn't exist
        console.log("Creating test user in storage");
        user = await storage.createUser({
          username: "test_user",
          password: "test_password",
          ebayToken: "mock-token-for-testing",
          ebayRefreshToken: "mock-refresh-token",
          ebayTokenExpiry: new Date(Date.now() + 3600 * 1000)
        });
      } else {
        // Update tokens for the existing test user
        console.log("Updating tokens for existing test user");
        user = await storage.updateUserEbayTokens(
          user.id,
          "mock-token-for-testing",
          "mock-refresh-token",
          new Date(Date.now() + 3600 * 1000)
        );
      }
      
      // Set session variables
      req.session.userId = user.id;
      req.session.ebayToken = user.ebayToken || undefined;
      req.session.ebayRefreshToken = user.ebayRefreshToken || undefined;
      req.session.ebayTokenExpiry = user.ebayTokenExpiry || undefined;
      
      // Add a test flag to identify this as a test session
      req.session.isTestSession = true;
      
      console.log("Test login (redirect) successful, session:", {
        id: req.session.id,
        userId: req.session.userId,
        hasToken: !!req.session.ebayToken,
        isTestSession: req.session.isTestSession
      });
      
      // Save the session and redirect
      req.session.save((err) => {
        if (err) {
          console.error("Error saving session:", err);
          return res.status(500).send("Session error");
        }
        
        // Redirect to the specified page or test page as default
        console.log(`Redirecting to ${redirectTarget}`);
        res.redirect(redirectTarget as string);
      });
    } catch (error) {
      console.error("Test login error:", error);
      res.status(500).send("Test login failed");
    }
  });

  // Enhanced debug endpoint that can process the eBay auth code manually
  app.get("/debug-ebay-callback", async (req: Request, res: Response) => {
    console.log("Debug eBay callback route accessed with query params:", req.query);
    
    if (req.query.process && req.query.code) {
      try {
        // Extract the code from URL if a full URL was pasted
        let rawCode = req.query.code.toString();
        let code = rawCode;
        
        // First, check if this is a full URL that was pasted
        if (rawCode.includes('?code=')) {
          try {
            // Extract just the code parameter
            const urlObj = new URL(rawCode);
            const codeParam = urlObj.searchParams.get('code');
            if (codeParam) {
              code = codeParam;
              console.log(`Extracted code from URL: ${code.substring(0, 20)}...`);
            }
          } catch (parseError) {
            // If URL parsing fails, try a regex approach
            const codeMatch = rawCode.match(/[?&]code=([^&]+)/);
            if (codeMatch && codeMatch[1]) {
              code = decodeURIComponent(codeMatch[1]);
              console.log(`Extracted code using regex: ${code.substring(0, 20)}...`);
            }
          }
        }
        
        console.log(`Processing eBay OAuth code in debug mode: ${code.substring(0, 20)}...`);
        
        // Get the access token using the code
        const tokenData = await ebayService.getAccessToken(code);
        console.log("Token data received:", JSON.stringify({
          access_token: tokenData.access_token.substring(0, 10) + "...",
          expires_in: tokenData.expires_in,
          refresh_token: tokenData.refresh_token?.substring(0, 10) + "..."
        }, null, 2));
        
        // Create a test user for this debug session
        const testUser = await storage.createUser({
          username: `debug_user_${Date.now()}`,
          password: `debug_${Math.random().toString(36).substring(2, 15)}`
          // No role parameter as it's not in our schema
        });
        
        // Calculate token expiry time
        const expiryDate = new Date();
        expiryDate.setSeconds(expiryDate.getSeconds() + tokenData.expires_in);
        
        // Update the user with eBay tokens
        const updatedUser = await storage.updateUserEbayTokens(
          testUser.id,
          tokenData.access_token,
          tokenData.refresh_token,
          expiryDate
        );
        
        // Set session for the debug user
        req.session.userId = testUser.id;
        req.session.ebayToken = tokenData.access_token;
        req.session.ebayRefreshToken = tokenData.refresh_token;
        req.session.ebayTokenExpiry = expiryDate;
        
        console.log(`eBay debug authentication successful for user ${testUser.id}`);
        
        // Return a success page with details and auto-redirect
        res.send(`
          <html>
            <head>
              <title>eBay Auth Debug - Success</title>
              <meta http-equiv="refresh" content="3;url=/direct-photos">
              <style>
                body { font-family: Arial, sans-serif; padding: 2rem; line-height: 1.6; }
                h1 { color: #0064D2; }
                pre { background: #f5f5f5; padding: 1rem; border-radius: 4px; overflow: auto; }
                .success { color: green; }
                .error { color: red; }
                .token { word-break: break-all; }
                .redirect-message { margin-top: 30px; color: #666; }
                .loading { display: inline-block; width: 20px; height: 20px; border: 3px solid rgba(0,100,210,0.3); 
                           border-radius: 50%; border-top-color: #0064D2; animation: spin 1s ease-in-out infinite; }
                @keyframes spin { to { transform: rotate(360deg); } }
              </style>
            </head>
            <body>
              <h1>eBay OAuth Debug - SUCCESS!</h1>
              <p class="success">✅ Authentication completed successfully</p>
              
              <h2>Authentication Details:</h2>
              <ul>
                <li>Debug User ID: ${testUser.id}</li>
                <li>Token Expires: ${expiryDate.toLocaleString()}</li>
                <li>Access Token: <span class="token">${tokenData.access_token.substring(0, 20)}...</span></li>
              </ul>
              
              <h2>What happened?</h2>
              <ol>
                <li>Received eBay authorization code</li>
                <li>Successfully exchanged it for an access token</li>
                <li>Created a debug user and stored the tokens</li>
                <li>Set up your session with valid eBay credentials</li>
              </ol>
              
              <div class="redirect-message">
                <p>Redirecting you to the photo upload page <span class="loading"></span></p>
                <p>If you are not redirected automatically, <a href="/direct-photos">click here</a>.</p>
              </div>
            </body>
          </html>
        `);
      } catch (error) {
        console.error("eBay debug auth error:", error);
        res.send(`
          <html>
            <head>
              <title>eBay Auth Debug - Error</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 2rem; line-height: 1.6; }
                h1 { color: #FF4040; }
                pre { background: #f5f5f5; padding: 1rem; border-radius: 4px; overflow: auto; }
                .error { color: red; }
                .code { font-family: monospace; background: #f5f5f5; padding: 5px; border-radius: 3px; }
              </style>
            </head>
            <body>
              <h1>eBay OAuth Debug - ERROR</h1>
              <p class="error">❌ Authentication failed</p>
              
              <h2>Error Details:</h2>
              <pre>${error instanceof Error ? error.message : String(error)}</pre>
              
              <h2>What went wrong?</h2>
              <p>We received your authorization code but encountered an error when trying to exchange it for an access token.</p>
              <p>This could be due to:</p>
              <ul>
                <li>The code has expired (they are only valid for a short time)</li>
                <li>The redirect URI in the eBay Developer Portal doesn't match what we're using</li>
                <li>API credentials are incorrect</li>
              </ul>
              
              <h2>Try using the test login:</h2>
              <p><a href="/api/auth/test-login">Use Test Login Instead</a></p>
            </body>
          </html>
        `);
      }
      return;
    }
    
    // Show a debug form that allows testing code processing
    res.send(`
      <html>
        <head>
          <title>eBay Auth Debug</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 2rem; line-height: 1.6; max-width: 800px; margin: 0 auto; }
            h1 { color: #0064D2; }
            pre { background: #f5f5f5; padding: 1rem; border-radius: 4px; overflow: auto; max-height: 200px; }
            .success { color: green; }
            .error { color: red; }
            .warning { color: orange; }
            .form-group { margin-bottom: 1rem; }
            label { display: block; margin-bottom: 0.5rem; font-weight: bold; }
            input[type="text"] { width: 100%; padding: 0.5rem; font-family: monospace; }
            button { background: #0064D2; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; }
            .card { border: 1px solid #ddd; border-radius: 8px; padding: 1.5rem; margin-bottom: 2rem; }
          </style>
        </head>
        <body>
          <h1>eBay OAuth Debug Tool</h1>
          <p>This page helps diagnose and fix eBay authentication issues.</p>
          
          <div class="card">
            <h2>Current Query Parameters:</h2>
            <pre>${JSON.stringify(req.query, null, 2)}</pre>
            
            <div>
              ${req.query.code 
                ? `<p class="success">✅ Authorization code received: ${req.query.code.toString().substring(0, 20)}...</p>` 
                : `<p class="error">❌ No authorization code in the request</p>`}
            </div>
          </div>
          
          ${req.query.code ? `
            <div class="card">
              <h2>Process This Code</h2>
              <p>You have a valid authorization code in the URL. Click below to process it and complete authentication:</p>
              <a href="/debug-ebay-callback?process=true&code=${encodeURIComponent(req.query.code.toString())}">
                <button>Process Authorization Code</button>
              </a>
            </div>
          ` : ''}
          
          <div class="card">
            <h2>Manual Code Entry</h2>
            <p>Paste <strong>either the code OR the full URL</strong> from eBay's redirect. We'll extract the code automatically.</p>
            <div style="background: #f8f8f8; padding: 10px; border-left: 3px solid #0064D2; margin-bottom: 15px;">
              <p style="margin: 0; font-size: 0.9rem;">
                <strong>Example #1:</strong> Just the code: <code style="word-break: break-all; background: #eee; padding: 2px 4px;">v^1.1#i^1#r^1#p^3#f^0#I^3#t^Ul41XzY...</code>
              </p>
              <p style="margin: 5px 0 0; font-size: 0.9rem;">
                <strong>Example #2:</strong> Full URL: <code style="word-break: break-all; background: #eee; padding: 2px 4px;">https://ai-powered-ebay-listing-assistant.replit.app/?code=v%5E1.1%23i...</code>
              </p>
            </div>
            <form action="/debug-ebay-callback" method="get">
              <div class="form-group">
                <label for="code">eBay Authorization Code or Redirect URL:</label>
                <input type="text" id="code" name="code" placeholder="Paste the code or URL here...">
              </div>
              <input type="hidden" name="process" value="true">
              <button type="submit">Process Code</button>
            </form>
          </div>
          
          <div class="card">
            <h2>Skip eBay Auth</h2>
            <p class="warning">⚠️ If you can't get eBay authentication working, use our test login instead:</p>
            <p><a href="/api/auth/test-login"><button>Use Test Login</button></a></p>
          </div>
          
          <p>Return to <a href="/">home page</a></p>
        </body>
      </html>
    `);
  });

  // Handle eBay authentication on the default callback and API route for flexibility
  app.get("/", async (req: Request, res: Response, next: NextFunction) => {
    // Log all query parameters for debugging
    console.log("Root path accessed with query params:", req.query);
    
    // Check if this is an eBay OAuth callback with authorization code
    if (req.query.code) {
      try {
        const { code } = req.query;
        
        if (!code || typeof code !== 'string') {
          throw new Error("Invalid authorization code");
        }

        console.log(`Processing eBay auth code directly: ${code.substring(0, 20)}...`);
        
        // Get the access token using the code
        const tokenData = await ebayService.getAccessToken(code);
        console.log("eBay token received, setting up user session");
        
        // Generate a random username for first-time users
        let userId = 0;
        let user;
        
        // Create or find the user with these tokens
        if (!req.session.userId) {
          // This is a new user, create one with the eBay tokens
          const username = `ebay_user_${Date.now()}`;
          const insertUser = {
            username: username,
            // A password is required by our schema, but we won't use it for eBay auth
            password: `ebay_pass_${Math.random().toString(36).substring(2, 15)}`, 
            ebayToken: tokenData.access_token,
            ebayRefreshToken: tokenData.refresh_token,
            ebayTokenExpiry: new Date(Date.now() + tokenData.expires_in * 1000)
          };
          
          user = await storage.createUser(insertUser);
          userId = user.id;
          console.log(`Created new user: ${username} with ID: ${userId}`);
        } else {
          // Existing user, update their tokens
          userId = req.session.userId;
          user = await storage.updateUserEbayTokens(
            userId,
            tokenData.access_token,
            tokenData.refresh_token,
            new Date(Date.now() + tokenData.expires_in * 1000)
          );
          console.log(`Updated eBay tokens for existing user ID: ${userId}`);
        }
        
        // Set the tokens in the session for immediate use
        req.session.userId = userId;
        req.session.ebayToken = tokenData.access_token;
        req.session.ebayRefreshToken = tokenData.refresh_token;
        req.session.ebayTokenExpiry = new Date(Date.now() + tokenData.expires_in * 1000);
        
        // Explicitly save the session to ensure persistence
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error("Error saving session after eBay auth:", saveErr);
            return res.status(500).send("Error saving session after authentication");
          }
          
          console.log("eBay auth successful, session saved:", { userId });
          // Direct to photo upload page
          return res.redirect('/direct-photos');
        });
        
      } catch (error) {
        console.error("eBay auth processing error:", error);
        res.status(500).json({ message: "Authentication failed", error: error instanceof Error ? error.message : String(error) });
      }
      return; // Important to stop further processing
    }
    
    // Not an OAuth callback, let the request pass through to the client app
    next();
  });
  
  // Also keep the API route for compatibility
  app.get("/api/auth/ebay/callback", async (req: Request, res: Response) => {
    try {
      const { code } = req.query;
      
      if (!code || typeof code !== 'string') {
        throw new Error("Invalid authorization code");
      }

      // Get eBay OAuth tokens
      const tokenData = await ebayService.getAccessToken(code);
      
      // Generate a random username for first-time users
      let userId = 0;
      let user;
      
      // Create or find the user with these tokens
      if (!req.session.userId) {
        // This is a new user, create one with the eBay tokens
        const username = `ebay_user_${Date.now()}`;
        const insertUser = {
          username: username,
          // A fake password is required by our schema, but we won't use it for eBay auth
          password: `ebay_pass_${Math.random().toString(36).substring(2, 15)}`, 
          ebayToken: tokenData.access_token,
          ebayRefreshToken: tokenData.refresh_token,
          ebayTokenExpiry: new Date(Date.now() + tokenData.expires_in * 1000)
        };
        
        user = await storage.createUser(insertUser);
        userId = user.id;
        console.log(`Created new user: ${username} with ID: ${userId}`);
      } else {
        // Existing user, update their tokens
        userId = req.session.userId;
        user = await storage.getUser(userId);
        
        if (!user) {
          throw new Error("User not found");
        }
        
        user = await storage.updateUserEbayTokens(
          userId,
          tokenData.access_token,
          tokenData.refresh_token,
          new Date(Date.now() + tokenData.expires_in * 1000)
        );
        
        console.log(`Updated tokens for user ID: ${userId}`);
      }
      
      // Store everything in the session
      req.session.userId = userId;
      req.session.ebayToken = tokenData.access_token;
      req.session.ebayRefreshToken = tokenData.refresh_token;
      req.session.ebayTokenExpiry = new Date(Date.now() + tokenData.expires_in * 1000);

      // Save the session explicitly
      req.session.save((err) => {
        if (err) {
          console.error("Error saving session:", err);
          return res.status(500).send("Session error");
        }
        
        // Instead of redirecting, serve a success page with a meta refresh to photos
        res.send(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>eBay Authentication Successful</title>
              <meta http-equiv="refresh" content="3;url=/photos?auth=1">
              <style>
                body { font-family: Arial, sans-serif; text-align: center; padding-top: 50px; line-height: 1.6; }
                h1 { color: #0064D2; }
                .success-icon { font-size: 48px; color: green; margin: 20px 0; }
                .container { max-width: 600px; margin: 0 auto; }
                .redirect-message { margin-top: 30px; color: #666; }
                .loading { display: inline-block; width: 20px; height: 20px; border: 3px solid rgba(0,100,210,0.3); 
                           border-radius: 50%; border-top-color: #0064D2; animation: spin 1s ease-in-out infinite; }
                @keyframes spin { to { transform: rotate(360deg); } }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>eBay Authentication Successful!</h1>
                <div class="success-icon">✅</div>
                <p>You have successfully authenticated with eBay.</p>
                <p>Your account has been connected and you can now create listings.</p>
                <div class="redirect-message">
                  <p>Redirecting to the photo upload page <span class="loading"></span></p>
                  <p>If you are not redirected automatically, <a href="/photos?auth=1">click here</a>.</p>
                </div>
              </div>
            </body>
          </html>
        `);
      });
    } catch (error) {
      console.error("eBay auth error:", error);
      res.status(500).json({ message: "Authentication failed", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // New endpoint to process eBay OAuth code from the client-side success page
  app.post("/api/auth/ebay/process-code", async (req: Request, res: Response) => {
    try {
      const { code } = req.body;
      
      if (!code) {
        return res.status(400).json({ message: "Missing authorization code" });
      }
      
      console.log(`Processing eBay OAuth code: ${code.substring(0, 20)}...`);
      
      // Get the access token using the code
      const tokenData = await ebayService.getAccessToken(code);
      
      // Create or update the user record
      // This endpoint can be used without a login, so we'll create a temporary user
      let userId: number;
      
      if (req.session.userId) {
        // Update existing user
        userId = req.session.userId;
        console.log(`Updating existing user ${userId} with eBay tokens`);
      } else {
        // Create new user with temporary credentials
        const tempUsername = `ebay_user_${Date.now()}`;
        const tempPassword = `temp_${Math.random().toString(36).substring(2, 15)}`;
        
        console.log(`Creating temporary user ${tempUsername} for eBay auth`);
        
        const newUser = await storage.createUser({
          username: tempUsername,
          password: tempPassword
          // No role parameter as it's not part of our schema
        });
        
        userId = newUser.id;
        req.session.userId = userId;
        req.session.user = newUser;
      }
      
      // Calculate token expiry time
      const expiryDate = new Date();
      expiryDate.setSeconds(expiryDate.getSeconds() + tokenData.expires_in);
      
      // Update the user with eBay tokens
      const updatedUser = await storage.updateUserEbayTokens(
        userId,
        tokenData.access_token,
        tokenData.refresh_token,
        expiryDate
      );
      
      // Update session with token data
      req.session.ebayToken = tokenData.access_token;
      req.session.ebayRefreshToken = tokenData.refresh_token;
      req.session.ebayTokenExpiry = expiryDate;
      
      console.log(`eBay authentication successful for user ${userId}`);
      res.status(200).json({ success: true });
      
    } catch (error) {
      console.error("Error processing eBay OAuth code:", error);
      res.status(500).json({ 
        message: "Failed to process eBay authentication",
        error: error instanceof Error ? error.message : String(error) 
      });
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
      console.log("Created default user ID for photo upload:", req.session.userId);
    }
    
    try {
      const { photos } = req.body;
      
      console.log("Photo upload request received. Photos array:", photos ? `Array with ${photos.length} items` : "undefined");
      
      if (!photos || !Array.isArray(photos) || photos.length === 0) {
        console.log("Photo upload validation failed: No photos provided");
        return res.status(400).json({ message: "No photos provided" });
      }

      // Debug session before setting photos
      console.log("Session before photo update - ID:", req.session.id, "User ID:", req.session.userId);

      // Validate that all items are valid base64 images
      for (const photo of photos) {
        if (!isValidBase64Image(photo)) {
          return res.status(400).json({ message: "Invalid base64 image data" });
        }
      }

      // Store photos directly in the session
      req.session.photos = photos;
      
      // Set a flag to indicate this session has photos
      req.session.hasUploadedPhotos = true;
      
      // Create a more structured initial progress state
      req.session.processingProgress = {
        status: 'waiting',
        currentStep: 'waiting_for_generation',
        stepsCompleted: 0,
        totalSteps: 5
      };
      
      // Save the session explicitly to ensure data persistence
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error("Error saving session with photos:", saveErr);
          return res.status(500).json({ message: "Failed to save photos to session" });
        }
        
        const photoSizes = photos.map(p => Math.round(p.length / 1024));
        console.log("Photos successfully saved to session:", {
          count: photos.length, 
          sessionId: req.session.id,
          userId: req.session.userId,
          photoSizes: photoSizes, // Size in KB for each photo
          totalSize: photoSizes.reduce((a, b) => a + b, 0), // Total size in KB
        });
        
        // Return immediately with the photos count and session ID for client-side tracking
        res.json({
          message: "Photos uploaded successfully",
          count: photos.length,
          sessionId: req.session.id
        });
      });
    } catch (error) {
      console.error("Base64 photo upload error:", error);
      res.status(500).json({ 
        message: "Failed to upload photos", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Listing generation endpoint
  app.post("/api/listings/generate", async (req: Request, res: Response) => {
    // Check for authentication, but don't redirect or block - just set user ID if missing
    if (!req.session.userId) {
      req.session.userId = 1; // Set default user ID for test mode
      console.log("Created default user ID for listing generation:", req.session.userId);
    }
    
    try {
      const { condition, conditionLevel, sessionId } = req.body;
      
      console.log("Generate endpoint - Session state:", {
        id: req.session.id,
        clientSessionId: sessionId || 'not provided',
        userId: req.session.userId,
        hasPhotos: !!req.session.photos,
        photoCount: req.session.photos?.length,
        photoTypes: req.session.photos ? req.session.photos.map(p => typeof p) : [],
        firstPhotoPreview: req.session.photos && req.session.photos.length > 0 ? req.session.photos[0].substring(0, 50) : 'none'
      });
      
      // If the client sent a session ID and it doesn't match the current one,
      // we might have a session mismatch issue
      if (sessionId && sessionId !== req.session.id) {
        console.warn(`Session ID mismatch: Client sent ${sessionId}, but current session is ${req.session.id}`);
      }
      
      if (!condition || !conditionLevel) {
        return res.status(400).json({ message: "Condition information is required" });
      }

      // More detailed photo validation
      if (!req.session.photos) {
        return res.status(400).json({ message: "No photos in session" });
      }
      
      if (!Array.isArray(req.session.photos)) {
        return res.status(400).json({ message: "Photos must be an array" });
      }
      
      if (req.session.photos.length === 0) {
        return res.status(400).json({ message: "Photos array is empty" });
      }

      // Validate that photos are base64 strings
      const validPhotos = req.session.photos.every(photo => 
        typeof photo === 'string' && photo.startsWith('data:image/')
      );
      
      if (!validPhotos) {
        return res.status(400).json({ message: "Invalid photo format" });
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
      let templateItemDetails: any = null;
      
      try {
        console.log("Searching eBay by image...");
        imageSearchResults = await ebayService.searchByImage(req.session.userId, mainPhoto);
        console.log(`Found ${imageSearchResults.length} similar items through eBay image search`);
        
        if (imageSearchResults.length > 0) {
          // Store the first search result for reference as our template
          const templateItem = imageSearchResults[0];
          console.log("Using this item as template:", JSON.stringify(templateItem, null, 2));
          
          // Get full item details for the template item
          if (templateItem.itemId) {
            try {
              templateItemDetails = await ebayService.getItemDetails(req.session.userId, templateItem.itemId);
              console.log("Got template item details:", JSON.stringify(templateItemDetails, null, 2));
              
              // Store the template details in the session for later use
              req.session.templateItemDetails = templateItemDetails;
            } catch (detailsError) {
              console.error("Failed to get template item details:", detailsError);
            }
          }
          
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
      
      // Convert template item specifics to our format
      const formattedItemSpecifics: Record<string, string>[] = [];
      
      // Check if we have template item details to extract specifics from
      if (req.session.templateItemDetails) {
        const templateItem = req.session.templateItemDetails;
        
        // Extract item specifics if available from template
        if (templateItem.itemSpecifics && Array.isArray(templateItem.itemSpecifics)) {
          console.log("Using item specifics from template item");
          
          templateItem.itemSpecifics.forEach((spec: any) => {
            if (spec && spec.name && spec.values && Array.isArray(spec.values) && spec.values.length > 0) {
              // Format as our expected object structure with key-value pairs
              formattedItemSpecifics.push({ [spec.name]: spec.values[0] });
            }
          });
        } else if (templateItem.aspects) {
          console.log("Using aspects from template item");
          
          // Convert aspects format to our item specifics format
          Object.entries(templateItem.aspects).forEach(([name, values]: [string, any]) => {
            if (Array.isArray(values) && values.length > 0) {
              formattedItemSpecifics.push({ [name]: values[0] });
            }
          });
        }
      }
      
      // Always ensure some basic item specifics are present
      // Check if we already have Brand in our specifics
      if (!formattedItemSpecifics.some(spec => Object.keys(spec)[0] === "Brand") && 
          listingContent.title.toLowerCase().includes("nintendo")) {
        formattedItemSpecifics.push({ "Brand": "Nintendo" });
      }
      
      // Check if we already have Platform in our specifics
      if (!formattedItemSpecifics.some(spec => Object.keys(spec)[0] === "Platform") && 
          listingContent.title.toLowerCase().includes("switch")) {
        formattedItemSpecifics.push({ "Platform": "Nintendo Switch" });
      }
      
      // Always include MPN if not already present
      if (!formattedItemSpecifics.some(spec => Object.keys(spec)[0] === "MPN")) {
        formattedItemSpecifics.push({ "MPN": "Does Not Apply" });
      }
      
      console.log("Using formatted item specifics:", JSON.stringify(formattedItemSpecifics, null, 2));
      
      const draftListing = {
        title: listingContent.title,
        description: listingContent.description,
        price: suggestedPrice,
        condition,
        conditionDescription: listingContent.conditionDescription,
        category: categoryName,
        itemSpecifics: formattedItemSpecifics,
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
      
      // Explicitly save the session to ensure the ID is persisted
      req.session.save((err) => {
        if (err) {
          console.error("Error saving session after listing creation:", err);
        } else {
          console.log(`Listing ${listing.id} successfully created and saved to session for user ${req.session.userId}`);
        }
        
        res.json({
          success: true,
          listingId: listing.id
        });
      });
    } catch (error) {
      console.error("Listing generation error:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        step: req.session.processingProgress?.currentStep,
        userId: req.session.userId,
        hasPhotos: !!req.session.photos,
        photoCount: req.session.photos?.length
      });
      
      req.session.processingProgress = {
        status: 'error',
        currentStep: 'error',
        stepsCompleted: 0,
        totalSteps: 5,
        error: error instanceof Error ? error.message : String(error)
      };
      
      res.status(500).json({ 
        message: "Failed to generate listing",
        error: error instanceof Error ? error.message : String(error),
        step: req.session.processingProgress?.currentStep
      });
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
      console.log("[LAST LISTING] Setting default user ID to 1");
    }
    
    console.log("[LAST LISTING] Checking for last generated listing for user:", req.session.userId);
    console.log("[LAST LISTING] Session data:", { 
      userId: req.session.userId,
      lastGeneratedListingId: req.session.lastGeneratedListingId || 'not set'
    });
    
    try {
      if (!req.session.lastGeneratedListingId) {
        console.log("[LAST LISTING] No lastGeneratedListingId in session");
        
        // As a fallback, try to get the most recent listing for this user
        const allListings = await storage.getListingsByUserId(req.session.userId);
        console.log(`[LAST LISTING] Found ${allListings.length} listings for user ${req.session.userId}`);
        
        if (allListings.length > 0) {
          // Sort by creation date descending and take the first one
          const sortedListings = [...allListings].sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
            const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
            return dateB.getTime() - dateA.getTime();
          });
          
          console.log("[LAST LISTING] Returning most recent listing as fallback:", sortedListings[0].id);
          return res.json(sortedListings[0]);
        }
        
        return res.status(404).json({ message: "No recent listing found" });
      }

      console.log(`[LAST LISTING] Looking up listing with ID: ${req.session.lastGeneratedListingId}`);
      const listing = await storage.getListing(req.session.lastGeneratedListingId);
      
      if (!listing) {
        console.log(`[LAST LISTING] Listing ${req.session.lastGeneratedListingId} not found`);
        return res.status(404).json({ message: "Listing not found" });
      }

      console.log(`[LAST LISTING] Successfully found listing ${listing.id}`);
      res.json(listing);
    } catch (error) {
      console.error("Get last listing error:", error);
      res.status(500).json({ 
        message: "Failed to get listing", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Push listing to eBay as draft
  app.post("/api/listings/:id/push-to-ebay", async (req: Request, res: Response) => {
    console.log(`Push to eBay request for listing ID ${req.params.id}`);
    
    // For test sessions or if no userId is present, set a default
    if (!req.session.userId) {
      console.log("No user ID in session, defaulting to test user");
      req.session.userId = 1; // Default test user ID
    }
    
    try {
      const listingId = parseInt(req.params.id);
      
      if (isNaN(listingId)) {
        return res.status(400).json({ message: "Invalid listing ID" });
      }

      console.log(`Looking up listing with ID: ${listingId}`);
      const listing = await storage.getListing(listingId);
      
      if (!listing) {
        console.log(`Listing with ID ${listingId} not found`);
        return res.status(404).json({ message: "Listing not found" });
      }

      // Allow the owner to access their listing, with more flexible checking in test mode
      const isTestMode = !!req.session.isTestSession;
      const isOwner = listing.userId === req.session.userId;
      
      if (!isOwner && !isTestMode) {
        console.log(`Access denied: Listing belongs to user ${listing.userId}, but current user is ${req.session.userId}`);
        return res.status(403).json({ message: "Access denied" });
      }

      console.log(`Attempting to push listing ${listingId} to eBay for user ${req.session.userId}`);
      
      // Check if we have all required data for an eBay listing
      if (!listing.title || !listing.description || !listing.price || !listing.condition) {
        console.log("Listing is missing required fields:", {
          hasTitle: !!listing.title,
          hasDescription: !!listing.description,
          hasPrice: !!listing.price,
          hasCondition: !!listing.condition
        });
        return res.status(400).json({ message: "Listing is missing required fields" });
      }
      
      // Access the template item details if available
      const templateItem = req.session.templateItemDetails;
      console.log("Template item details available:", !!templateItem);
      
      // Get specific template data for use in our listing
      let templateCategoryId = "139971"; // Default to Video Game Accessories
      let templateItemSpecifics: Record<string, string[]> = {};
      let templateShippingPolicy: any = null;
      let templatePaymentPolicy: any = null;
      let templateReturnPolicy: any = null;
      
      if (templateItem) {
        console.log("Using template item data for category and item specifics");
        
        // Extract category ID if available
        if (templateItem.categoryId) {
          templateCategoryId = templateItem.categoryId;
          console.log(`Using template category ID: ${templateCategoryId}`);
        } else if (templateItem.categories && templateItem.categories[0] && templateItem.categories[0].categoryId) {
          templateCategoryId = templateItem.categories[0].categoryId;
          console.log(`Using template category ID from categories array: ${templateCategoryId}`);
        }
        
        // Extract item specifics if available
        if (templateItem.itemSpecifics && Array.isArray(templateItem.itemSpecifics)) {
          console.log("Template item has item specifics:", templateItem.itemSpecifics.length);
          templateItem.itemSpecifics.forEach((spec: any) => {
            if (spec && spec.name && spec.values && Array.isArray(spec.values)) {
              templateItemSpecifics[spec.name] = spec.values;
            }
          });
        } else if (templateItem.aspects) {
          console.log("Template item has aspects:", Object.keys(templateItem.aspects).length);
          templateItemSpecifics = templateItem.aspects;
        }
        
        // Extract policies if available
        if (templateItem.shippingOptions) {
          templateShippingPolicy = templateItem.shippingOptions;
        }
        
        if (templateItem.paymentMethods) {
          templatePaymentPolicy = {
            paymentMethod: templateItem.paymentMethods[0] || "PAYPAL"
          };
        }
        
        if (templateItem.returnTerms) {
          templateReturnPolicy = templateItem.returnTerms;
        }
      }
      
      // Format the data as eBay API expects it according to the format:
      // { "Feature": ["Value1", "Value2"], "Brand": ["Samsung"] }
      let aspectsObject: Record<string, string[]> = {
        ...templateItemSpecifics
        // Don't add condition to aspects - eBay expects condition in a separate field
      };
      
      // Only process our item specifics if it's a valid array
      if (Array.isArray(listing.itemSpecifics) && listing.itemSpecifics.length > 0) {
        listing.itemSpecifics.forEach(spec => {
          if (typeof spec === 'object' && spec !== null) {
            const keys = Object.keys(spec);
            if (keys.length > 0) {
              const key = keys[0];
              const value = spec[key];
              if (value) {
                // Always ensure the value is an array of strings
                if (Array.isArray(value)) {
                  aspectsObject[key] = value.map(v => v.toString());
                } else {
                  aspectsObject[key] = [value.toString()];
                }
              }
            }
          }
        });
      }
      
      // Make sure we have some required item specifics even if not in the template
      if (!aspectsObject["Brand"] && listing.title.toLowerCase().includes("nintendo")) {
        aspectsObject["Brand"] = ["Nintendo"];
      }
      
      if (!aspectsObject["Platform"] && listing.title.toLowerCase().includes("switch")) {
        aspectsObject["Platform"] = ["Nintendo Switch"];
      }
      
      if (!aspectsObject["MPN"]) {
        aspectsObject["MPN"] = ["Does Not Apply"];
      }
      
      console.log("Final aspects object:", JSON.stringify(aspectsObject, null, 2));
      
      // Map the condition string to eBay's expected condition enum format
      let ebayCondition = "NEW"; // Default to NEW
      
      // Map our condition strings to eBay condition enum values
      const conditionMap: Record<string, string> = {
        // Standard eBay condition mapping
        "New": "NEW",
        "New with tags": "NEW_WITH_TAGS",
        "New without tags": "NEW_WITHOUT_TAGS",
        "New with defects": "NEW_WITH_DEFECTS",
        "Used - Excellent": "LIKE_NEW",
        "Used - Very Good": "VERY_GOOD",
        "Used - Good": "GOOD",
        "Used - Acceptable": "ACCEPTABLE",
        
        // Additional mappings for our frontend conditions (from constants.ts)
        "Like New": "LIKE_NEW",
        "Used - Fair": "ACCEPTABLE", // Map Fair to ACCEPTABLE as it's closest
        "Used - Poor": "FOR_PARTS_OR_NOT_WORKING", // Map Poor to FOR_PARTS_OR_NOT_WORKING
        
        // Fallback mapping
        "For parts or not working": "FOR_PARTS_OR_NOT_WORKING"
      };
      
      if (listing.condition && conditionMap[listing.condition]) {
        ebayCondition = conditionMap[listing.condition];
      }
      
      console.log(`Mapping condition "${listing.condition}" to eBay condition enum: "${ebayCondition}"`);
      
      // Prepare the core listing data with template values where possible
      const ebayListingData: EbayListingData = {
        inventory_item: {
          product: {
            title: listing.title,
            description: listing.description,
            aspects: aspectsObject, // This is already in the correct format: { "Feature": ["Value1", "Value2"] }
            imageUrls: Array.isArray(listing.images) ? listing.images : []
          },
          condition: ebayCondition,
          conditionDescription: listing.conditionDescription || "",
          availability: {
            shipToLocationAvailability: {
              quantity: 1  // Setting to 1 as requested
            }
          },
          packageWeightAndSize: {
            dimensions: {
              height: 5,
              length: 10,
              width: 15,
              unit: "INCH"
            },
            packageType: "MAILING_BOX",
            weight: {
              value: 2,
              unit: "POUND"
            }
          }
        },
        offer: {
          pricingSummary: {
            price: {
              value: parseFloat(listing.price),
              currency: "USD"
            }
          },
          categoryId: templateCategoryId, // Use category ID from template
          listingPolicies: {} // Will be populated with policy IDs later
        }
      };
      
      // Get the seller's actual policy IDs from their eBay account
      try {
        console.log("Retrieving seller's eBay policy IDs");
        const policies = await ebayService.getSellerPolicies(req.session.userId as number);
        
        // Initialize the listingPolicies object with policy IDs
        ebayListingData.offer.listingPolicies = {};
        
        // Add each policy ID if available
        if (policies.fulfillmentPolicyId) {
          ebayListingData.offer.listingPolicies.fulfillmentPolicyId = policies.fulfillmentPolicyId;
        }
        if (policies.paymentPolicyId) {
          ebayListingData.offer.listingPolicies.paymentPolicyId = policies.paymentPolicyId;
        }
        if (policies.returnPolicyId) {
          ebayListingData.offer.listingPolicies.returnPolicyId = policies.returnPolicyId;
        }
        
        console.log("Using seller's eBay policy IDs:", JSON.stringify({
          fulfillmentPolicyId: policies.fulfillmentPolicyId || "missing",
          paymentPolicyId: policies.paymentPolicyId || "missing",
          returnPolicyId: policies.returnPolicyId || "missing"
        }));
      } catch (policyError) {
        console.error("Failed to retrieve seller's eBay policy IDs:", policyError);
        
        // Fallback to placeholder IDs for testing only - these will NOT work in production!
        console.warn("Using placeholder policy IDs - this will likely fail for real listings");
        ebayListingData.offer.listingPolicies = {
          fulfillmentPolicyId: "default-fulfillment-policy",
          paymentPolicyId: "default-payment-policy",
          returnPolicyId: "default-return-policy"
        };
      }
      
      // Process images - convert base64 encoded images to URLs for eBay
      // eBay requires image URLs, not base64 encoded data
      let processedImageUrls = [];
      
      if (Array.isArray(ebayListingData.inventory_item.product.imageUrls)) {
        // Process each image URL
        const uploadPromises = ebayListingData.inventory_item.product.imageUrls.map(async (url) => {
          // Check if the URL is a base64 encoded image
          const isBase64 = url.startsWith('data:image/');
          
          if (isBase64) {
            try {
              console.log("Converting base64 image to URL using ImgBB service");
              // Upload the base64 image to ImgBB and get a URL
              const imageUrl = await imgbbService.uploadImage(url);
              console.log("Successfully converted base64 to URL:", imageUrl);
              return imageUrl;
            } catch (error) {
              console.error("Failed to upload image to ImgBB:", error);
              return null; // Return null for failed uploads
            }
          } else {
            // If it's already a URL, return it as is
            return url;
          }
        });
        
        // Wait for all image uploads to complete
        const results = await Promise.all(uploadPromises);
        
        // Filter out any null values (failed uploads)
        processedImageUrls = results.filter((url: string | null) => url !== null) as string[];
        
        // If we have no valid images after processing, add a placeholder
        if (processedImageUrls.length === 0) {
          console.log("No valid image URLs found. Using a placeholder image.");
          processedImageUrls = ["https://ir.ebaystatic.com/pictures/aw/pics/stockimage1.jpg"];
        }
        
        // Update the image URLs
        ebayListingData.inventory_item.product.imageUrls = processedImageUrls;
        console.log(`Successfully processed ${processedImageUrls.length} images for eBay listing`);
      }
      
      console.log(`Final listing data with ${processedImageUrls.length} valid images:`, 
        JSON.stringify(ebayListingData, null, 2));
      
      // Create an eBay draft ID (mock in test mode, real in production)
      let ebayDraftId: string;
      if (isTestMode) {
        // Generate a mock eBay draft ID for testing
        ebayDraftId = `test-draft-${Date.now()}`;
        console.log(`TEST MODE: Created mock eBay draft ID: ${ebayDraftId}`);
      } else {
        // Call the actual eBay API in production mode
        try {
          // Save the raw request JSON for debugging before sending to eBay
          const requestJson = JSON.stringify(ebayListingData, null, 2);
          console.log("About to send to eBay API:", requestJson);
          
          ebayDraftId = await ebayService.createDraftListing(req.session.userId, ebayListingData);
          console.log(`Successfully created eBay draft listing with ID: ${ebayDraftId}`);
        } catch (error) {
          console.error("Error creating eBay draft listing:", error);
          // Include the request JSON in the error message
          const errorMessage = `Error creating eBay listing. Request data: ${JSON.stringify(ebayListingData, null, 2)}. Error: ${error instanceof Error ? error.message : String(error)}`;
          
          // We'll still create a listing in case of error, but with a detailed error message
          ebayDraftId = `error-draft-${Date.now()}`;
          console.log(`Error creating eBay draft, using fallback ID: ${ebayDraftId}`);
          
          // Return the error with the full request JSON data
          return res.status(500).json({ 
            message: "Failed to push listing to eBay", 
            error: `Error: ${error instanceof Error ? error.message : String(error)}\n\nComplete request JSON sent to eBay API:\n${JSON.stringify(ebayListingData, null, 2)}`,
            requestData: ebayListingData
          });
        }
      }

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
      
      // Get the listing ID from request parameters
      const listingIdParam = req.params.id;
      const numericListingId = parseInt(listingIdParam);
      
      // Capture any available request data to include in the error
      let requestData: Record<string, any> = { 
        listingId: !isNaN(numericListingId) ? numericListingId : listingIdParam 
      };
      
      try {
        // Only attempt retrieval if we have a valid ID
        if (!isNaN(numericListingId)) {
          // Attempt to retrieve the listing again to include its data in the error
          const errorListing = await storage.getListing(numericListingId);
          if (errorListing) {
            requestData = {
              ...requestData,
              title: errorListing.title,
              condition: errorListing.condition,
              price: errorListing.price,
              description: errorListing.description ? errorListing.description.substring(0, 100) + "..." : null,
              images: Array.isArray(errorListing.images) ? errorListing.images.length : 0
            };
          }
        }
      } catch (dataError) {
        // If we can't get the listing data, just continue with the basics
        console.error("Failed to include listing data in error:", dataError);
      }
      
      res.status(500).json({ 
        message: "Failed to push listing to eBay", 
        error: `Error: ${error instanceof Error ? error.message : String(error)}\n\nListing data: ${JSON.stringify(requestData, null, 2)}`,
        requestData
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
