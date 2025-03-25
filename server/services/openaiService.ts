import OpenAI from "openai";
import { ChatGPTListingContent, EbayItemSummary, EbaySoldItem } from "@shared/types";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const MODEL = "gpt-4o";

export class OpenAIService {
  private openai: OpenAI;
  private useOpenAI: boolean;

  constructor() {
    this.useOpenAI = !!process.env.OPENAI_API_KEY;
    
    if (this.useOpenAI) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY || ""
      });
      console.log("OpenAI service initialized with API key");
    } else {
      console.log("OpenAI API key is missing, using fallback methods");
    }
  }

  async analyzeImage(base64Image: string): Promise<string> {
    // Skip OpenAI analysis if key is missing or if explicitly set to skip
    if (!this.useOpenAI) {
      console.log("Skipping OpenAI image analysis, using basic image description");
      return "Product image uploaded by user. This will be used for the eBay listing.";
    }
    
    try {
      // Clean up the base64 string if it includes data URL prefix
      let processedBase64 = base64Image;
      if (base64Image.includes('base64,')) {
        processedBase64 = base64Image.split('base64,')[1];
      }
      
      console.log(`Analyzing image with OpenAI (base64 length: ${processedBase64.length.toLocaleString()} characters)`);
      
      const response = await this.openai.chat.completions.create({
        model: MODEL,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this image and provide a detailed description of what you see. Focus on identifying the product, brand, model, color, condition, and any other distinctive features that would be helpful for creating an eBay listing."
              },
              {
                type: "image_url",
                image_url: {
                  url: base64Image.includes('data:') 
                    ? base64Image  // Keep the full data URL if it's already formatted
                    : `data:image/jpeg;base64,${processedBase64}` // Otherwise add the prefix
                }
              }
            ],
          },
        ],
        max_tokens: 500,
      });

      console.log("Successfully analyzed image with OpenAI");
      return response.choices[0].message.content || "";
    } catch (error: any) {
      console.error("Error analyzing image with OpenAI:", error);
      // More detailed error logging
      if (error.response) {
        console.error("OpenAI API Error Response:", {
          status: error.response.status,
          data: error.response.data
        });
      }
      return "Failed to analyze image. Product will be listed based on eBay search results.";
    }
  }

  // New method to generate product details from eBay search results without requiring OpenAI
  generateProductDetailsFromEbayResults(
    imageSearchResults: EbayItemSummary[],
    soldItems: EbaySoldItem[]
  ): string {
    console.log("Generating product details from eBay search results");
    
    // Combine product information from image search results
    let details = "Product Details:\n\n";
    
    // Add information from image search results
    if (imageSearchResults && imageSearchResults.length > 0) {
      const mainItem = imageSearchResults[0];
      details += `Title: ${mainItem.title || 'Unknown'}\n`;
      details += `Category: ${mainItem.categories?.map(c => c.categoryName).join(', ') || 'Uncategorized'}\n`;
      details += `Current Market Price: ${mainItem.price?.value || 'Unknown'} ${mainItem.price?.currency || 'USD'}\n\n`;
    } else {
      details += "No similar items found in image search.\n\n";
    }
    
    // Add information from sold items
    if (soldItems && soldItems.length > 0) {
      details += "Recent Sold Items:\n";
      
      // Calculate average selling price
      const prices = soldItems
        .filter(item => item.soldPrice?.value)
        .map(item => parseFloat(item.soldPrice.value));
      
      if (prices.length > 0) {
        const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
        details += `Average Selling Price: $${avgPrice.toFixed(2)}\n`;
        
        // Find min and max prices
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        details += `Price Range: $${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}\n\n`;
      }
      
      // Add some details from the first few sold items
      soldItems.slice(0, 3).forEach((item, index) => {
        details += `Similar Item ${index + 1}: ${item.title}\n`;
        if (item.soldPrice) {
          details += `Sold for: ${item.soldPrice.value} ${item.soldPrice.currency}\n`;
        }
        if (item.soldDate) {
          details += `Date sold: ${item.soldDate}\n`;
        }
        details += `\n`;
      });
    } else {
      details += "No recent sold items found.\n";
    }
    
    return details;
  }

  async generateListingContent(
    productDetails: string,
    condition: string,
    conditionLevel: number,
    useOpenAI: boolean = true
  ): Promise<ChatGPTListingContent> {
    // If OpenAI is not available or useOpenAI is false, generate a simple listing
    if (!this.useOpenAI || !useOpenAI) {
      console.log("Generating basic listing content without OpenAI");
      
      // Extract a title from the product details
      let title = "Product Listing";
      const titleMatch = productDetails.match(/Title: (.*?)(\n|$)/);
      if (titleMatch && titleMatch[1]) {
        title = titleMatch[1].substring(0, 80); // Keep under 80 chars
      }
      
      // Create a basic description from the product details
      const description = `
${productDetails}

This item is being sold in ${condition.toLowerCase()} condition.
      `.trim();
      
      // Generate a condition description based on the level
      let conditionDescription = "";
      switch(conditionLevel) {
        case 1:
          conditionDescription = "Item shows significant wear and may have functional issues.";
          break;
        case 2:
          conditionDescription = "Item shows moderate wear but remains functional.";
          break;
        case 3:
          conditionDescription = "Item shows some signs of use but remains in good condition.";
          break;
        case 4:
          conditionDescription = "Item is in very good condition with minimal signs of use.";
          break;
        case 5:
          conditionDescription = "Item is like new with no visible signs of wear.";
          break;
        default:
          conditionDescription = `Item is in ${condition.toLowerCase()} condition.`;
      }
      
      return { title, description, conditionDescription };
    }
    
    // Otherwise use OpenAI for better quality
    try {
      console.log("Generating listing content with OpenAI...");
      console.log(`Condition: ${condition}, Level: ${conditionLevel}`);
      console.log(`Product details length: ${productDetails.length} characters`);
      
      const prompt = `
Create content for an eBay listing based on the following product details:

Product Details: ${productDetails}
Condition: ${condition} (${conditionLevel}/5)

Please generate in JSON format:
1. A concise, attention-grabbing title (max 80 characters) that includes key product details
2. A detailed 3-4 paragraph description highlighting features, condition, and any notable details
3. A brief condition description that honestly describes the item's physical state

Format your response as a JSON object with the following fields:
- title: string
- description: string
- conditionDescription: string
`;

      const response = await this.openai.chat.completions.create({
        model: MODEL,
        messages: [
          {
            role: "system",
            content: "You are an expert eBay seller who writes compelling, accurate listings that follow eBay best practices."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" }
      });
      
      console.log("Successfully generated listing content with OpenAI");

      const content = JSON.parse(response.choices[0].message.content || "{}");
      
      return {
        title: content.title || "",
        description: content.description || "",
        conditionDescription: content.conditionDescription || ""
      };
    } catch (error: any) {
      console.error("Error generating listing content with OpenAI:", error);
      
      // Fallback to the basic method on error
      return this.generateListingContent(productDetails, condition, conditionLevel, false);
    }
  }
}

export const openaiService = new OpenAIService();
