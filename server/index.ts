import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { setupVite, serveStatic, log } from "./vite";
import session from "express-session";
import MemoryStore from "memorystore";

// Create session store
const SessionStore = MemoryStore(session);

const app = express();

// Basic middleware setup
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

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

// Static files
app.use('/static', express.static(process.cwd() + '/server/public'));

// Simple API test route
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Simplified startup
(async () => {
  try {
    console.log("Starting simplified server...");
    
    // Create HTTP server
    const server = createServer(app);
    
    // Setup Vite middleware in development
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }
    
    // Start the server
    const port = 5000;
    server.listen(port, "0.0.0.0", () => {
      console.log(`Server started on port ${port}`);
    });
  } catch (error) {
    console.error("Server startup error:", error);
  }
})();
