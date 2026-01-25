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
  WatermarkLayer,
  ExportFormat,
} from '../types';

import {
  calculateCropArea,
  calculateOutputDimensions,
  calculateWatermarkPosition,
  calculateLayerPosition,
  applyRotationTransform,
} from '../shared/imageProcessing';

/**
 * Load an image from base64 data URL
 */
async function loadImage(dataUrl: string): Promise<ImageBitmap> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return createImageBitmap(blob);
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
 * Draw text watermark on canvas (legacy single-watermark)
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

// ============================================================================
// Layer-based Watermark Drawing (new multi-layer system)
// ============================================================================

/**
 * Draw a single image watermark layer with rotation support
 */
async function drawImageLayer(
  ctx: Canvas2DContext,
  layer: WatermarkLayer,
  canvasWidth: number,
  canvasHeight: number
): Promise<void> {
  if (!layer.imageConfig?.imageData) return;

  const watermarkBitmap = await loadImage(layer.imageConfig.imageData);

  // Calculate watermark size based on scale (percentage of canvas width)
  const scaleFactor = layer.scale / 100;
  const watermarkWidth = canvasWidth * scaleFactor;
  const aspectRatio = watermarkBitmap.height / watermarkBitmap.width;
  const watermarkHeight = watermarkWidth * aspectRatio;

  // Get position
  const { x, y } = calculateLayerPosition(
    canvasWidth,
    canvasHeight,
    watermarkWidth,
    watermarkHeight,
    layer
  );

  ctx.save();

  // Apply rotation if needed
  if (layer.rotation !== 0) {
    applyRotationTransform(ctx, x, y, watermarkWidth, watermarkHeight, layer.rotation);
  }

  // Draw with opacity
  ctx.globalAlpha = layer.imageConfig.opacity / 100;
  ctx.drawImage(watermarkBitmap, x, y, watermarkWidth, watermarkHeight);
  ctx.globalAlpha = 1;

  ctx.restore();

  watermarkBitmap.close();
}

/**
 * Draw a single text watermark layer with rotation support
 */
function drawTextLayer(
  ctx: Canvas2DContext,
  layer: WatermarkLayer,
  canvasWidth: number,
  canvasHeight: number
): void {
  if (!layer.textConfig?.text) return;

  const config = layer.textConfig;

  // Build font string
  const fontStyle = config.italic ? 'italic' : 'normal';
  const fontWeight = config.bold ? 'bold' : 'normal';
  const fontSize = Math.round((layer.scale / 100) * canvasWidth * 0.1);
  const fontString = `${fontStyle} ${fontWeight} ${fontSize}px "${config.fontFamily}"`;

  ctx.font = fontString;
  ctx.fillStyle = config.fontColor;

  // Measure text
  const metrics = ctx.measureText(config.text);
  const textWidth = metrics.width;
  const textHeight = fontSize;

  // Get position
  const { x, y } = calculateLayerPosition(
    canvasWidth,
    canvasHeight,
    textWidth,
    textHeight,
    layer
  );

  ctx.save();

  // Apply rotation if needed
  if (layer.rotation !== 0) {
    applyRotationTransform(ctx, x, y, textWidth, textHeight, layer.rotation);
  }

  ctx.globalAlpha = config.opacity / 100;
  ctx.fillText(config.text, x, y + textHeight * 0.8);
  ctx.globalAlpha = 1;

  ctx.restore();
}

/**
 * Draw a single watermark layer (dispatches to image or text)
 */
async function drawWatermarkLayer(
  ctx: Canvas2DContext,
  layer: WatermarkLayer,
  canvasWidth: number,
  canvasHeight: number
): Promise<void> {
  if (!layer.visible) return;

  if (layer.type === 'image') {
    await drawImageLayer(ctx, layer, canvasWidth, canvasHeight);
  } else if (layer.type === 'text') {
    drawTextLayer(ctx, layer, canvasWidth, canvasHeight);
  }
}

/**
 * Draw all watermark layers in order (bottom to top)
 */
async function drawAllLayers(
  ctx: Canvas2DContext,
  layers: WatermarkLayer[],
  canvasWidth: number,
  canvasHeight: number
): Promise<void> {
  for (const layer of layers) {
    await drawWatermarkLayer(ctx, layer, canvasWidth, canvasHeight);
  }
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

    // Draw watermarks - use new layer system if available, otherwise fall back to legacy
    if (message.watermarkLayers && message.watermarkLayers.length > 0) {
      // New multi-layer system
      await drawAllLayers(ctx, message.watermarkLayers, outputDims.width, outputDims.height);
    } else if (message.watermarkSettings) {
      // Legacy single-watermark system (backward compatibility)
      if (message.watermarkSettings.type === 'image') {
        await drawImageWatermark(ctx, message.watermarkSettings, outputDims.width, outputDims.height);
      } else if (message.watermarkSettings.type === 'text') {
        drawTextWatermark(ctx, message.watermarkSettings, outputDims.width, outputDims.height);
      }
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
