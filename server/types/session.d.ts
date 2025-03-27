import { User } from '@shared/schema';
import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: number;
    user?: User;
    ebayToken?: string;
    ebayRefreshToken?: string;
    ebayTokenExpiry?: Date;
    photos?: string[];
    hasUploadedPhotos?: boolean; // Flag to track if photos have been uploaded
    isTestSession?: boolean; // Flag to indicate if this is a test user session
    templateItemDetails?: any; // Store template item details from eBay search
    processingProgress?: {
      status: string;
      currentStep: string;
      stepsCompleted: number;
      totalSteps: number;
      error?: string;
    };
    lastGeneratedListingId?: number;
  }
}