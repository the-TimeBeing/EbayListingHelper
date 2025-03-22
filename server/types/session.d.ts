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