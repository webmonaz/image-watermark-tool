// ============================================================================
// Shared Image Processing Logic
// Used by both the Web Worker and tests to ensure consistent behavior
// ============================================================================

import type { CropSettings, CropPreset, WatermarkSettings } from '../types';

// ============================================================================
// Crop Preset Definitions
// ============================================================================

export const CROP_PRESETS: Record<CropPreset, { width?: number; height?: number; ratio?: number }> = {
  'original': {},
  'freeform': {},
  'facebook-thumb': { width: 1200, height: 630 },
  'facebook-post': { width: 1200, height: 1200 },
  'youtube-thumb': { width: 1280, height: 720 },
  'tiktok-thumb': { width: 1080, height: 1920 },
  '1:1': { ratio: 1 },
  '4:5': { ratio: 4 / 5 },
  '16:9': { ratio: 16 / 9 },
  '9:16': { ratio: 9 / 16 },
};

// ============================================================================
// Crop Area Calculation
// ============================================================================

/**
 * Calculate crop area based on settings and preset
 * This is the single source of truth for crop calculations
 * Used by both preview.ts and imageProcessor.worker.ts
 */
export function calculateCropArea(
  imgWidth: number,
  imgHeight: number,
  cropSettings: CropSettings
): { x: number; y: number; width: number; height: number } {
  if (cropSettings.preset === 'original') {
    return { x: 0, y: 0, width: imgWidth, height: imgHeight };
  }

  // Check if user has modified the crop from default values
  const hasUserModifications = cropSettings.width !== 100 || cropSettings.height !== 100 ||
                                cropSettings.x !== 0 || cropSettings.y !== 0;

  // For freeform and any preset with user modifications, use the stored percentage values
  if (cropSettings.preset === 'freeform' || hasUserModifications) {
    return {
      x: (cropSettings.x / 100) * imgWidth,
      y: (cropSettings.y / 100) * imgHeight,
      width: (cropSettings.width / 100) * imgWidth,
      height: (cropSettings.height / 100) * imgHeight,
    };
  }

  // For ratio-based presets with no user modifications, calculate centered crop
  const preset = CROP_PRESETS[cropSettings.preset];
  let targetRatio: number;

  if (preset.width && preset.height) {
    targetRatio = preset.width / preset.height;
  } else if (preset.ratio) {
    targetRatio = preset.ratio;
  } else {
    return { x: 0, y: 0, width: imgWidth, height: imgHeight };
  }

  const imgRatio = imgWidth / imgHeight;
  let cropWidth: number;
  let cropHeight: number;

  if (imgRatio > targetRatio) {
    // Image is wider than target ratio - crop width
    cropHeight = imgHeight;
    cropWidth = imgHeight * targetRatio;
  } else {
    // Image is taller than target ratio - crop height
    cropWidth = imgWidth;
    cropHeight = imgWidth / targetRatio;
  }

  // Center the crop
  const x = (imgWidth - cropWidth) / 2;
  const y = (imgHeight - cropHeight) / 2;

  return { x, y, width: cropWidth, height: cropHeight };
}

// ============================================================================
// Output Dimensions Calculation
// ============================================================================

/**
 * Calculate final output dimensions after cropping and scaling
 */
export function calculateOutputDimensions(
  cropWidth: number,
  cropHeight: number,
  cropSettings: CropSettings,
  exportScale: number
): { width: number; height: number } {
  const preset = CROP_PRESETS[cropSettings.preset];

  let width: number;
  let height: number;

  // If preset has fixed dimensions, use them
  if (preset.width && preset.height) {
    width = preset.width;
    height = preset.height;
  } else {
    // Otherwise, use crop dimensions (but cap at reasonable size)
    const maxDimension = 4096;
    const scale = Math.min(1, maxDimension / Math.max(cropWidth, cropHeight));
    
    width = Math.round(cropWidth * scale);
    height = Math.round(cropHeight * scale);
  }

  // Apply export scale
  const normalizedScale = Math.min(200, Math.max(25, exportScale)) / 100;
  width = Math.max(1, Math.round(width * normalizedScale));
  height = Math.max(1, Math.round(height * normalizedScale));

  // Cap at maximum output dimension
  const maxOutputDimension = 8192;
  const finalScale = Math.min(1, maxOutputDimension / Math.max(width, height));

  return {
    width: Math.max(1, Math.round(width * finalScale)),
    height: Math.max(1, Math.round(height * finalScale)),
  };
}

// ============================================================================
// Watermark Position Calculation
// ============================================================================

/**
 * Calculate watermark position based on settings
 */
export function calculateWatermarkPosition(
  canvasWidth: number,
  canvasHeight: number,
  watermarkWidth: number,
  watermarkHeight: number,
  settings: WatermarkSettings
): { x: number; y: number } {
  const padding = 20;

  switch (settings.position) {
    case 'top-left':
      return { x: padding, y: padding };
    case 'top-right':
      return { x: canvasWidth - watermarkWidth - padding, y: padding };
    case 'bottom-left':
      return { x: padding, y: canvasHeight - watermarkHeight - padding };
    case 'bottom-right':
      return { x: canvasWidth - watermarkWidth - padding, y: canvasHeight - watermarkHeight - padding };
    case 'center':
      return {
        x: (canvasWidth - watermarkWidth) / 2,
        y: (canvasHeight - watermarkHeight) / 2,
      };
    case 'custom':
      return {
        x: (settings.customX / 100) * canvasWidth,
        y: (settings.customY / 100) * canvasHeight,
      };
    default:
      return { x: padding, y: padding };
  }
}
