// ============================================================================
// Utility Functions
// ============================================================================

import type {
  WatermarkSettings,
  WatermarkLayer,
  WatermarkLayerStack,
  ImageItem,
} from '../../types';
import { calculateCropArea, calculateOutputDimensions } from '../../shared/imageProcessing';

// ============================================================================
// Constants
// ============================================================================

export const THUMBNAIL_SIZE = 200;  // Max dimension for sidebar thumbnails
export const PREVIEW_SIZE = 1200;   // Max dimension for preview area

// ============================================================================
// ID Generation
// ============================================================================

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// ============================================================================
// Image Utilities
// ============================================================================

export function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Generate a resized thumbnail from image data
 */
export function generateThumbnail(dataUrl: string, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Calculate new dimensions maintaining aspect ratio
      let width = img.width;
      let height = img.height;
      
      if (width > height) {
        if (width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }
      
      // Create canvas and draw resized image
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      
      // Use better quality scaling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);
      
      // Return as JPEG for smaller size (good enough for thumbnails)
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

// ============================================================================
// Settings Clone
// ============================================================================

export function deepCloneWatermarkSettings(settings: WatermarkSettings): WatermarkSettings {
  return {
    ...settings,
    imageConfig: settings.imageConfig ? { ...settings.imageConfig } : undefined,
    textConfig: settings.textConfig ? { ...settings.textConfig } : undefined,
    layerStack: settings.layerStack ? deepCloneLayerStack(settings.layerStack) : undefined,
  };
}

/**
 * Deep clone a single watermark layer
 */
export function deepCloneLayer(layer: WatermarkLayer): WatermarkLayer {
  return {
    ...layer,
    imageConfig: layer.imageConfig ? { ...layer.imageConfig } : undefined,
    textConfig: layer.textConfig ? { ...layer.textConfig } : undefined,
  };
}

/**
 * Deep clone a watermark layer stack
 */
export function deepCloneLayerStack(stack: WatermarkLayerStack): WatermarkLayerStack {
  return {
    layers: stack.layers.map(deepCloneLayer),
    selectedLayerId: stack.selectedLayerId,
  };
}

// ============================================================================
// Output Dimension Utilities
// ============================================================================

export interface OutputDimensions {
  width: number;
  height: number;
  scale: number;
}

/**
 * Calculate the final output dimensions for an image based on crop and export settings
 */
export function calculateOutputDimensionsForDisplay(
  image: ImageItem,
  exportScale: number
): OutputDimensions {
  const cropArea = calculateCropArea(image.width, image.height, image.cropSettings);
  const output = calculateOutputDimensions(
    cropArea.width,
    cropArea.height,
    image.cropSettings,
    exportScale
  );
  return {
    width: output.width,
    height: output.height,
    scale: exportScale,
  };
}

// ============================================================================
// File Utilities
// ============================================================================

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
