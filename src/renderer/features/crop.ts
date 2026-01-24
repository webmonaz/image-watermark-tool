// ============================================================================
// Crop Interaction Management
// ============================================================================

import { getSelectedImage, markUnsavedChanges } from '../state';
import { elements } from '../ui/elements';
import { getPreviewLayout, updatePreview, updateImageEditStatus } from './preview';
import type { CropPreset, ImageItem } from '../../types';

// ============================================================================
// Crop Drag State
// ============================================================================

interface CropDragState {
  isDragging: boolean;
  isResizing: boolean;
  activeHandle: string | null;
  startX: number;
  startY: number;
  startCrop: { x: number; y: number; width: number; height: number };
  aspectRatio: number | null;
}

const cropDragState: CropDragState = {
  isDragging: false,
  isResizing: false,
  activeHandle: null,
  startX: 0,
  startY: 0,
  startCrop: { x: 0, y: 0, width: 100, height: 100 },
  aspectRatio: null,
};

// ============================================================================
// Crop Preset Helpers
// ============================================================================

export function getPresetAspectRatio(preset: CropPreset): number | null {
  const RATIOS: Record<string, number> = {
    'facebook-thumb': 1200 / 630,
    'facebook-post': 1,
    'youtube-thumb': 1280 / 720,
    'tiktok-thumb': 1080 / 1920,
    '1:1': 1,
    '4:5': 4 / 5,
    '16:9': 16 / 9,
    '9:16': 9 / 16,
  };
  return RATIOS[preset] ?? null;
}

export function calculateCenteredCrop(imgRatio: number, targetRatio: number): { x: number; y: number; width: number; height: number } {
  let cropWidth: number;
  let cropHeight: number;

  if (imgRatio > targetRatio) {
    cropHeight = 100;
    cropWidth = (targetRatio / imgRatio) * 100;
  } else {
    cropWidth = 100;
    cropHeight = (imgRatio / targetRatio) * 100;
  }

  return {
    x: (100 - cropWidth) / 2,
    y: (100 - cropHeight) / 2,
    width: cropWidth,
    height: cropHeight,
  };
}

// ============================================================================
// Crop Overlay Positioning
// ============================================================================

export function updateCropOverlayPosition(): void {
  const selectedImage = getSelectedImage();
  const cropBox = elements.cropBox;
  const cropOverlay = elements.cropOverlay;

  if (!selectedImage || !cropBox || !cropOverlay) return;

  if (selectedImage.cropSettings.preset === 'original') {
    cropOverlay.style.display = 'none';
    return;
  }

  cropOverlay.style.display = 'block';

  const canvas = elements.previewCanvas;
  const canvasRect = canvas.getBoundingClientRect();
  const containerRect = elements.previewContainer.getBoundingClientRect();

  const offsetX = canvasRect.left - containerRect.left;
  const offsetY = canvasRect.top - containerRect.top;

  const { cropRect } = getPreviewLayout(selectedImage);

  cropBox.style.left = `${offsetX + cropRect.x}px`;
  cropBox.style.top = `${offsetY + cropRect.y}px`;
  cropBox.style.width = `${cropRect.width}px`;
  cropBox.style.height = `${cropRect.height}px`;

  if (selectedImage.cropSettings.preset !== 'freeform') {
    cropBox.classList.add('ratio-constrained');
  } else {
    cropBox.classList.remove('ratio-constrained');
  }
}

// ============================================================================
// Crop Values Initialization
// ============================================================================

function ensureCropValuesInitialized(image: ImageItem): void {
  if (image.cropSettings.preset === 'freeform') return;

  const aspectRatio = getPresetAspectRatio(image.cropSettings.preset);
  if (aspectRatio !== null) {
    const imgRatio = image.width / image.height;
    const centeredCrop = calculateCenteredCrop(imgRatio, aspectRatio);

    const currentCenterX = image.cropSettings.x + image.cropSettings.width / 2;
    const currentCenterY = image.cropSettings.y + image.cropSettings.height / 2;
    const expectedCenterX = centeredCrop.x + centeredCrop.width / 2;
    const expectedCenterY = centeredCrop.y + centeredCrop.height / 2;

    const isDefault = Math.abs(currentCenterX - expectedCenterX) < 0.1 &&
                      Math.abs(currentCenterY - expectedCenterY) < 0.1 &&
                      Math.abs(image.cropSettings.width - centeredCrop.width) < 0.1;

    if (isDefault || (image.cropSettings.width === 100 && image.cropSettings.height === 100)) {
      image.cropSettings.x = centeredCrop.x;
      image.cropSettings.y = centeredCrop.y;
      image.cropSettings.width = centeredCrop.width;
      image.cropSettings.height = centeredCrop.height;
    }
  }
}

// ============================================================================
// Crop Move/Resize Handlers
// ============================================================================

function startCropMove(e: MouseEvent): void {
  const selectedImage = getSelectedImage();
  if (!selectedImage || selectedImage.cropSettings.preset === 'original') return;

  ensureCropValuesInitialized(selectedImage);

  cropDragState.isDragging = true;
  cropDragState.isResizing = false;
  cropDragState.activeHandle = 'move';
  cropDragState.startX = e.clientX;
  cropDragState.startY = e.clientY;
  cropDragState.startCrop = {
    x: selectedImage.cropSettings.x,
    y: selectedImage.cropSettings.y,
    width: selectedImage.cropSettings.width,
    height: selectedImage.cropSettings.height,
  };

  if (selectedImage.cropSettings.preset !== 'freeform') {
    cropDragState.aspectRatio = getPresetAspectRatio(selectedImage.cropSettings.preset);
  } else {
    cropDragState.aspectRatio = null;
  }

  document.body.style.cursor = 'move';
}

function startCropResize(e: MouseEvent, handleType: string): void {
  const selectedImage = getSelectedImage();
  if (!selectedImage || selectedImage.cropSettings.preset === 'original') return;

  ensureCropValuesInitialized(selectedImage);

  cropDragState.isDragging = false;
  cropDragState.isResizing = true;
  cropDragState.activeHandle = handleType;
  cropDragState.startX = e.clientX;
  cropDragState.startY = e.clientY;
  cropDragState.startCrop = {
    x: selectedImage.cropSettings.x,
    y: selectedImage.cropSettings.y,
    width: selectedImage.cropSettings.width,
    height: selectedImage.cropSettings.height,
  };

  if (selectedImage.cropSettings.preset !== 'freeform') {
    cropDragState.aspectRatio = getPresetAspectRatio(selectedImage.cropSettings.preset);
  } else {
    cropDragState.aspectRatio = null;
  }

  const cursors: Record<string, string> = {
    'nw': 'nwse-resize',
    'ne': 'nesw-resize',
    'se': 'nwse-resize',
    'sw': 'nesw-resize',
    'n': 'ns-resize',
    's': 'ns-resize',
    'e': 'ew-resize',
    'w': 'ew-resize',
  };
  document.body.style.cursor = cursors[handleType] || 'default';
}

function handleCropResize(
  image: ImageItem,
  deltaXPercent: number,
  deltaYPercent: number
): void {
  const handle = cropDragState.activeHandle;
  const start = cropDragState.startCrop;
  const ratio = cropDragState.aspectRatio;
  const imgRatio = image.width / image.height;

  let newX = start.x;
  let newY = start.y;
  let newWidth = start.width;
  let newHeight = start.height;

  const affectsLeft = handle?.includes('w');
  const affectsRight = handle?.includes('e');
  const affectsTop = handle?.includes('n');
  const affectsBottom = handle?.includes('s');

  if (ratio !== null) {
    const effectiveRatio = ratio / imgRatio;

    if (handle === 'nw' || handle === 'se') {
      if (handle === 'se') {
        newWidth = Math.max(10, start.width + deltaXPercent);
        newHeight = newWidth / effectiveRatio;
      } else {
        const widthDelta = -deltaXPercent;
        newWidth = Math.max(10, start.width + widthDelta);
        newHeight = newWidth / effectiveRatio;
        newX = start.x + start.width - newWidth;
        newY = start.y + start.height - newHeight;
      }
    } else if (handle === 'ne' || handle === 'sw') {
      if (handle === 'ne') {
        newWidth = Math.max(10, start.width + deltaXPercent);
        newHeight = newWidth / effectiveRatio;
        newY = start.y + start.height - newHeight;
      } else {
        const widthDelta = -deltaXPercent;
        newWidth = Math.max(10, start.width + widthDelta);
        newHeight = newWidth / effectiveRatio;
        newX = start.x + start.width - newWidth;
      }
    }
  } else {
    if (affectsRight) {
      newWidth = Math.max(10, start.width + deltaXPercent);
    }
    if (affectsLeft) {
      newWidth = Math.max(10, start.width - deltaXPercent);
      newX = start.x + deltaXPercent;
      if (newX < 0) {
        newWidth += newX;
        newX = 0;
      }
    }
    if (affectsBottom) {
      newHeight = Math.max(10, start.height + deltaYPercent);
    }
    if (affectsTop) {
      newHeight = Math.max(10, start.height - deltaYPercent);
      newY = start.y + deltaYPercent;
      if (newY < 0) {
        newHeight += newY;
        newY = 0;
      }
    }
  }

  newX = Math.max(0, newX);
  newY = Math.max(0, newY);
  if (newX + newWidth > 100) {
    newWidth = 100 - newX;
    if (ratio !== null) {
      newHeight = newWidth / (ratio / imgRatio);
    }
  }
  if (newY + newHeight > 100) {
    newHeight = 100 - newY;
    if (ratio !== null) {
      newWidth = newHeight * (ratio / imgRatio);
    }
  }

  image.cropSettings.x = newX;
  image.cropSettings.y = newY;
  image.cropSettings.width = Math.max(10, newWidth);
  image.cropSettings.height = Math.max(10, newHeight);
}

function handleCropMouseMove(e: MouseEvent): void {
  if (!cropDragState.isDragging && !cropDragState.isResizing) return;

  const selectedImage = getSelectedImage();
  if (!selectedImage) return;

  const { displayWidth, displayHeight } = getPreviewLayout(selectedImage);

  const deltaXPercent = ((e.clientX - cropDragState.startX) / displayWidth) * 100;
  const deltaYPercent = ((e.clientY - cropDragState.startY) / displayHeight) * 100;

  if (cropDragState.activeHandle === 'move') {
    let newX = cropDragState.startCrop.x + deltaXPercent;
    let newY = cropDragState.startCrop.y + deltaYPercent;

    newX = Math.max(0, Math.min(100 - cropDragState.startCrop.width, newX));
    newY = Math.max(0, Math.min(100 - cropDragState.startCrop.height, newY));

    selectedImage.cropSettings.x = newX;
    selectedImage.cropSettings.y = newY;
  } else if (cropDragState.isResizing) {
    handleCropResize(selectedImage, deltaXPercent, deltaYPercent);
  }

  updateCropOverlayPosition();
  updatePreview();
}

function handleCropMouseUp(): void {
  if (cropDragState.isDragging || cropDragState.isResizing) {
    cropDragState.isDragging = false;
    cropDragState.isResizing = false;
    cropDragState.activeHandle = null;
    document.body.style.cursor = '';
    markUnsavedChanges();
    
    // Update edit status (but don't capture thumbnail yet - will be done on focus lost)
    const selectedImage = getSelectedImage();
    if (selectedImage) {
      updateImageEditStatus(selectedImage);
    }
  }
}

// ============================================================================
// Crop Interaction Setup
// ============================================================================

export function setupCropInteraction(): void {
  const cropBox = elements.cropBox;
  const cropOverlay = elements.cropOverlay;

  if (!cropBox || !cropOverlay) return;

  const resizeHandles = cropBox.querySelectorAll('.crop-resize-handle');

  cropBox.addEventListener('mousedown', (e: MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('crop-resize-handle')) {
      return;
    }
    e.stopPropagation();
    e.preventDefault();
    startCropMove(e);
  });

  resizeHandles.forEach((handle) => {
    handle.addEventListener('mousedown', (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const handleType = (handle as HTMLElement).dataset.handle;
      if (handleType) {
        startCropResize(e as MouseEvent, handleType);
      }
    });
  });

  document.addEventListener('mousemove', handleCropMouseMove);
  document.addEventListener('mouseup', handleCropMouseUp);
}
