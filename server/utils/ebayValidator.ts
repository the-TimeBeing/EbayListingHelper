/**
 * Validates an eBay listing payload to ensure it meets the API requirements
 * This catches common issues before sending the request to eBay's API
 */
export function validateEbayListing(data: any): [boolean, string[]] {
  const errors: string[] = [];

  try {
    // Top-level check
    if (!data.hasOwnProperty("inventory_item")) {
      errors.push("Missing 'inventory_item'");
    }
    if (!data.hasOwnProperty("offer")) {
      errors.push("Missing 'offer'");
    }

    if (errors.length > 0) {
      return [false, errors];
    }

    const item = data["inventory_item"];
    const offer = data["offer"];

    // Required inventory_item fields
    const required_item_fields = ["product", "condition", "availability"];
    for (const field of required_item_fields) {
      if (!item.hasOwnProperty(field)) {
        errors.push(`Missing 'inventory_item.${field}'`);
      }
    }

    // Product section
    const product = item.product || {};
    if (!product.title || typeof product.title !== "string" || !product.title.trim()) {
      errors.push("Missing or invalid 'product.title'");
    } else if (product.title.length > 80) {
      errors.push(`Title is too long (${product.title.length} chars). eBay requires max 80 characters.`);
    }
    
    if (!product.description || typeof product.description !== "string" || !product.description.trim()) {
      errors.push("Missing or invalid 'product.description'");
    }
    
    if (!product.aspects || typeof product.aspects !== "object") {
      errors.push("Missing or invalid 'product.aspects'");
    } else {
      // Check that aspects values are arrays of strings
      for (const [key, value] of Object.entries(product.aspects)) {
        if (!Array.isArray(value)) {
          errors.push(`Aspect '${key}' must have an array value, got: ${typeof value}`);
        }
      }
    }
    
    if (!Array.isArray(product.imageUrls) || product.imageUrls.length === 0) {
      errors.push("Missing or empty 'product.imageUrls'");
    }

    // Condition
    const valid_conditions = [
      "NEW", "NEW_WITH_TAGS", "NEW_WITHOUT_TAGS", "NEW_WITH_DEFECTS", 
      "LIKE_NEW", "VERY_GOOD", "GOOD", "ACCEPTABLE", "USED", 
      "FOR_PARTS_OR_NOT_WORKING"
    ];
    if (!valid_conditions.includes(item.condition)) {
      errors.push(`Invalid 'condition'. Must be one of ${valid_conditions.join(', ')}`);
    }

    // Availability
    const avail = item.availability?.shipToLocationAvailability || {};
    if (!('quantity' in avail)) {
      errors.push("Missing 'availability.shipToLocationAvailability.quantity'");
    }

    // Package weight and size (optional, but if present must be complete)
    if (item.packageWeightAndSize) {
      const pkg = item.packageWeightAndSize;
      const dims = pkg.dimensions || {};
      const weight = pkg.weight || {};
      
      const missingDimFields = ['height', 'length', 'width', 'unit'].filter(k => !(k in dims));
      if (missingDimFields.length > 0) {
        errors.push(`Missing fields in 'packageWeightAndSize.dimensions': ${missingDimFields.join(', ')}`);
      }
      
      if (!pkg.packageType) {
        errors.push("Missing 'packageWeightAndSize.packageType'");
      }
      
      const missingWeightFields = ['value', 'unit'].filter(k => !(k in weight));
      if (missingWeightFields.length > 0) {
        errors.push(`Missing fields in 'packageWeightAndSize.weight': ${missingWeightFields.join(', ')}`);
      }
    }

    // Offer pricing
    const price = offer.pricingSummary?.price || {};
    if (typeof price.value !== "number") {
      errors.push("Missing or invalid 'offer.pricingSummary.price.value' (must be a number)");
    }
    if (!price.currency) {
      errors.push("Missing 'offer.pricingSummary.price.currency'");
    }

    // Category ID
    if (!offer.categoryId) {
      errors.push("Missing 'offer.categoryId'");
    }

    // Listing policies - should use IDs
    const policies = offer.listingPolicies || {};
    for (const field of ["fulfillmentPolicyId", "paymentPolicyId", "returnPolicyId"]) {
      if (!(field in policies) || typeof policies[field] !== "string" || !policies[field].trim()) {
        errors.push(`Missing or invalid '${field}' in 'listingPolicies' (must be a string ID)`);
      }
    }

    const isValid = errors.length === 0;
    return [isValid, errors];
  } catch (e) {
    return [false, [`Exception during validation: ${e instanceof Error ? e.message : String(e)}`]];
  }
}