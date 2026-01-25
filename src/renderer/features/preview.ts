// ============================================================================
// Preview Rendering and UI Sync
// ============================================================================

import { state, getSelectedImage } from '../state';
import { elements } from '../ui/elements';
import {
  calculateCropArea,
  calculateWatermarkPosition as getWatermarkPosition,
  calculateLayerPosition,
  applyRotationTransform,
  CROP_PRESETS,
} from '../../shared/imageProcessing';
import type {
  ImageItem,
  WatermarkSettings,
  WatermarkLayer,
  ThumbnailEditStatus,
} from '../../types';
import { calculateOutputDimensionsForDisplay } from '../utils';

// Re-export shared functions for backward compatibility
export { CROP_PRESETS, calculateCropArea, getWatermarkPosition };

// ============================================================================
// Constants
// ============================================================================

const THUMBNAIL_CAPTURE_SIZE = 200; // Size of captured preview thumbnail

// ============================================================================
// Watermark Image Cache
// ============================================================================

export let cachedWatermarkImage: HTMLImageElement | null = null;

export function setCachedWatermarkImage(img: HTMLImageElement | null): void {
  cachedWatermarkImage = img;
}

// ============================================================================
// UI State Updates
// ============================================================================

export function updateImageCount(): void {
  elements.imageCount.textContent = state.images.length.toString();
  elements.btnExportAll.disabled = state.images.length === 0;
  elements.btnExportSelected.disabled = !state.selectedImageId;
  elements.btnClearAll.disabled = state.images.length === 0;
  
  // Show/hide drop zone
  if (state.images.length === 0) {
    elements.dropZone.style.display = 'flex';
  } else {
    elements.dropZone.style.display = 'none';
  }
  
  // Update apply to all button
  if (elements.btnApplyToAll) {
    elements.btnApplyToAll.disabled = state.images.length <= 1;
  }
}

export function syncUIWithSelectedImage(): void {
  const selectedImage = getSelectedImage();
  if (!selectedImage) return;
  
  const settings = selectedImage.watermarkSettings;
  
  // Update watermark type radio
  elements.watermarkTypeRadios.forEach(radio => {
    radio.checked = radio.value === settings.type;
  });
  
  // Show/hide type-specific controls
  if (settings.type === 'image') {
    elements.imageWatermarkControls.style.display = 'block';
    elements.textWatermarkControls.style.display = 'none';
  } else {
    elements.imageWatermarkControls.style.display = 'none';
    elements.textWatermarkControls.style.display = 'block';
  }
  
  // Update position
  elements.watermarkPosition.value = settings.position;
  
  // Update scale
  elements.watermarkScale.value = settings.scale.toString();
  elements.watermarkScaleValue.textContent = settings.scale.toString();
  
  // Update opacity
  const opacity = settings.type === 'image' 
    ? (settings.imageConfig?.opacity || 80) 
    : (settings.textConfig?.opacity || 80);
  elements.watermarkOpacity.value = opacity.toString();
  elements.watermarkOpacityValue.textContent = opacity.toString();
  
  // Update text settings
  if (settings.textConfig) {
    elements.watermarkText.value = settings.textConfig.text;
    elements.watermarkFont.value = settings.textConfig.fontFamily;
    elements.watermarkColor.value = settings.textConfig.fontColor;
    elements.watermarkBold.checked = settings.textConfig.bold;
    elements.watermarkItalic.checked = settings.textConfig.italic;
  }
  
  // Update crop preset
  elements.cropPreset.value = selectedImage.cropSettings.preset;
}

// ============================================================================
// Preview Layout Calculation
// ============================================================================

export function getPreviewLayout(image: ImageItem): {
  displayWidth: number;
  displayHeight: number;
  cropRect: { x: number; y: number; width: number; height: number };
} {
  const container = elements.previewContainer;
  const maxWidth = Math.max(1, container.clientWidth - 48);
  const maxHeight = Math.max(1, container.clientHeight - 48);
  const aspect = image.width / image.height;

  let baseWidth = maxWidth;
  let baseHeight = maxWidth / aspect;

  if (baseHeight > maxHeight) {
    baseHeight = maxHeight;
    baseWidth = maxHeight * aspect;
  }

  const zoomScale = state.zoom.level / 100;
  const displayWidth = Math.max(1, Math.round(baseWidth * zoomScale));
  const displayHeight = Math.max(1, Math.round(baseHeight * zoomScale));

  const scale = displayWidth / image.width;
  const cropArea = calculateCropArea(image.width, image.height, image.cropSettings);

  return {
    displayWidth,
    displayHeight,
    cropRect: {
      x: cropArea.x * scale,
      y: cropArea.y * scale,
      width: cropArea.width * scale,
      height: cropArea.height * scale,
    },
  };
}

// ============================================================================
// Watermark Drawing
// ============================================================================

function drawWatermarkImage(
  ctx: CanvasRenderingContext2D,
  watermarkImg: HTMLImageElement,
  canvasWidth: number,
  canvasHeight: number,
  settings: WatermarkSettings
): void {
  const scaleFactor = settings.scale / 100;
  const watermarkWidth = canvasWidth * scaleFactor;
  const aspectRatio = watermarkImg.height / watermarkImg.width;
  const watermarkHeight = watermarkWidth * aspectRatio;
  
  const { x, y } = getWatermarkPosition(
    canvasWidth,
    canvasHeight,
    watermarkWidth,
    watermarkHeight,
    settings
  );
  
  ctx.globalAlpha = (settings.imageConfig?.opacity || 80) / 100;
  ctx.drawImage(watermarkImg, x, y, watermarkWidth, watermarkHeight);
  ctx.globalAlpha = 1;
}

function drawWatermarkPreview(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  settings: WatermarkSettings
): void {
  if (settings.type === 'image' && settings.imageConfig?.imageData) {
    if (cachedWatermarkImage && cachedWatermarkImage.src === settings.imageConfig.imageData) {
      drawWatermarkImage(ctx, cachedWatermarkImage, canvasWidth, canvasHeight, settings);
    } else {
      const watermarkImg = new Image();
      watermarkImg.onload = () => {
        cachedWatermarkImage = watermarkImg;
        drawWatermarkImage(ctx, watermarkImg, canvasWidth, canvasHeight, settings);
      };
      watermarkImg.src = settings.imageConfig.imageData;
    }
  } else if (settings.type === 'text' && settings.textConfig?.text) {
    const config = settings.textConfig;
    const fontStyle = config.italic ? 'italic' : 'normal';
    const fontWeight = config.bold ? 'bold' : 'normal';
    const fontSize = Math.round((settings.scale / 100) * canvasWidth * 0.1);
    
    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px "${config.fontFamily}"`;
    ctx.fillStyle = config.fontColor;
    ctx.globalAlpha = config.opacity / 100;
    
    const metrics = ctx.measureText(config.text);
    const textWidth = metrics.width;
    const textHeight = fontSize;
    
    const { x, y } = getWatermarkPosition(canvasWidth, canvasHeight, textWidth, textHeight, settings);
    
    ctx.fillText(config.text, x, y + textHeight * 0.8);
    ctx.globalAlpha = 1;
  }
}

// ============================================================================
// Watermark Layer Cache (for multiple image watermarks)
// ============================================================================

const layerImageCache: Map<string, HTMLImageElement> = new Map();

function getCachedLayerImage(imageData: string): HTMLImageElement | null {
  return layerImageCache.get(imageData) || null;
}

function setCachedLayerImage(imageData: string, img: HTMLImageElement): void {
  // Limit cache size to prevent memory issues
  if (layerImageCache.size > 20) {
    const firstKey = layerImageCache.keys().next().value;
    if (firstKey) layerImageCache.delete(firstKey);
  }
  layerImageCache.set(imageData, img);
}

// ============================================================================
// Layer Drawing Functions
// ============================================================================

/**
 * Draw a single watermark layer with rotation support
 */
function drawLayerPreview(
  ctx: CanvasRenderingContext2D,
  layer: WatermarkLayer,
  canvasWidth: number,
  canvasHeight: number
): void {
  if (!layer.visible) return;

  ctx.save();

  if (layer.type === 'image' && layer.imageConfig?.imageData) {
    const cachedImg = getCachedLayerImage(layer.imageConfig.imageData);

    if (cachedImg) {
      drawImageLayer(ctx, cachedImg, layer, canvasWidth, canvasHeight);
    } else {
      // Load image asynchronously and cache it
      const watermarkImg = new Image();
      watermarkImg.onload = () => {
        setCachedLayerImage(layer.imageConfig!.imageData, watermarkImg);
        // Note: We don't redraw here to avoid infinite loops
        // The image will be drawn correctly on next preview update
      };
      watermarkImg.src = layer.imageConfig.imageData;
    }
  } else if (layer.type === 'text' && layer.textConfig?.text) {
    drawTextLayer(ctx, layer, canvasWidth, canvasHeight);
  }

  ctx.restore();
}

/**
 * Draw an image watermark layer
 */
function drawImageLayer(
  ctx: CanvasRenderingContext2D,
  watermarkImg: HTMLImageElement,
  layer: WatermarkLayer,
  canvasWidth: number,
  canvasHeight: number
): void {
  const scaleFactor = layer.scale / 100;
  const watermarkWidth = canvasWidth * scaleFactor;
  const aspectRatio = watermarkImg.height / watermarkImg.width;
  const watermarkHeight = watermarkWidth * aspectRatio;

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

  ctx.globalAlpha = (layer.imageConfig?.opacity || 80) / 100;
  ctx.drawImage(watermarkImg, x, y, watermarkWidth, watermarkHeight);
  ctx.globalAlpha = 1;

  ctx.restore();
}

/**
 * Draw a text watermark layer
 */
function drawTextLayer(
  ctx: CanvasRenderingContext2D,
  layer: WatermarkLayer,
  canvasWidth: number,
  canvasHeight: number
): void {
  const config = layer.textConfig!;
  const fontStyle = config.italic ? 'italic' : 'normal';
  const fontWeight = config.bold ? 'bold' : 'normal';
  const fontSize = Math.round((layer.scale / 100) * canvasWidth * 0.1);

  ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px "${config.fontFamily}"`;
  ctx.fillStyle = config.fontColor;

  const metrics = ctx.measureText(config.text);
  const textWidth = metrics.width;
  const textHeight = fontSize;

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
 * Draw all watermark layers for an image
 * Layers are drawn in array order (index 0 = bottom)
 */
function drawAllLayersPreview(
  ctx: CanvasRenderingContext2D,
  layers: WatermarkLayer[],
  canvasWidth: number,
  canvasHeight: number
): void {
  for (const layer of layers) {
    drawLayerPreview(ctx, layer, canvasWidth, canvasHeight);
  }
}

// ============================================================================
// Watermark Bounds (for handle positioning)
// ============================================================================

/**
 * Get bounds for the selected watermark layer (for handle positioning)
 */
export function getSelectedLayerBounds(image: ImageItem): {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
} | null {
  const layerStack = image.watermarkSettings.layerStack;
  if (!layerStack || !layerStack.selectedLayerId) return null;

  const layer = layerStack.layers.find(l => l.id === layerStack.selectedLayerId);
  if (!layer || !layer.visible) return null;

  const { cropRect } = getPreviewLayout(image);

  if (layer.type === 'image' && layer.imageConfig?.imageData) {
    const scaleFactor = layer.scale / 100;
    const watermarkWidth = cropRect.width * scaleFactor;
    const aspectRatio = layer.imageConfig.originalHeight / layer.imageConfig.originalWidth;
    const watermarkHeight = watermarkWidth * aspectRatio;

    const pos = calculateLayerPosition(
      cropRect.width,
      cropRect.height,
      watermarkWidth,
      watermarkHeight,
      layer
    );

    return {
      x: cropRect.x + pos.x,
      y: cropRect.y + pos.y,
      width: watermarkWidth,
      height: watermarkHeight,
      rotation: layer.rotation,
    };
  } else if (layer.type === 'text' && layer.textConfig?.text) {
    const fontSize = Math.round((layer.scale / 100) * cropRect.width * 0.1);
    const textWidth = Math.max(60, layer.textConfig.text.length * fontSize * 0.6);
    const textHeight = Math.max(30, fontSize * 1.2);

    const pos = calculateLayerPosition(
      cropRect.width,
      cropRect.height,
      textWidth,
      textHeight,
      layer
    );

    return {
      x: cropRect.x + pos.x,
      y: cropRect.y + pos.y,
      width: textWidth,
      height: textHeight,
      rotation: layer.rotation,
    };
  }

  return null;
}

/**
 * Legacy function for backward compatibility
 * Returns bounds for the old single-watermark system
 */
export function getWatermarkBounds(image: ImageItem): { x: number; y: number; width: number; height: number } | null {
  // First try to get selected layer bounds (new system)
  const layerBounds = getSelectedLayerBounds(image);
  if (layerBounds) {
    return {
      x: layerBounds.x,
      y: layerBounds.y,
      width: layerBounds.width,
      height: layerBounds.height,
    };
  }

  // Fall back to old single-watermark system for backward compatibility
  const settings = image.watermarkSettings;
  const effectiveSettings = {
    ...settings,
    imageConfig: settings.imageConfig || state.globalWatermarkSettings.imageConfig,
  };

  const { cropRect } = getPreviewLayout(image);

  if (effectiveSettings.type === 'image' && effectiveSettings.imageConfig?.imageData) {
    const scaleFactor = effectiveSettings.scale / 100;
    const watermarkWidth = cropRect.width * scaleFactor;
    const aspectRatio = effectiveSettings.imageConfig.originalHeight / effectiveSettings.imageConfig.originalWidth;
    const watermarkHeight = watermarkWidth * aspectRatio;

    const pos = getWatermarkPosition(
      cropRect.width,
      cropRect.height,
      watermarkWidth,
      watermarkHeight,
      effectiveSettings
    );

    return {
      x: cropRect.x + pos.x,
      y: cropRect.y + pos.y,
      width: watermarkWidth,
      height: watermarkHeight,
    };
  } else if (effectiveSettings.type === 'text' && effectiveSettings.textConfig?.text) {
    const fontSize = Math.round((effectiveSettings.scale / 100) * cropRect.width * 0.1);
    const textWidth = Math.max(60, effectiveSettings.textConfig.text.length * fontSize * 0.6);
    const textHeight = Math.max(30, fontSize * 1.2);

    const pos = getWatermarkPosition(
      cropRect.width,
      cropRect.height,
      textWidth,
      textHeight,
      effectiveSettings
    );

    return {
      x: cropRect.x + pos.x,
      y: cropRect.y + pos.y,
      width: textWidth,
      height: textHeight,
    };
  }

  return null;
}

// ============================================================================
// Preview Drawing
// ============================================================================

// Forward declarations for circular dependency resolution
let updateCropOverlayPositionFn: (() => void) | null = null;
let positionWatermarkHandleFn: (() => void) | null = null;

export function setUpdateCropOverlayPositionFn(fn: () => void): void {
  updateCropOverlayPositionFn = fn;
}

export function setPositionWatermarkHandleFn(fn: () => void): void {
  positionWatermarkHandleFn = fn;
}

function drawPreview(image: ImageItem): void {
  const canvas = elements.previewCanvas;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const img = new Image();
  img.onload = () => {
    const { displayWidth, displayHeight, cropRect } = getPreviewLayout(image);
    canvas.width = displayWidth;
    canvas.height = displayHeight;

    ctx.drawImage(img, 0, 0, displayWidth, displayHeight);

    const settings = image.watermarkSettings;

    ctx.save();
    ctx.beginPath();
    ctx.rect(cropRect.x, cropRect.y, cropRect.width, cropRect.height);
    ctx.clip();
    ctx.translate(cropRect.x, cropRect.y);

    // Use layer system if available, otherwise fall back to old single-watermark system
    if (settings.layerStack && settings.layerStack.layers.length > 0) {
      drawAllLayersPreview(ctx, settings.layerStack.layers, cropRect.width, cropRect.height);
    } else {
      // Legacy single-watermark drawing
      const effectiveSettings = {
        ...settings,
        imageConfig: settings.imageConfig || state.globalWatermarkSettings.imageConfig,
      };
      drawWatermarkPreview(ctx, cropRect.width, cropRect.height, effectiveSettings);
    }

    ctx.restore();

    if (image.cropSettings.preset !== 'original' && updateCropOverlayPositionFn) {
      updateCropOverlayPositionFn();
    }

    // Check if any layer has custom position or if using legacy custom position
    const hasCustomPosition = settings.layerStack?.layers.some(l => l.position === 'custom') ||
                              settings.position === 'custom';
    if (hasCustomPosition && positionWatermarkHandleFn) {
      positionWatermarkHandleFn();
    }
  };
  img.src = image.previewData;
}

export function updatePreview(): void {
  const image = getSelectedImage();

  if (!image) {
    elements.previewCanvas.style.display = 'none';
    elements.noImagePlaceholder.style.display = 'block';
    elements.watermarkOverlay.style.display = 'none';
    elements.cropOverlay.style.display = 'none';
    elements.previewInfo.textContent = 'Select an image to preview';
    updateOutputDimensionsDisplay();
    return;
  }

  elements.noImagePlaceholder.style.display = 'none';
  elements.previewCanvas.style.display = 'block';
  elements.previewInfo.textContent = `${image.fileName} (${image.width}×${image.height})`;

  drawPreview(image);

  // Check if any layer has custom position or if using legacy custom position
  const hasCustomPosition = image.watermarkSettings.layerStack?.layers.some(l => l.position === 'custom') ||
                            image.watermarkSettings.position === 'custom';
  if (hasCustomPosition) {
    elements.watermarkOverlay.style.display = 'block';
  } else {
    elements.watermarkOverlay.style.display = 'none';
  }

  if (image.cropSettings.preset !== 'original') {
    elements.cropOverlay.style.display = 'block';
  } else {
    elements.cropOverlay.style.display = 'none';
  }

  // Update output dimensions display
  updateOutputDimensionsDisplay();
}

// ============================================================================
// Output Dimensions Display
// ============================================================================

/**
 * Update the output resolution display in the sidebar
 */
export function updateOutputDimensionsDisplay(): void {
  const outputDisplay = elements.outputDimensions;
  if (!outputDisplay) return;

  const image = getSelectedImage();

  if (!image) {
    outputDisplay.textContent = '-- x --';
    return;
  }

  const dims = calculateOutputDimensionsForDisplay(image, state.exportScale);
  outputDisplay.textContent = `${dims.width} x ${dims.height}`;
}

// ============================================================================
// Preview Thumbnail Capture
// ============================================================================

/**
 * Capture the cropped preview as a thumbnail for the image list.
 * This shows users what the final exported image will look like with watermark and crop applied.
 */
export function capturePreviewThumbnail(image: ImageItem): void {
  const canvas = elements.previewCanvas;
  if (canvas.width === 0 || canvas.height === 0) return;
  
  // Get the crop rectangle from the preview layout
  const { cropRect } = getPreviewLayout(image);
  
  // If crop area is invalid, use full canvas
  const sourceX = Math.max(0, cropRect.x);
  const sourceY = Math.max(0, cropRect.y);
  const sourceWidth = Math.min(cropRect.width, canvas.width - sourceX);
  const sourceHeight = Math.min(cropRect.height, canvas.height - sourceY);
  
  if (sourceWidth <= 0 || sourceHeight <= 0) return;
  
  // Create a temporary canvas for the cropped area
  const tempCanvas = document.createElement('canvas');
  const aspect = sourceWidth / sourceHeight;
  
  if (aspect > 1) {
    tempCanvas.width = THUMBNAIL_CAPTURE_SIZE;
    tempCanvas.height = Math.round(THUMBNAIL_CAPTURE_SIZE / aspect);
  } else {
    tempCanvas.height = THUMBNAIL_CAPTURE_SIZE;
    tempCanvas.width = Math.round(THUMBNAIL_CAPTURE_SIZE * aspect);
  }
  
  const ctx = tempCanvas.getContext('2d');
  if (!ctx) return;
  
  // Draw only the cropped portion from the preview canvas
  ctx.drawImage(
    canvas,
    sourceX, sourceY, sourceWidth, sourceHeight,  // Source rectangle (cropped area)
    0, 0, tempCanvas.width, tempCanvas.height      // Destination (fill thumbnail)
  );
  
  image.previewThumbnail = tempCanvas.toDataURL('image/jpeg', 0.8);
}

/**
 * Calculate the edit status based on image settings.
 * Call this when watermark or crop settings change.
 */
export function calculateEditStatus(image: ImageItem): ThumbnailEditStatus {
  // If already exported, keep that status
  if (image.editStatus === 'exported') return 'exported';
  
  const hasWatermark = image.watermarkSettings.imageConfig?.imageData || 
                       (image.watermarkSettings.type === 'text' && image.watermarkSettings.textConfig?.text);
  const hasCrop = image.cropSettings.preset !== 'original';
  
  // Check if watermark settings have been modified from defaults
  const watermarkModified = hasWatermark || 
    image.watermarkSettings.position !== 'bottom-right' ||
    image.watermarkSettings.scale !== 20;
  
  if (watermarkModified && hasCrop) {
    return 'edited';
  } else if (hasCrop) {
    return 'cropped';
  } else if (watermarkModified) {
    return 'watermarked';
  }
  
  return 'untouched';
}

/**
 * Update the edit status of an image and capture its preview thumbnail.
 */
export function updateImageEditStatus(image: ImageItem): void {
  const newStatus = calculateEditStatus(image);
  if (newStatus !== image.editStatus) {
    image.editStatus = newStatus;
  }
}

/**
 * Mark an image as exported and update its status.
 */
export function markImageExported(image: ImageItem): void {
  image.editStatus = 'exported';
}
