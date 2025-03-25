import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
// Configure middleware with increased payload limits for handling large images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// CRITICAL: Add a special route to handle eBay OAuth callback before any other routes
// This fixes the production issue where the callback with code parameter returns 404
app.get("/ebay-callback", (req: Request, res: Response) => {
  console.log("eBay callback route accessed with query params:", req.query);
  const code = req.query.code as string | undefined;
  
  if (!code) {
    return res.status(400).send("Missing authorization code");
  }
  
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>eBay Authentication Successful</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding-top: 50px; line-height: 1.6; }
          h1 { color: #0064D2; }
          .success-icon { font-size: 48px; color: green; margin: 20px 0; }
          .container { max-width: 600px; margin: 0 auto; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); padding: 30px; }
          .redirect-message { margin-top: 30px; color: #666; }
          .code { font-family: monospace; background: #f5f5f5; padding: 10px; border-radius: 5px; word-break: break-all; margin: 15px 0; }
          .actions { margin-top: 30px; }
          .btn { display: inline-block; padding: 10px 20px; background: #0064D2; color: white; text-decoration: none; border-radius: 5px; margin: 0 10px; }
          .btn-outline { background: white; color: #0064D2; border: 1px solid #0064D2; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>eBay Authentication Successful</h1>
          <div class="success-icon">✅</div>
          <p>We received an authorization code from eBay:</p>
          <div class="code">${code.substring(0, 20)}...</div>
          <p>Due to deployment configuration, you'll need to:</p>
          <div class="actions">
            <a href="/api/auth/test-login" class="btn">Use Test Login</a>
            <a href="/direct-photos" class="btn btn-outline">Go to Direct Upload</a>
          </div>
          <p class="redirect-message">
            <small>You can create listings with the test login while we work on the eBay integration.</small>
          </p>
        </div>
      </body>
    </html>
  `);
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });
})();
