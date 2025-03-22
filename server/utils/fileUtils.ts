import { promises as fs } from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

export const saveBase64Image = async (base64String: string): Promise<string> => {
  try {
    // Extract the base64 data from the string if it includes the data URL prefix
    const base64Data = base64String.includes('base64,') 
      ? base64String.split('base64,')[1] 
      : base64String;

    // Create a temporary directory if it doesn't exist
    const tempDir = path.join(process.cwd(), 'temp');
    await fs.mkdir(tempDir, { recursive: true });

    // Generate a unique filename
    const fileName = `${uuidv4()}.jpg`;
    const filePath = path.join(tempDir, fileName);

    // Save the file
    await fs.writeFile(filePath, base64Data, 'base64');

    return filePath;
  } catch (error) {
    console.error('Error saving base64 image:', error);
    throw new Error('Failed to save image');
  }
};

export const cleanupTempFiles = async (filePaths: string[]): Promise<void> => {
  try {
    for (const filePath of filePaths) {
      await fs.unlink(filePath);
    }
  } catch (error) {
    console.error('Error cleaning up temp files:', error);
  }
};

export const getImageAsBase64 = async (filePath: string): Promise<string> => {
  try {
    const data = await fs.readFile(filePath);
    return data.toString('base64');
  } catch (error) {
    console.error('Error reading image file:', error);
    throw new Error('Failed to read image file');
  }
};

export const isValidBase64Image = (base64String: string): boolean => {
  try {
    // Check if it's a valid base64
    if (!base64String) return false;
    
    // If it includes the data URL prefix, extract just the base64 part
    const base64Data = base64String.includes('base64,') 
      ? base64String.split('base64,')[1] 
      : base64String;
    
    // Try decoding a small part to see if it's valid base64
    Buffer.from(base64Data.substring(0, 100), 'base64');
    
    return true;
  } catch (error) {
    return false;
  }
};

export const getFileExtensionFromBase64 = (base64String: string): string => {
  if (base64String.includes('data:image/jpeg') || base64String.includes('data:image/jpg')) {
    return 'jpg';
  } else if (base64String.includes('data:image/png')) {
    return 'png';
  } else if (base64String.includes('data:image/gif')) {
    return 'gif';
  } else {
    // Default to jpg if can't determine
    return 'jpg';
  }
};