export interface EbayOAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
}

export interface ConditionOption {
  id: number;
  label: string;
  description: string;
}

export interface ListingDraft {
  title: string;
  description: string;
  price: string;
  condition: string;
  conditionDescription: string;
  category: string;
  itemSpecifics: Record<string, string>[];
  images: string[];
  ebayDraftId?: string;
}

export interface ProcessStep {
  id: string;
  label: string;
  status: 'completed' | 'active' | 'pending';
}

export interface EbayItemSummary {
  itemId: string;
  title: string;
  price: {
    value: string;
    currency: string;
  };
  image: {
    imageUrl: string;
  };
  itemWebUrl: string;
  categories?: Array<{
    categoryId: string;
    categoryName: string;
  }>;
  condition?: string;
  itemSpecifics?: Record<string, string>[];
}

export interface EbaySoldItem extends EbayItemSummary {
  soldPrice: {
    value: string;
    currency: string;
  };
  soldDate: string;
}

export interface ChatGPTListingContent {
  title: string;
  description: string;
  conditionDescription: string;
}
