import { 
  users, 
  listings, 
  type User, 
  type InsertUser, 
  type Listing, 
  type InsertListing 
} from "@shared/schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserEbayTokens(id: number, ebayToken: string, refreshToken: string, expiryDate: Date): Promise<User>;
  
  createListing(listing: InsertListing): Promise<Listing>;
  getListing(id: number): Promise<Listing | undefined>;
  getListingsByUserId(userId: number): Promise<Listing[]>;
  updateListing(id: number, listing: Partial<InsertListing>): Promise<Listing>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private listings: Map<number, Listing>;
  private userCurrentId: number;
  private listingCurrentId: number;

  constructor() {
    this.users = new Map();
    this.listings = new Map();
    this.userCurrentId = 1;
    this.listingCurrentId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userCurrentId++;
    const user: User = { 
      ...insertUser, 
      id, 
      ebayToken: null, 
      ebayRefreshToken: null, 
      ebayTokenExpiry: null 
    };
    this.users.set(id, user);
    return user;
  }

  async updateUserEbayTokens(id: number, ebayToken: string, refreshToken: string, expiryDate: Date): Promise<User> {
    const user = await this.getUser(id);
    if (!user) {
      throw new Error("User not found");
    }

    const updatedUser: User = {
      ...user,
      ebayToken,
      ebayRefreshToken: refreshToken,
      ebayTokenExpiry: expiryDate
    };

    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async createListing(insertListing: InsertListing): Promise<Listing> {
    const id = this.listingCurrentId++;
    const now = new Date();
    
    // Explicitly create a valid Listing object with non-nullable fields
    const listing: Listing = {
      id,
      userId: insertListing.userId,
      title: insertListing.title || null,
      description: insertListing.description || null,
      price: insertListing.price || null,
      condition: insertListing.condition || null,
      conditionDescription: insertListing.conditionDescription || null,
      category: insertListing.category || null,
      itemSpecifics: insertListing.itemSpecifics || null,
      images: insertListing.images || null,
      ebayDraftId: insertListing.ebayDraftId || null,
      status: insertListing.status || "draft",
      createdAt: now
    };
    
    this.listings.set(id, listing);
    return listing;
  }

  async getListing(id: number): Promise<Listing | undefined> {
    return this.listings.get(id);
  }

  async getListingsByUserId(userId: number): Promise<Listing[]> {
    return Array.from(this.listings.values()).filter(
      (listing) => listing.userId === userId
    );
  }

  async updateListing(id: number, updatedFields: Partial<InsertListing>): Promise<Listing> {
    const listing = await this.getListing(id);
    if (!listing) {
      throw new Error("Listing not found");
    }

    const updatedListing: Listing = {
      ...listing,
      ...updatedFields
    };

    this.listings.set(id, updatedListing);
    return updatedListing;
  }
}

export const storage = new MemStorage();
