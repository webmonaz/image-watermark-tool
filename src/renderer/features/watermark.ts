// ============================================================================
// Watermark Management
// ============================================================================

import { state, getSelectedImage, markUnsavedChanges } from '../state';
import { elements } from '../ui/elements';
import { 
  deepCloneWatermarkSettings, 
  getImageDimensions 
} from '../utils';
import { pushToUndoStack } from './history';
import { 
  updatePreview, 
  getPreviewLayout, 
  getWatermarkBounds,
  setCachedWatermarkImage 
} from './preview';
import { renderImageList } from './imageList';
import type { WatermarkSettings } from '../../types';

// ============================================================================
// Watermark Drag State
// ============================================================================

interface WatermarkDragState {
  isDragging: boolean;
  isResizing: boolean;
  dragOffsetX: number;
  dragOffsetY: number;
  startScale: number;
  startWidth: number;
  startHeight: number;
  startMouseX: number;
  startMouseY: number;
}

const watermarkDragState: WatermarkDragState = {
  isDragging: false,
  isResizing: false,
  dragOffsetX: 0,
  dragOffsetY: 0,
  startScale: 20,
  startWidth: 0,
  startHeight: 0,
  startMouseX: 0,
  startMouseY: 0,
};

// ============================================================================
// Watermark Handle Positioning
// ============================================================================

export function positionWatermarkHandle(): void {
  const canvas = elements.previewCanvas;
  const handle = elements.watermarkHandle;
  const selectedImage = getSelectedImage();

  if (!selectedImage) return;

  const bounds = getWatermarkBounds(selectedImage);
  if (!bounds) {
    handle.style.display = 'none';
    return;
  }

  handle.style.display = 'block';

  const canvasRect = canvas.getBoundingClientRect();
  const containerRect = elements.previewContainer.getBoundingClientRect();

  const offsetX = canvasRect.left - containerRect.left;
  const offsetY = canvasRect.top - containerRect.top;

  handle.style.left = `${offsetX + bounds.x}px`;
  handle.style.top = `${offsetY + bounds.y}px`;
  handle.style.width = `${bounds.width}px`;
  handle.style.height = `${bounds.height}px`;
}

// ============================================================================
// Watermark Image Loading
// ============================================================================

export async function loadWatermarkImage(filePath: string): Promise<void> {
  try {
    const dataUrl = await window.electronAPI.readImageAsBase64(filePath);
    const { width, height } = await getImageDimensions(dataUrl);
    
    const imageConfig = {
      imageData: dataUrl,
      originalWidth: width,
      originalHeight: height,
      opacity: 80,
    };
    
    state.globalWatermarkSettings.imageConfig = imageConfig;
    
    state.images.forEach(img => {
      img.watermarkSettings.imageConfig = { ...imageConfig };
    });
    
    const watermarkImg = new Image();
    watermarkImg.onload = () => {
      setCachedWatermarkImage(watermarkImg);
      updatePreview();
    };
    watermarkImg.src = dataUrl;
    
    elements.watermarkPreviewImg.src = dataUrl;
    elements.watermarkPreview.style.display = 'block';
    
    updatePreview();
  } catch (error) {
    console.error('Failed to load watermark image:', error);
  }
}

// ============================================================================
// Watermark Settings Update
// ============================================================================

export function updateSelectedImageWatermarkSettings(
  updater: (settings: WatermarkSettings) => void,
  saveToUndo = true
): void {
  const selectedImage = getSelectedImage();
  if (!selectedImage) return;
  
  if (saveToUndo) {
    const previousSettings = deepCloneWatermarkSettings(selectedImage.watermarkSettings);
    updater(selectedImage.watermarkSettings);
    const newSettings = deepCloneWatermarkSettings(selectedImage.watermarkSettings);
    
    pushToUndoStack({
      type: 'single',
      imageId: selectedImage.id,
      previousSettings,
      newSettings,
    });
  } else {
    updater(selectedImage.watermarkSettings);
  }
  
  updater(state.globalWatermarkSettings);
  markUnsavedChanges();
  updatePreview();
}

// ============================================================================
// Apply Watermark to All Images
// ============================================================================

let confirmCallback: (() => void) | null = null;

export function showConfirmModal(message: string, onConfirm: () => void): void {
  elements.confirmMessage.textContent = message;
  confirmCallback = onConfirm;
  elements.confirmModal.style.display = 'flex';
}

export function hideConfirmModal(): void {
  elements.confirmModal.style.display = 'none';
  confirmCallback = null;
}

export function getConfirmCallback(): (() => void) | null {
  return confirmCallback;
}

export function applyWatermarkSettingsToAll(): void {
  const selectedImage = getSelectedImage();
  if (!selectedImage || state.images.length <= 1) return;
  
  const message = `This will apply the current watermark position and settings to all ${state.images.length} images. Any custom positions will be lost. Continue?`;
  
  showConfirmModal(message, () => {
    const allPreviousSettings = new Map<string, WatermarkSettings>();
    state.images.forEach(img => {
      allPreviousSettings.set(img.id, deepCloneWatermarkSettings(img.watermarkSettings));
    });
    
    const newSettings = deepCloneWatermarkSettings(selectedImage.watermarkSettings);
    state.images.forEach(img => {
      img.watermarkSettings = deepCloneWatermarkSettings(newSettings);
    });
    
    const previousSettings = allPreviousSettings.get(selectedImage.id);
    if (!previousSettings) {
      return;
    }

    pushToUndoStack({
      type: 'all',
      previousSettings,
      newSettings: newSettings,
      allPreviousSettings,
    });
    
    renderImageList();
    updatePreview();
  });
}

// ============================================================================
// Watermark Dragging Setup
// ============================================================================

export function setupWatermarkDragging(): void {
  const handle = elements.watermarkHandle;
  const resizeHandle = handle.querySelector('.watermark-resize-handle');

  if (resizeHandle) {
    resizeHandle.addEventListener('mousedown', (e: Event) => {
      const mouseEvent = e as MouseEvent;
      const selectedImage = getSelectedImage();
      if (!selectedImage) return;

      watermarkDragState.isResizing = true;
      watermarkDragState.isDragging = false;
      watermarkDragState.startScale = selectedImage.watermarkSettings.scale;
      watermarkDragState.startMouseX = mouseEvent.clientX;
      watermarkDragState.startMouseY = mouseEvent.clientY;

      const bounds = getWatermarkBounds(selectedImage);
      if (bounds) {
        watermarkDragState.startWidth = bounds.width;
        watermarkDragState.startHeight = bounds.height;
      }

      handle.classList.add('dragging');
      mouseEvent.preventDefault();
      mouseEvent.stopPropagation();
    });
  }

  handle.addEventListener('mousedown', (e: MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('watermark-resize-handle')) {
      return;
    }

    const selectedImage = getSelectedImage();
    if (!selectedImage) return;

    watermarkDragState.isDragging = true;
    watermarkDragState.isResizing = false;
    handle.classList.add('dragging');

    const bounds = getWatermarkBounds(selectedImage);
    if (bounds) {
      const canvasRect = elements.previewCanvas.getBoundingClientRect();
      watermarkDragState.dragOffsetX = e.clientX - canvasRect.left - bounds.x;
      watermarkDragState.dragOffsetY = e.clientY - canvasRect.top - bounds.y;
    }

    e.preventDefault();
  });

  document.addEventListener('mousemove', (e: MouseEvent) => {
    const selectedImage = getSelectedImage();
    if (!selectedImage) return;

    if (watermarkDragState.isDragging) {
      const canvas = elements.previewCanvas;
      const canvasRect = canvas.getBoundingClientRect();
      const { cropRect } = getPreviewLayout(selectedImage);

      const mouseX = e.clientX - canvasRect.left - watermarkDragState.dragOffsetX;
      const mouseY = e.clientY - canvasRect.top - watermarkDragState.dragOffsetY;

      const x = ((mouseX - cropRect.x) / cropRect.width) * 100;
      const y = ((mouseY - cropRect.y) / cropRect.height) * 100;

      const clampedX = Math.max(-10, Math.min(110, x));
      const clampedY = Math.max(-10, Math.min(110, y));

      // Check if using layer system
      const layerStack = selectedImage.watermarkSettings.layerStack;
      if (layerStack && layerStack.selectedLayerId) {
        const layer = layerStack.layers.find(l => l.id === layerStack.selectedLayerId);
        if (layer) {
          layer.position = 'custom';
          layer.customX = clampedX;
          layer.customY = clampedY;
        }
      } else {
        // Legacy single-watermark system
        selectedImage.watermarkSettings.position = 'custom';
        selectedImage.watermarkSettings.customX = clampedX;
        selectedImage.watermarkSettings.customY = clampedY;
      }

      positionWatermarkHandle();
      updatePreview();
    } else if (watermarkDragState.isResizing) {
      const deltaX = e.clientX - watermarkDragState.startMouseX;
      const deltaY = e.clientY - watermarkDragState.startMouseY;

      const delta = Math.max(deltaX, deltaY);

      const scaleChange = (delta / watermarkDragState.startWidth) * watermarkDragState.startScale;
      const newScale = Math.max(5, Math.min(50, watermarkDragState.startScale + scaleChange));

      // Check if using layer system
      const layerStack = selectedImage.watermarkSettings.layerStack;
      if (layerStack && layerStack.selectedLayerId) {
        const layer = layerStack.layers.find(l => l.id === layerStack.selectedLayerId);
        if (layer) {
          layer.scale = newScale;
          // Update layer UI controls if they exist
          if (elements.layerScale) {
            elements.layerScale.value = newScale.toString();
          }
          if (elements.layerScaleValue) {
            elements.layerScaleValue.textContent = Math.round(newScale).toString();
          }
        }
      } else {
        // Legacy single-watermark system
        selectedImage.watermarkSettings.scale = newScale;
        elements.watermarkScale.value = newScale.toString();
        elements.watermarkScaleValue.textContent = Math.round(newScale).toString();
        state.globalWatermarkSettings.scale = newScale;
      }

      positionWatermarkHandle();
      updatePreview();
    }
  });

  document.addEventListener('mouseup', () => {
    if (watermarkDragState.isDragging || watermarkDragState.isResizing) {
      const wasDragging = watermarkDragState.isDragging;

      watermarkDragState.isDragging = false;
      watermarkDragState.isResizing = false;
      elements.watermarkHandle.classList.remove('dragging');

      const selectedImage = getSelectedImage();
      if (selectedImage) {
        // Sync UI for layer system
        const layerStack = selectedImage.watermarkSettings.layerStack;
        if (layerStack && layerStack.selectedLayerId) {
          const layer = layerStack.layers.find(l => l.id === layerStack.selectedLayerId);
          if (layer) {
            // Update layer position UI when position was changed by dragging
            if (wasDragging && elements.layerPosition) {
              elements.layerPosition.value = layer.position;
            }
          }
        }
        markUnsavedChanges();
      }
    }
  });
}
