import { ProcessedImage } from './types';

// Claude has a hard limit of 8000px for any dimension.
// We use 7000px as a safe maximum to ensure we never hit the edge case
// and to keep payload sizes reasonable while maintaining readability for text.
const MAX_DIMENSION = 7000;

export const processFile = (file: File): Promise<ProcessedImage> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const originalDataUrl = e.target?.result as string;
      
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        let needsResize = false;

        // Check dimensions
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          needsResize = true;
          if (width > height) {
            height = Math.round(height * (MAX_DIMENSION / width));
            width = MAX_DIMENSION;
          } else {
            width = Math.round(width * (MAX_DIMENSION / height));
            height = MAX_DIMENSION;
          }
        }

        // If no resize needed, return original data
        if (!needsResize) {
           const base64Data = originalDataUrl.split(',')[1];
           resolve({
             file,
             previewUrl: originalDataUrl,
             base64Data,
             mimeType: file.type
           });
           return;
        }

        // Resize using Canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error("Failed to create canvas context for image resizing"));
          return;
        }

        // Draw resized image
        ctx.drawImage(img, 0, 0, width, height);

        // Determine output format. 
        // We prefer to stick to the original format if supported, 
        // but fallback to JPEG for efficiency if it was a huge PNG, 
        // or just keep original type.
        // Note: canvas.toDataURL supports 'image/jpeg', 'image/png', 'image/webp'
        let outputMimeType = file.type;
        if (outputMimeType !== 'image/png' && outputMimeType !== 'image/webp' && outputMimeType !== 'image/jpeg') {
          outputMimeType = 'image/jpeg'; // Default fallback
        }

        // Use high quality (0.9) to ensure text remains readable
        const resizedDataUrl = canvas.toDataURL(outputMimeType, 0.9);
        const base64Data = resizedDataUrl.split(',')[1];

        console.log(`[LinguaVision] Resized image from ${img.width}x${img.height} to ${width}x${height}`);

        resolve({
          file,
          previewUrl: resizedDataUrl,
          base64Data,
          mimeType: outputMimeType
        });
      };

      img.onerror = () => reject(new Error("Failed to load image for processing"));
      img.src = originalDataUrl;
    };
    
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};