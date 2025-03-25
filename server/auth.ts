import { Request, Response, NextFunction, Express } from "express";
import { storage } from "./storage";
import { ebayService } from "./services/ebayService";

// Authentication middleware 
export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.session && req.session.userId) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};

// eBay authentication endpoints
export function setupEbayAuth(app: Express) {
  // Get eBay auth URL
  app.get("/api/auth/ebay/url", (req: Request, res: Response) => {
    const authUrl = ebayService.getOAuthUrl();
    console.log("Providing eBay auth URL to client:", authUrl);
    res.json({ url: authUrl });
  });
  
  // Handle the direct-photos route for eBay OAuth callbacks
  app.get("/direct-photos", (req: Request, res: Response, next: NextFunction) => {
    console.log("Direct photos path accessed with query params:", req.query);
    
    // If there's no code, just continue to the normal React app which will handle the route
    next();
  });

  // eBay OAuth callback handler
  app.get("/ebay-oauth/callback", async (req: Request, res: Response) => {
    console.log("[FIXED REDIRECT ROUTE] eBay OAuth callback received with query params:", req.query);
    
    try {
      if (!req.query.code || typeof req.query.code !== 'string') {
        throw new Error("No valid authorization code provided");
      }
      
      const code = req.query.code;
      console.log("[FIXED REDIRECT ROUTE] Processing eBay authorization code");
      
      // Exchange the code for access tokens
      const tokenData = await ebayService.getAccessToken(code);
      console.log("[FIXED REDIRECT ROUTE] Successfully received tokens from eBay");
      
      // Create a debug user or use existing session user
      let user;
      
      if (!req.session.userId) {
        // Create new debug user
        user = await storage.createUser({
          username: `ebay_oauth_user_${Date.now()}`,
          password: `oauth_${Math.random().toString(36).substring(2, 15)}`
        });
        console.log("[FIXED REDIRECT ROUTE] Created new user with ID:", user.id);
      } else {
        // Update existing user
        user = await storage.getUser(req.session.userId);
        if (!user) {
          throw new Error("User not found in session");
        }
        console.log("[FIXED REDIRECT ROUTE] Using existing user with ID:", user.id);
      }
      
      // Calculate token expiry
      const expiryDate = new Date();
      expiryDate.setSeconds(expiryDate.getSeconds() + tokenData.expires_in);
      
      // Update user with the tokens
      user = await storage.updateUserEbayTokens(
        user.id,
        tokenData.access_token,
        tokenData.refresh_token,
        expiryDate
      );
      
      // Set session variables
      req.session.userId = user.id;
      req.session.ebayToken = tokenData.access_token;
      req.session.ebayRefreshToken = tokenData.refresh_token;
      req.session.ebayTokenExpiry = expiryDate;
      
      // Save session and redirect
      req.session.save(err => {
        if (err) {
          console.error("[FIXED REDIRECT ROUTE] Session save error:", err);
          return res.status(500).send("Session error");
        }
        
        console.log("[FIXED REDIRECT ROUTE] Authentication successful, redirecting to direct-photos");
        res.redirect('/direct-photos');
      });
    } catch (error) {
      console.error("[FIXED REDIRECT ROUTE] Error processing OAuth callback:", error);
      
      // Show user-friendly error page
      res.send(`
        <html>
          <head>
            <title>eBay Authentication Error</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 2rem; text-align: center; }
              h1 { color: #e53935; }
              .error-box { background: #ffebee; border: 1px solid #ffcdd2; border-radius: 4px; padding: 1rem; margin: 2rem 0; }
              .actions { margin-top: 2rem; }
              .button { display: inline-block; background: #0064D2; color: white; padding: 10px 20px; 
                       text-decoration: none; border-radius: 4px; margin: 0 10px; }
              .alt-button { background: #757575; }
            </style>
          </head>
          <body>
            <h1>eBay Authentication Failed</h1>
            <div class="error-box">
              <p>We encountered an error while processing your eBay authentication:</p>
              <p><strong>${error instanceof Error ? error.message : String(error)}</strong></p>
            </div>
            <div class="actions">
              <a href="/api/auth/ebay/url" class="button">Try Again</a>
              <a href="/api/auth/test-login" class="button alt-button">Use Test Account</a>
              <a href="/" class="button alt-button">Return Home</a>
            </div>
          </body>
        </html>
      `);
    }
  });
  
  // Test login endpoint
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
      
      // Save session and redirect
      req.session.save((err) => {
        if (err) {
          console.error("Error saving session:", err);
          return res.status(500).json({ success: false, error: "Session error" });
        }
        
        // Return HTML page with JavaScript redirect
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

  // Logout endpoint
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Error destroying session:", err);
        return res.status(500).json({ success: false, error: "Logout failed" });
      }
      res.json({ success: true });
    });
  });

  // Authentication status endpoint
  app.get("/api/auth/status", (req: Request, res: Response) => {
    const isAuthenticated = !!req.session.userId;
    const hasEbayToken = !!req.session.ebayToken;
    
    res.json({
      isAuthenticated,
      hasEbayToken,
      userId: req.session.userId
    });
  });
}