import OpenAI from "openai";
import { ChatGPTListingContent } from "@shared/types";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const MODEL = "gpt-4o";

export class OpenAIService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || ""
    });

    if (!process.env.OPENAI_API_KEY) {
      console.error("OpenAI API key is missing");
    }
  }

  async analyzeImage(base64Image: string): Promise<string> {
    try {
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
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ],
          },
        ],
        max_tokens: 500,
      });

      return response.choices[0].message.content || "";
    } catch (error) {
      console.error("Error analyzing image with OpenAI:", error);
      throw new Error("Failed to analyze image");
    }
  }

  async generateListingContent(
    productDetails: string,
    condition: string,
    conditionLevel: number
  ): Promise<ChatGPTListingContent> {
    try {
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

      const content = JSON.parse(response.choices[0].message.content || "{}");
      
      return {
        title: content.title || "",
        description: content.description || "",
        conditionDescription: content.conditionDescription || ""
      };
    } catch (error) {
      console.error("Error generating listing content with OpenAI:", error);
      throw new Error("Failed to generate listing content");
    }
  }
}

export const openaiService = new OpenAIService();
