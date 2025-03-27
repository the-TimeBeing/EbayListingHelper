import axios from 'axios';

// Free imgBB API for image hosting
// Using a temporary API key with rate limits for testing
// In production, we would use a proper API key from environment variables
const IMGBB_API_KEY = '78c28185d893db37d4ea2d9dfac74454';

export class ImgbbService {
  /**
   * Uploads a base64 image to imgBB and returns a direct image URL
   * @param base64Image - Base64 image string (with or without data:image prefix)
   * @returns Direct URL to the uploaded image
   */
  async uploadImage(base64Image: string): Promise<string> {
    try {
      // Clean the base64 string if it has the data:image prefix
      let cleanBase64 = base64Image;
      if (base64Image.includes(';base64,')) {
        cleanBase64 = base64Image.split(';base64,')[1];
      }

      // Create form data for the request
      const formData = new URLSearchParams();
      formData.append('key', IMGBB_API_KEY);
      formData.append('image', cleanBase64);

      // Send request to imgBB API
      const response = await axios.post('https://api.imgbb.com/1/upload', formData);

      // Check for successful response
      if (response.data && response.data.success) {
        console.log('Successfully uploaded image to imgBB:', response.data.data.url);
        // Return the direct image URL
        return response.data.data.display_url;
      } else {
        console.error('Failed to upload image to imgBB:', response.data);
        throw new Error('Failed to upload image to imgBB');
      }
    } catch (error) {
      console.error('Error uploading image to imgBB:', error);
      throw new Error(`Failed to upload image to imgBB: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export const imgbbService = new ImgbbService();