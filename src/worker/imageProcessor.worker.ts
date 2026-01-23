// ============================================================================
// Image Processor Web Worker
// Handles image processing off the main thread to prevent UI freezing
// Uses OffscreenCanvas for rendering watermarks and applying crops
// ============================================================================

/// <reference lib="webworker" />

import type {
  ProcessImageMessage,
  ProcessImageResult,
  WatermarkSettings,
  CropSettings,
  CropPreset,
  ExportFormat,
} from '../types';

// Crop preset dimensions
const CROP_PRESETS: Record<CropPreset, { width?: number; height?: number; ratio?: number }> = {
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

/**
 * Load an image from base64 data URL
 */
async function loadImage(dataUrl: string): Promise<ImageBitmap> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return createImageBitmap(blob);
}

/**
 * Calculate crop area based on settings and preset
 */
function calculateCropArea(
  imgWidth: number,
  imgHeight: number,
  cropSettings: CropSettings
): { x: number; y: number; width: number; height: number } {
  const preset = CROP_PRESETS[cropSettings.preset];

  if (cropSettings.preset === 'original') {
    return { x: 0, y: 0, width: imgWidth, height: imgHeight };
  }

  if (cropSettings.preset === 'freeform') {
    // Freeform uses percentage-based values
    return {
      x: (cropSettings.x / 100) * imgWidth,
      y: (cropSettings.y / 100) * imgHeight,
      width: (cropSettings.width / 100) * imgWidth,
      height: (cropSettings.height / 100) * imgHeight,
    };
  }

  // Ratio-based or fixed-size presets
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

/**
 * Calculate final output dimensions
 */
function calculateOutputDimensions(
  cropWidth: number,
  cropHeight: number,
  cropSettings: CropSettings,
  exportScale: number
): { width: number; height: number } {
  const preset = CROP_PRESETS[cropSettings.preset];

  // If preset has fixed dimensions, use them
  let width: number;
  let height: number;

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

  const normalizedScale = Math.min(200, Math.max(25, exportScale)) / 100;
  width = Math.max(1, Math.round(width * normalizedScale));
  height = Math.max(1, Math.round(height * normalizedScale));

  const maxOutputDimension = 8192;
  const finalScale = Math.min(1, maxOutputDimension / Math.max(width, height));

  return {
    width: Math.max(1, Math.round(width * finalScale)),
    height: Math.max(1, Math.round(height * finalScale)),
  };
}

/**
 * Calculate watermark position based on settings
 */
function calculateWatermarkPosition(
  canvasWidth: number,
  canvasHeight: number,
  watermarkWidth: number,
  watermarkHeight: number,
  settings: WatermarkSettings
): { x: number; y: number } {
  const padding = 20; // Padding from edges

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

// Canvas context type alias for readability
type Canvas2DContext = OffscreenCanvasRenderingContext2D;

/**
 * Draw image watermark on canvas
 */
async function drawImageWatermark(
  ctx: Canvas2DContext,
  settings: WatermarkSettings,
  canvasWidth: number,
  canvasHeight: number
): Promise<void> {
  if (!settings.imageConfig?.imageData) return;

  const watermarkBitmap = await loadImage(settings.imageConfig.imageData);
  
  // Calculate watermark size based on scale (percentage of canvas width)
  const scaleFactor = settings.scale / 100;
  const watermarkWidth = canvasWidth * scaleFactor;
  const aspectRatio = watermarkBitmap.height / watermarkBitmap.width;
  const watermarkHeight = watermarkWidth * aspectRatio;

  // Get position
  const { x, y } = calculateWatermarkPosition(
    canvasWidth,
    canvasHeight,
    watermarkWidth,
    watermarkHeight,
    settings
  );

  // Draw with opacity
  ctx.globalAlpha = settings.imageConfig.opacity / 100;
  ctx.drawImage(watermarkBitmap, x, y, watermarkWidth, watermarkHeight);
  ctx.globalAlpha = 1;

  watermarkBitmap.close();
}

/**
 * Draw text watermark on canvas
 */
function drawTextWatermark(
  ctx: Canvas2DContext,
  settings: WatermarkSettings,
  canvasWidth: number,
  canvasHeight: number
): void {
  if (!settings.textConfig?.text) return;

  const config = settings.textConfig;
  
  // Build font string
  const fontStyle = config.italic ? 'italic' : 'normal';
  const fontWeight = config.bold ? 'bold' : 'normal';
  const fontSize = Math.round((settings.scale / 100) * canvasWidth * 0.1); // Scale based on canvas
  const fontString = `${fontStyle} ${fontWeight} ${fontSize}px "${config.fontFamily}"`;
  
  ctx.font = fontString;
  ctx.fillStyle = config.fontColor;
  ctx.globalAlpha = config.opacity / 100;

  // Measure text
  const metrics = ctx.measureText(config.text);
  const textWidth = metrics.width;
  const textHeight = fontSize; // Approximate

  // Get position
  const { x, y } = calculateWatermarkPosition(
    canvasWidth,
    canvasHeight,
    textWidth,
    textHeight,
    settings
  );

  // Draw text (baseline adjustment)
  ctx.fillText(config.text, x, y + textHeight * 0.8);
  ctx.globalAlpha = 1;
}

/**
 * Get MIME type for export format
 */
function getMimeType(format: ExportFormat): string {
  switch (format) {
    case 'png': return 'image/png';
    case 'jpg': return 'image/jpeg';
    case 'webp': return 'image/webp';
    default: return 'image/png';
  }
}

/**
 * Process a single image with watermark and crop
 */
async function processImage(message: ProcessImageMessage): Promise<ProcessImageResult> {
  try {
    // Load the source image
    const sourceBitmap = await loadImage(message.imageData);
    
    // Calculate crop area
    const cropArea = calculateCropArea(
      sourceBitmap.width,
      sourceBitmap.height,
      message.cropSettings
    );
    
    // Calculate output dimensions
    const outputDims = calculateOutputDimensions(
      cropArea.width,
      cropArea.height,
      message.cropSettings,
      message.exportScale
    );
    
    // Create output canvas
    const canvas = new OffscreenCanvas(outputDims.width, outputDims.height);
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // Draw cropped and scaled source image
    ctx.drawImage(
      sourceBitmap,
      cropArea.x, cropArea.y, cropArea.width, cropArea.height, // Source rect
      0, 0, outputDims.width, outputDims.height // Dest rect
    );

    // Draw watermark
    if (message.watermarkSettings.type === 'image') {
      await drawImageWatermark(ctx, message.watermarkSettings, outputDims.width, outputDims.height);
    } else if (message.watermarkSettings.type === 'text') {
      drawTextWatermark(ctx, message.watermarkSettings, outputDims.width, outputDims.height);
    }

    // Convert to blob
    const mimeType = getMimeType(message.exportFormat);
    const quality = message.exportFormat === 'png' ? undefined : message.quality / 100;
    const blob = await canvas.convertToBlob({ type: mimeType, quality });

    // Convert blob to base64
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    const dataUrl = `data:${mimeType};base64,${base64}`;

    // Cleanup
    sourceBitmap.close();

    return {
      type: 'result',
      success: true,
      processedData: dataUrl,
    };
  } catch (error) {
    return {
      type: 'result',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during processing',
    };
  }
}

// Worker message handler
self.onmessage = async (event: MessageEvent<ProcessImageMessage>) => {
  if (event.data.type === 'process') {
    const result = await processImage(event.data);
    self.postMessage(result);
  }
};

export {};
