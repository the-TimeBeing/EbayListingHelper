import { pgTable, text, serial, integer, jsonb, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  ebayToken: text("ebay_token"),
  ebayRefreshToken: text("ebay_refresh_token"),
  ebayTokenExpiry: timestamp("ebay_token_expiry"),
});

export const listings = pgTable("listings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  ebayDraftId: text("ebay_draft_id"),
  title: text("title"),
  description: text("description"),
  price: text("price"),
  condition: text("condition"),
  conditionDescription: text("condition_description"),
  category: text("category"),
  itemSpecifics: jsonb("item_specifics"),
  images: jsonb("images"),
  status: text("status").default("draft"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  ebayToken: true,
  ebayRefreshToken: true,
  ebayTokenExpiry: true,
});

export const insertListingSchema = createInsertSchema(listings).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertListing = z.infer<typeof insertListingSchema>;
export type Listing = typeof listings.$inferSelect;
