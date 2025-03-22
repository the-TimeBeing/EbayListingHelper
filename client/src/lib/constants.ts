import { ConditionOption } from "@shared/types";

export const CONDITIONS: ConditionOption[] = [
  { id: 1, label: "Used - Poor", description: "<strong>Used - Poor:</strong> Item has significant wear or damage but is still functional. May have multiple flaws or require repair." },
  { id: 2, label: "Used - Fair", description: "<strong>Used - Fair:</strong> Item works but shows noticeable wear. May have cosmetic issues or minor functional problems." },
  { id: 3, label: "Used - Good", description: "<strong>Used - Good:</strong> Item shows some signs of use but is in good working condition. Minor scratches or marks may be present." },
  { id: 4, label: "Like New", description: "<strong>Like New:</strong> Item appears almost unused with minimal signs of wear. All original accessories included if applicable." },
  { id: 5, label: "New", description: "<strong>New:</strong> Brand new, unused item in original packaging with all original tags/accessories." }
];

export const PROCESS_STEPS = [
  { id: 'analyzing_photos', label: 'Analyzing photos' },
  { id: 'searching_similar_items', label: 'Finding similar sold items' },
  { id: 'generating_content', label: 'Creating listing title and description' },
  { id: 'setting_price', label: 'Setting optimal price based on sales data' },
  { id: 'creating_draft', label: 'Saving draft to your eBay account' }
];

export const MAX_PHOTOS = 5;
export const MAX_PHOTO_SIZE_MB = 10;
