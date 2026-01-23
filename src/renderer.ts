// ============================================================================
// Renderer Process - UI Logic and State Management
// ============================================================================

import './index.css';
import type {
  ImageItem,
  WatermarkSettings,
  WatermarkType,
  WatermarkPosition,
  CropSettings,
  CropPreset,
  ExportFormat,
  ProcessImageMessage,
  ProcessImageResult,
  AppSettings,
  ProjectFile,
  ZoomState,
  PreviewQuality,
} from './types';

// ============================================================================
// Undo/Redo History Types
// ============================================================================

interface HistoryEntry {
  type: 'single' | 'all';
  imageId?: string;
  previousSettings: WatermarkSettings;
  newSettings: WatermarkSettings;
  // For 'all' type, store all previous settings
  allPreviousSettings?: Map<string, WatermarkSettings>;
}

// ============================================================================
// Application State
// ============================================================================

// Default settings
const DEFAULT_SETTINGS: AppSettings = {
  theme: 'auto',
  thumbnailQuality: 'performance',
  previewQuality: 'balanced',
  defaultWatermarkPosition: 'bottom-right',
  defaultExportFormat: 'jpg',
  defaultExportQuality: 85,
  defaultExportScale: 100,
  recentProjects: [],
  maxRecentProjects: 10,
  sidebarWidth: 280,
  showImageInfo: true,
  defaultZoom: 100,
  zoomStep: 25,
};

interface AppState {
  images: ImageItem[];
  selectedImageId: string | null;
  globalWatermarkSettings: WatermarkSettings;
  exportFormat: ExportFormat;
  exportQuality: number;
  exportFolder: string;
  exportScale: number;
  isExporting: boolean;
  cancelExport: boolean;
  // Undo/Redo history
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
  // New fields
  settings: AppSettings;
  zoom: ZoomState;
  currentProjectPath: string | null;
  hasUnsavedChanges: boolean;
}

const state: AppState = {
  images: [],
  selectedImageId: null,
  globalWatermarkSettings: {
    type: 'image',
    position: 'bottom-right',
    customX: 80,
    customY: 80,
    scale: 20,
    imageConfig: undefined,
    textConfig: {
      text: '',
      fontFamily: 'Arial',
      fontSize: 24,
      fontColor: '#ffffff',
      opacity: 80,
      bold: false,
      italic: false,
    },
  },
  exportFormat: 'png',
  exportQuality: 85,
  exportFolder: '',
  exportScale: 100,
  isExporting: false,
  cancelExport: false,
  undoStack: [],
  redoStack: [],
  // New fields for project save/load, settings, and zoom
  settings: { ...DEFAULT_SETTINGS },
  zoom: {
    level: 100,
    panX: 0,
    panY: 0,
    isPanning: false,
  },
  currentProjectPath: null,
  hasUnsavedChanges: false,
};

// ============================================================================
// DOM Elements
// ============================================================================

const elements = {
  // Header buttons
  btnAddImages: document.getElementById('btn-add-images') as HTMLButtonElement,
  btnExportSelected: document.getElementById('btn-export-selected') as HTMLButtonElement,
  btnExportAll: document.getElementById('btn-export-all') as HTMLButtonElement,
  btnUndo: document.getElementById('btn-undo') as HTMLButtonElement,
  btnRedo: document.getElementById('btn-redo') as HTMLButtonElement,
  
  // Image list
  imageList: document.getElementById('image-list') as HTMLDivElement,
  imageCount: document.getElementById('image-count') as HTMLSpanElement,
  dropZone: document.getElementById('drop-zone') as HTMLDivElement,
  btnClearAll: document.getElementById('btn-clear-all') as HTMLButtonElement,
  
  // Preview
  previewContainer: document.getElementById('preview-container') as HTMLDivElement,
  previewCanvas: document.getElementById('preview-canvas') as HTMLCanvasElement,
  previewInfo: document.getElementById('preview-info') as HTMLDivElement,
  noImagePlaceholder: document.getElementById('no-image-placeholder') as HTMLDivElement,
  watermarkOverlay: document.getElementById('watermark-overlay') as HTMLDivElement,
  watermarkHandle: document.getElementById('watermark-handle') as HTMLDivElement,
  
  // Watermark type
  watermarkTypeRadios: document.querySelectorAll('input[name="watermark-type"]') as NodeListOf<HTMLInputElement>,
  imageWatermarkControls: document.getElementById('image-watermark-controls') as HTMLDivElement,
  textWatermarkControls: document.getElementById('text-watermark-controls') as HTMLDivElement,
  
  // Image watermark
  btnSelectWatermark: document.getElementById('btn-select-watermark') as HTMLButtonElement,
  watermarkPreview: document.getElementById('watermark-preview') as HTMLDivElement,
  watermarkPreviewImg: document.getElementById('watermark-preview-img') as HTMLImageElement,
  btnRemoveWatermark: document.getElementById('btn-remove-watermark') as HTMLButtonElement,
  
  // Text watermark
  watermarkText: document.getElementById('watermark-text') as HTMLInputElement,
  watermarkFont: document.getElementById('watermark-font') as HTMLSelectElement,
  watermarkColor: document.getElementById('watermark-color') as HTMLInputElement,
  watermarkBold: document.getElementById('watermark-bold') as HTMLInputElement,
  watermarkItalic: document.getElementById('watermark-italic') as HTMLInputElement,
  
  // Common watermark settings
  watermarkPosition: document.getElementById('watermark-position') as HTMLSelectElement,
  watermarkScale: document.getElementById('watermark-scale') as HTMLInputElement,
  watermarkScaleValue: document.getElementById('watermark-scale-value') as HTMLSpanElement,
  watermarkOpacity: document.getElementById('watermark-opacity') as HTMLInputElement,
  watermarkOpacityValue: document.getElementById('watermark-opacity-value') as HTMLSpanElement,
  
  // Apply to all button
  btnApplyToAll: document.getElementById('btn-apply-to-all') as HTMLButtonElement,
  
  // Crop settings
  cropPreset: document.getElementById('crop-preset') as HTMLSelectElement,
  
  // Export settings
  exportFormat: document.getElementById('export-format') as HTMLSelectElement,
  qualityControl: document.getElementById('quality-control') as HTMLDivElement,
  exportQuality: document.getElementById('export-quality') as HTMLInputElement,
  exportQualityValue: document.getElementById('export-quality-value') as HTMLSpanElement,
  exportScale: document.getElementById('export-scale') as HTMLInputElement,
  exportScaleValue: document.getElementById('export-scale-value') as HTMLSpanElement,
  exportFolderPath: document.getElementById('export-folder-path') as HTMLDivElement | null,
  
  // Progress overlay
  progressOverlay: document.getElementById('progress-overlay') as HTMLDivElement,
  progressBar: document.getElementById('progress-bar') as HTMLDivElement,
  progressText: document.getElementById('progress-text') as HTMLParagraphElement,
  btnCancelExport: document.getElementById('btn-cancel-export') as HTMLButtonElement,
  
  // Confirmation modal
  confirmModal: document.getElementById('confirm-modal') as HTMLDivElement,
  confirmMessage: document.getElementById('confirm-message') as HTMLParagraphElement,
  btnConfirmYes: document.getElementById('btn-confirm-yes') as HTMLButtonElement,
  btnConfirmNo: document.getElementById('btn-confirm-no') as HTMLButtonElement,
};

// ============================================================================
// Thumbnail Constants
// ============================================================================

const THUMBNAIL_SIZE = 200;  // Max dimension for sidebar thumbnails
const PREVIEW_SIZE = 1200;   // Max dimension for preview area

// ============================================================================
// Image Cache for Performance
// ============================================================================

// Cache for watermark image (shared across all images)
let cachedWatermarkImage: HTMLImageElement | null = null;

// Thumbnail context menu state
let thumbnailContextMenu: HTMLDivElement | null = null;
let contextMenuImageId: string | null = null;

// ============================================================================
// Utility Functions
// ============================================================================

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
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
function generateThumbnail(dataUrl: string, maxSize: number): Promise<string> {
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

function getSelectedImage(): ImageItem | undefined {
  return state.images.find(img => img.id === state.selectedImageId);
}

function deepCloneWatermarkSettings(settings: WatermarkSettings): WatermarkSettings {
  return {
    ...settings,
    imageConfig: settings.imageConfig ? { ...settings.imageConfig } : undefined,
    textConfig: settings.textConfig ? { ...settings.textConfig } : undefined,
  };
}

// ============================================================================
// Undo/Redo Functions
// ============================================================================

function pushToUndoStack(entry: HistoryEntry): void {
  state.undoStack.push(entry);
  // Limit stack size
  if (state.undoStack.length > 50) {
    state.undoStack.shift();
  }
  // Clear redo stack when new action is performed
  state.redoStack = [];
  updateUndoRedoButtons();
}

function undo(): void {
  const entry = state.undoStack.pop();
  if (!entry) return;
  
  if (entry.type === 'single' && entry.imageId) {
    const image = state.images.find(img => img.id === entry.imageId);
    if (image) {
      // Save current state for redo
      state.redoStack.push({
        type: 'single',
        imageId: entry.imageId,
        previousSettings: deepCloneWatermarkSettings(image.watermarkSettings),
        newSettings: entry.previousSettings,
      });
      // Restore previous settings
      image.watermarkSettings = deepCloneWatermarkSettings(entry.previousSettings);
    }
  } else if (entry.type === 'all' && entry.allPreviousSettings) {
    // Save current state for redo
    const currentSettings = new Map<string, WatermarkSettings>();
    state.images.forEach(img => {
      currentSettings.set(img.id, deepCloneWatermarkSettings(img.watermarkSettings));
    });
    
    state.redoStack.push({
      type: 'all',
      previousSettings: entry.previousSettings,
      newSettings: entry.newSettings,
      allPreviousSettings: currentSettings,
    });
    
    // Restore all previous settings
    entry.allPreviousSettings.forEach((settings, id) => {
      const image = state.images.find(img => img.id === id);
      if (image) {
        image.watermarkSettings = deepCloneWatermarkSettings(settings);
      }
    });
  }
  
  updateUndoRedoButtons();
  syncUIWithSelectedImage();
  updatePreview();
}

function redo(): void {
  const entry = state.redoStack.pop();
  if (!entry) return;
  
  if (entry.type === 'single' && entry.imageId) {
    const image = state.images.find(img => img.id === entry.imageId);
    if (image) {
      // Save current state for undo
      state.undoStack.push({
        type: 'single',
        imageId: entry.imageId,
        previousSettings: deepCloneWatermarkSettings(image.watermarkSettings),
        newSettings: entry.newSettings,
      });
      // Apply new settings
      image.watermarkSettings = deepCloneWatermarkSettings(entry.newSettings);
    }
  } else if (entry.type === 'all' && entry.allPreviousSettings) {
    // Save current state for undo
    const currentSettings = new Map<string, WatermarkSettings>();
    state.images.forEach(img => {
      currentSettings.set(img.id, deepCloneWatermarkSettings(img.watermarkSettings));
    });
    
    state.undoStack.push({
      type: 'all',
      previousSettings: entry.previousSettings,
      newSettings: entry.newSettings,
      allPreviousSettings: currentSettings,
    });
    
    // Apply new settings to all
    state.images.forEach(img => {
      img.watermarkSettings = deepCloneWatermarkSettings(entry.newSettings);
    });
  }
  
  updateUndoRedoButtons();
  syncUIWithSelectedImage();
  updatePreview();
}

function updateUndoRedoButtons(): void {
  if (elements.btnUndo) {
    elements.btnUndo.disabled = state.undoStack.length === 0;
  }
  if (elements.btnRedo) {
    elements.btnRedo.disabled = state.redoStack.length === 0;
  }
}

// ============================================================================
// State Updates
// ============================================================================

function updateImageCount(): void {
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

function updateUI(): void {
  updateImageCount();
  renderImageList();
  updatePreview();
  updateUndoRedoButtons();
}

// Sync UI controls with selected image's watermark settings
function syncUIWithSelectedImage(): void {
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
// Image List Rendering
// ============================================================================

function renderImageList(): void {
  // Remove existing thumbnails (keep drop zone)
  const thumbnails = elements.imageList.querySelectorAll('.image-thumbnail');
  thumbnails.forEach(el => el.remove());
  
  // Add thumbnails before drop zone
  state.images.forEach(image => {
    const thumbnail = createThumbnail(image);
    elements.imageList.insertBefore(thumbnail, elements.dropZone);
  });
}

function createThumbnail(image: ImageItem): HTMLDivElement {
  const div = document.createElement('div');
  div.className = `image-thumbnail ${image.id === state.selectedImageId ? 'selected' : ''}`;
  div.dataset.id = image.id;
  
  // Show indicator if image has custom position
  const hasCustomPosition = image.watermarkSettings.position === 'custom';
  const customIndicator = hasCustomPosition ? '<span class="custom-indicator" title="Custom watermark position">*</span>' : '';
  
  // Use thumbnailData instead of originalData for performance
  div.innerHTML = `
    <img src="${image.thumbnailData}" alt="${image.fileName}" loading="lazy" />
    <div class="thumbnail-overlay">
      <span class="thumbnail-name">${image.fileName}${customIndicator}</span>
      <button class="thumbnail-remove" title="Remove image">×</button>
    </div>
  `;
  
  // Click to select
  div.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).classList.contains('thumbnail-remove')) return;
    selectImage(image.id);
  });

  // Right-click context menu
  div.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    selectImage(image.id);
    showThumbnailContextMenu(e.clientX, e.clientY, image.id);
  });
  
  // Remove button
  const removeBtn = div.querySelector('.thumbnail-remove') as HTMLButtonElement;
  removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    removeImage(image.id);
  });
  
  return div;
}

function setupThumbnailContextMenu(): void {
  if (thumbnailContextMenu) return;
  
  const menu = document.createElement('div');
  menu.className = 'thumbnail-context-menu';
  menu.style.display = 'none';
  menu.innerHTML = `
    <button type="button" data-action="export">Export Image</button>
    <button type="button" data-action="remove">Remove Image</button>
  `;
  
  menu.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const button = target.closest('button');
    if (!button || !contextMenuImageId) return;
    
    const action = button.dataset.action;
    const image = state.images.find((item) => item.id === contextMenuImageId);
    
    if (!image) {
      hideThumbnailContextMenu();
      return;
    }
    
    if (action === 'export') {
      exportSingleImage(image);
    } else if (action === 'remove') {
      removeImage(image.id);
    }
    
    hideThumbnailContextMenu();
  });
  
  menu.addEventListener('contextmenu', (event) => {
    event.preventDefault();
  });
  
  document.body.appendChild(menu);
  thumbnailContextMenu = menu;
  
  document.addEventListener('click', (event) => {
    if (!thumbnailContextMenu || thumbnailContextMenu.style.display === 'none') return;
    if (thumbnailContextMenu.contains(event.target as Node)) return;
    hideThumbnailContextMenu();
  });
  
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      hideThumbnailContextMenu();
    }
  });
  
  window.addEventListener('blur', hideThumbnailContextMenu);
  elements.imageList.addEventListener('scroll', hideThumbnailContextMenu);
}

function showThumbnailContextMenu(x: number, y: number, imageId: string): void {
  if (!thumbnailContextMenu) return;
  
  contextMenuImageId = imageId;
  thumbnailContextMenu.style.display = 'block';
  thumbnailContextMenu.style.left = `${x}px`;
  thumbnailContextMenu.style.top = `${y}px`;
  
  const rect = thumbnailContextMenu.getBoundingClientRect();
  let left = x;
  let top = y;
  
  if (rect.right > window.innerWidth) {
    left = Math.max(8, window.innerWidth - rect.width - 8);
  }
  if (rect.bottom > window.innerHeight) {
    top = Math.max(8, window.innerHeight - rect.height - 8);
  }
  
  thumbnailContextMenu.style.left = `${left}px`;
  thumbnailContextMenu.style.top = `${top}px`;
}

function hideThumbnailContextMenu(): void {
  if (!thumbnailContextMenu) return;
  thumbnailContextMenu.style.display = 'none';
  contextMenuImageId = null;
}

function selectImage(id: string): void {
  state.selectedImageId = id;
  updateImageCount();
  renderImageList();
  syncUIWithSelectedImage();
  updatePreview();
}

function removeImage(id: string): void {
  state.images = state.images.filter(img => img.id !== id);
  if (state.selectedImageId === id) {
    state.selectedImageId = state.images[0]?.id || null;
  }
  markUnsavedChanges();
  updateUI();
}

// ============================================================================
// Preview Rendering
// ============================================================================

function updatePreview(): void {
  const image = getSelectedImage();
  
  if (!image) {
    elements.previewCanvas.style.display = 'none';
    elements.noImagePlaceholder.style.display = 'block';
    elements.watermarkOverlay.style.display = 'none';
    elements.previewInfo.textContent = 'Select an image to preview';
    return;
  }
  
  elements.noImagePlaceholder.style.display = 'none';
  elements.previewCanvas.style.display = 'block';
  elements.previewInfo.textContent = `${image.fileName} (${image.width}×${image.height})`;
  
  // Draw preview
  drawPreview(image);
  
  // Show watermark handle for custom position
  if (image.watermarkSettings.position === 'custom') {
    elements.watermarkOverlay.style.display = 'block';
  } else {
    elements.watermarkOverlay.style.display = 'none';
  }
}

function getPreviewLayout(image: ImageItem): {
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

function drawPreview(image: ImageItem): void {
  const canvas = elements.previewCanvas;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  // Use previewData (pre-scaled) for better performance
  const img = new Image();
  img.onload = () => {
    const { displayWidth, displayHeight, cropRect } = getPreviewLayout(image);
    canvas.width = displayWidth;
    canvas.height = displayHeight;

    // Draw full image
    ctx.drawImage(img, 0, 0, displayWidth, displayHeight);
    
    // Draw watermark preview using image-specific settings
    // Get watermark settings - use global watermark image if image doesn't have one
    const settings = image.watermarkSettings;
    const effectiveSettings = {
      ...settings,
      imageConfig: settings.imageConfig || state.globalWatermarkSettings.imageConfig,
    };
    
    // Mask crop area for non-original presets
    if (image.cropSettings.preset !== 'original') {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(0, 0, displayWidth, displayHeight);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillRect(cropRect.x, cropRect.y, cropRect.width, cropRect.height);
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 2;
      ctx.strokeRect(cropRect.x, cropRect.y, cropRect.width, cropRect.height);
      ctx.restore();
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(cropRect.x, cropRect.y, cropRect.width, cropRect.height);
    ctx.clip();
    ctx.translate(cropRect.x, cropRect.y);
    drawWatermarkPreview(ctx, cropRect.width, cropRect.height, effectiveSettings);
    ctx.restore();

    if (image.watermarkSettings.position === 'custom') {
      positionWatermarkHandle();
    }
  };
  // Use previewData instead of originalData for performance
  img.src = image.previewData;
}

// Crop calculation function
function calculateCropArea(
  imgWidth: number,
  imgHeight: number,
  cropSettings: CropSettings
): { x: number; y: number; width: number; height: number } {
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

  const preset = CROP_PRESETS[cropSettings.preset];

  if (cropSettings.preset === 'original') {
    return { x: 0, y: 0, width: imgWidth, height: imgHeight };
  }

  if (cropSettings.preset === 'freeform') {
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

function drawWatermarkPreview(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  settings: WatermarkSettings
): void {
  if (settings.type === 'image' && settings.imageConfig?.imageData) {
    // Use cached watermark image if available
    if (cachedWatermarkImage && cachedWatermarkImage.src === settings.imageConfig.imageData) {
      drawWatermarkImage(ctx, cachedWatermarkImage, canvasWidth, canvasHeight, settings);
    } else {
      // Load and cache the watermark image
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

function getWatermarkPosition(
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

function positionWatermarkHandle(): void {
  const canvas = elements.previewCanvas;
  const handle = elements.watermarkHandle;
  const selectedImage = getSelectedImage();
  
  if (!selectedImage) return;
  
  const { cropRect } = getPreviewLayout(selectedImage);
  const x = cropRect.x + (selectedImage.watermarkSettings.customX / 100) * cropRect.width;
  const y = cropRect.y + (selectedImage.watermarkSettings.customY / 100) * cropRect.height;
  
  // Account for canvas position within container
  const canvasRect = canvas.getBoundingClientRect();
  const containerRect = elements.previewContainer.getBoundingClientRect();
  
  const offsetX = canvasRect.left - containerRect.left;
  const offsetY = canvasRect.top - containerRect.top;
  
  handle.style.left = `${offsetX + x - 30}px`;
  handle.style.top = `${offsetY + y - 30}px`;
}

// ============================================================================
// Image Loading
// ============================================================================

async function addImages(filePaths: string[]): Promise<void> {
  for (const filePath of filePaths) {
    try {
      const dataUrl = await window.electronAPI.readImageAsBase64(filePath);
      const { width, height } = await getImageDimensions(dataUrl);
      const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || 'image';
      
      // Generate thumbnails for performance
      const [thumbnailData, previewData] = await Promise.all([
        generateThumbnail(dataUrl, THUMBNAIL_SIZE),
        generateThumbnail(dataUrl, PREVIEW_SIZE),
      ]);
      
      // Clone global settings but ensure watermark image is shared
      const imageSettings = deepCloneWatermarkSettings(state.globalWatermarkSettings);
      
      const imageItem: ImageItem = {
        id: generateId(),
        fileName,
        filePath,
        originalData: dataUrl,
        width,
        height,
        thumbnailData,
        previewData,
        watermarkSettings: imageSettings,
        cropSettings: {
          preset: 'original',
          x: 0,
          y: 0,
          width: 100,
          height: 100,
        },
        processed: false,
        processing: false,
      };
      
      state.images.push(imageItem);
    } catch (error) {
      console.error('Failed to load image:', filePath, error);
    }
  }
  
  // Select first image if none selected
  if (!state.selectedImageId && state.images.length > 0) {
    state.selectedImageId = state.images[0].id;
  }
  
  // Mark as having unsaved changes
  if (filePaths.length > 0) {
    markUnsavedChanges();
  }
  
  updateUI();
  syncUIWithSelectedImage();
}

// ============================================================================
// Watermark Image Loading
// ============================================================================

async function loadWatermarkImage(filePath: string): Promise<void> {
  try {
    const dataUrl = await window.electronAPI.readImageAsBase64(filePath);
    const { width, height } = await getImageDimensions(dataUrl);
    
    const imageConfig = {
      imageData: dataUrl,
      originalWidth: width,
      originalHeight: height,
      opacity: 80,
    };
    
    // Update global settings
    state.globalWatermarkSettings.imageConfig = imageConfig;
    
    // IMPORTANT: Apply watermark image to ALL existing images
    // This ensures the watermark shows on all images, not just the selected one
    state.images.forEach(img => {
      img.watermarkSettings.imageConfig = { ...imageConfig };
    });
    
    // Pre-cache the watermark image for faster rendering
    const watermarkImg = new Image();
    watermarkImg.onload = () => {
      cachedWatermarkImage = watermarkImg;
      updatePreview(); // Re-render preview with cached image
    };
    watermarkImg.src = dataUrl;
    
    // Show preview
    elements.watermarkPreviewImg.src = dataUrl;
    elements.watermarkPreview.style.display = 'block';
    
    updatePreview();
  } catch (error) {
    console.error('Failed to load watermark image:', error);
  }
}

// ============================================================================
// Apply to All with Confirmation
// ============================================================================

let confirmCallback: (() => void) | null = null;

function showConfirmModal(message: string, onConfirm: () => void): void {
  elements.confirmMessage.textContent = message;
  confirmCallback = onConfirm;
  elements.confirmModal.style.display = 'flex';
}

function hideConfirmModal(): void {
  elements.confirmModal.style.display = 'none';
  confirmCallback = null;
}

function applyWatermarkSettingsToAll(): void {
  const selectedImage = getSelectedImage();
  if (!selectedImage || state.images.length <= 1) return;
  
  const message = `This will apply the current watermark position and settings to all ${state.images.length} images. Any custom positions will be lost. Continue?`;
  
  showConfirmModal(message, () => {
    // Save all previous settings for undo
    const allPreviousSettings = new Map<string, WatermarkSettings>();
    state.images.forEach(img => {
      allPreviousSettings.set(img.id, deepCloneWatermarkSettings(img.watermarkSettings));
    });
    
    // Apply settings to all images
    const newSettings = deepCloneWatermarkSettings(selectedImage.watermarkSettings);
    state.images.forEach(img => {
      img.watermarkSettings = deepCloneWatermarkSettings(newSettings);
    });
    
    // Push to undo stack
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
// Update Selected Image Watermark Settings
// ============================================================================

function updateSelectedImageWatermarkSettings(
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
  
  // Also update global settings for new images
  updater(state.globalWatermarkSettings);
  
  // Mark as having unsaved changes
  markUnsavedChanges();
  
  updatePreview();
}

// ============================================================================
// Export Processing
// ============================================================================

async function promptForExportFolder(): Promise<boolean> {
  const result = await window.electronAPI.selectExportFolder();
  if (!result.canceled && result.folderPath) {
    state.exportFolder = result.folderPath;
    if (elements.exportFolderPath) {
      elements.exportFolderPath.textContent = result.folderPath;
    }
    updateImageCount();
    return true;
  }
  
  return false;
}

async function exportSingleImage(image: ImageItem): Promise<void> {
  if (state.isExporting) return;
  
  const hasExportFolder = await promptForExportFolder();
  if (!hasExportFolder || !state.exportFolder) return;
  
  state.isExporting = true;
  state.cancelExport = false;
  
  elements.progressOverlay.style.display = 'flex';
  elements.progressBar.style.width = '0%';
  elements.progressText.textContent = '0 of 1 images processed';
  
  const workerUrl = new URL('./worker/imageProcessor.worker.ts', import.meta.url);
  
  try {
    const result = await processImageWithWorker(image, workerUrl.href);
    
    if (result.success && result.processedData) {
      const exportResult = await window.electronAPI.exportImage({
        base64Data: result.processedData,
        fileName: image.fileName,
        folderPath: state.exportFolder,
        format: state.exportFormat,
      });
      
      if (exportResult.success) {
        image.processed = true;
      } else {
        image.error = exportResult.error || 'Export failed';
      }
    } else {
      image.error = result.error || 'Unknown error';
    }
  } catch (error) {
    image.error = error instanceof Error ? error.message : 'Unknown error';
  }
  
  elements.progressBar.style.width = '100%';
  elements.progressText.textContent = '1 of 1 images processed';
  state.isExporting = false;
  elements.progressOverlay.style.display = 'none';
  
  if (image.error) {
    alert(`Export failed: ${image.error}`);
  } else {
    alert(`Export complete! 1 image saved to ${state.exportFolder}`);
  }
}

async function exportAllImages(): Promise<void> {
  if (state.images.length === 0) return;
  
  const hasExportFolder = await promptForExportFolder();
  if (!hasExportFolder || !state.exportFolder) return;
  
  state.isExporting = true;
  state.cancelExport = false;
  
  // Show progress overlay
  elements.progressOverlay.style.display = 'flex';
  elements.progressBar.style.width = '0%';
  elements.progressText.textContent = `0 of ${state.images.length} images processed`;
  
  // Create worker
  const workerUrl = new URL('./worker/imageProcessor.worker.ts', import.meta.url);
  
  let processed = 0;
  let permissionError = false;
  
  for (const image of state.images) {
    if (state.cancelExport) break;
    
    try {
      // Process image using worker with image-specific settings
      const result = await processImageWithWorker(image, workerUrl.href);
      
      if (result.success && result.processedData) {
        // Export to file
        const exportResult = await window.electronAPI.exportImage({
          base64Data: result.processedData,
          fileName: image.fileName,
          folderPath: state.exportFolder,
          format: state.exportFormat,
        });
        
        if (exportResult.success) {
          image.processed = true;
        } else {
          image.error = exportResult.error || 'Export failed';
          if (exportResult.error?.includes('Permission denied')) {
            permissionError = true;
            state.cancelExport = true;
          }
        }
      } else {
        image.error = result.error || 'Unknown error';
      }
    } catch (error) {
      image.error = error instanceof Error ? error.message : 'Unknown error';
    }
    
    processed++;
    const percent = (processed / state.images.length) * 100;
    elements.progressBar.style.width = `${percent}%`;
    elements.progressText.textContent = `${processed} of ${state.images.length} images processed`;
  }
  
  state.isExporting = false;
  elements.progressOverlay.style.display = 'none';
  
  if (!state.cancelExport || permissionError) {
    const errorCount = state.images.filter((item) => item.error).length;
    if (errorCount > 0) {
      alert(
        `Export finished with ${errorCount} errors. Check file permissions and choose an export folder that macOS allows.`,
      );
    } else {
      alert(`Export complete! ${processed} images saved to ${state.exportFolder}`);
    }
  }
}

function processImageWithWorker(image: ImageItem, workerUrl: string): Promise<ProcessImageResult> {
  return new Promise((resolve) => {
    const worker = new Worker(workerUrl, { type: 'module' });
    
    worker.onmessage = (event: MessageEvent<ProcessImageResult>) => {
      worker.terminate();
      resolve(event.data);
    };
    
    worker.onerror = (error) => {
      worker.terminate();
      resolve({
        type: 'result',
        success: false,
        error: error.message,
      });
    };
    
    // Use image-specific watermark settings
    const message: ProcessImageMessage = {
      type: 'process',
      imageData: image.originalData,
      imageWidth: image.width,
      imageHeight: image.height,
      watermarkSettings: image.watermarkSettings,
      cropSettings: image.cropSettings,
      exportFormat: state.exportFormat,
      quality: state.exportQuality,
      exportScale: state.exportScale,
    };
    
    worker.postMessage(message);
  });
}

// ============================================================================
// Drag and Drop
// ============================================================================

function setupDragAndDrop(): void {
  const dropZone = elements.dropZone;
  const imageList = elements.imageList;
  
  // Prevent default drag behaviors
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    imageList.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  });
  
  // Highlight drop zone
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
      dropZone.classList.add('drag-over');
    });
  });
  
  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
      dropZone.classList.remove('drag-over');
    });
  });
  
  // Handle drop
  imageList.addEventListener('drop', handleDrop);
  dropZone.addEventListener('drop', handleDrop);
}

async function handleDrop(e: DragEvent): Promise<void> {
  const files = e.dataTransfer?.files;
  if (!files) return;
  
  const imageFiles: File[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.type.startsWith('image/')) {
      imageFiles.push(file);
    }
  }
  
  // Convert files to data URLs and add
  for (const file of imageFiles) {
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const { width, height } = await getImageDimensions(dataUrl);
      
      // Generate thumbnails for performance
      const [thumbnailData, previewData] = await Promise.all([
        generateThumbnail(dataUrl, THUMBNAIL_SIZE),
        generateThumbnail(dataUrl, PREVIEW_SIZE),
      ]);
      
      // Clone global settings to include watermark image
      const imageSettings = deepCloneWatermarkSettings(state.globalWatermarkSettings);
      
      const imageItem: ImageItem = {
        id: generateId(),
        fileName: file.name,
        filePath: file.name, // No real path for dropped files
        originalData: dataUrl,
        width,
        height,
        thumbnailData,
        previewData,
        watermarkSettings: imageSettings,
        cropSettings: {
          preset: 'original',
          x: 0,
          y: 0,
          width: 100,
          height: 100,
        },
        processed: false,
        processing: false,
      };
      
      state.images.push(imageItem);
    } catch (error) {
      console.error('Failed to load dropped file:', file.name, error);
    }
  }
  
  if (!state.selectedImageId && state.images.length > 0) {
    state.selectedImageId = state.images[0].id;
  }
  
  updateUI();
  syncUIWithSelectedImage();
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ============================================================================
// Watermark Handle Dragging
// ============================================================================

function setupWatermarkDragging(): void {
  const handle = elements.watermarkHandle;
  let isDragging = false;
  
  handle.addEventListener('mousedown', (e) => {
    isDragging = true;
    handle.style.cursor = 'grabbing';
    e.preventDefault();
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const selectedImage = getSelectedImage();
    if (!selectedImage) return;
    
    const canvas = elements.previewCanvas;
    const canvasRect = canvas.getBoundingClientRect();
    const { cropRect } = getPreviewLayout(selectedImage);
    
    // Calculate new position as percentage
    const x = ((e.clientX - canvasRect.left - cropRect.x) / cropRect.width) * 100;
    const y = ((e.clientY - canvasRect.top - cropRect.y) / cropRect.height) * 100;
    
    // Clamp to 0-100
    selectedImage.watermarkSettings.customX = Math.max(0, Math.min(100, x));
    selectedImage.watermarkSettings.customY = Math.max(0, Math.min(100, y));
    
    positionWatermarkHandle();
    updatePreview();
  });
  
  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      handle.style.cursor = 'move';
      
      // Save to undo stack after drag ends
      const selectedImage = getSelectedImage();
      if (selectedImage) {
        // Note: We don't push to undo here to avoid too many entries
        // The position is saved when user switches images or applies to all
      }
    }
  });
}

// ============================================================================
// Event Listeners Setup
// ============================================================================

function setupEventListeners(): void {
  // Add images button
  elements.btnAddImages.addEventListener('click', async () => {
    const result = await window.electronAPI.selectImages();
    if (!result.canceled && result.filePaths.length > 0) {
      await addImages(result.filePaths);
    }
  });
  
  // Export all button
  elements.btnExportAll.addEventListener('click', () => {
    exportAllImages();
  });

  // Export selected button
  elements.btnExportSelected.addEventListener('click', () => {
    const selectedImage = getSelectedImage();
    if (selectedImage) {
      exportSingleImage(selectedImage);
    }
  });
  
  // Undo/Redo buttons
  if (elements.btnUndo) {
    elements.btnUndo.addEventListener('click', undo);
  }
  if (elements.btnRedo) {
    elements.btnRedo.addEventListener('click', redo);
  }
  
  // Clear all button
  elements.btnClearAll.addEventListener('click', () => {
    state.images = [];
    state.selectedImageId = null;
    state.undoStack = [];
    state.redoStack = [];
    updateUI();
  });
  
  // Watermark type selection
  elements.watermarkTypeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      const type = radio.value as WatermarkType;
      
      updateSelectedImageWatermarkSettings(settings => {
        settings.type = type;
      });
      
      if (type === 'image') {
        elements.imageWatermarkControls.style.display = 'block';
        elements.textWatermarkControls.style.display = 'none';
      } else {
        elements.imageWatermarkControls.style.display = 'none';
        elements.textWatermarkControls.style.display = 'block';
      }
    });
  });
  
  // Select watermark image
  elements.btnSelectWatermark.addEventListener('click', async () => {
    const result = await window.electronAPI.selectWatermarkImage();
    if (!result.canceled && result.filePath) {
      await loadWatermarkImage(result.filePath);
    }
  });
  
  // Remove watermark
  elements.btnRemoveWatermark.addEventListener('click', () => {
    // Clear watermark from all images
    state.images.forEach(img => {
      img.watermarkSettings.imageConfig = undefined;
    });
    state.globalWatermarkSettings.imageConfig = undefined;
    cachedWatermarkImage = null;
    elements.watermarkPreview.style.display = 'none';
    updatePreview();
  });
  
  // Text watermark inputs
  elements.watermarkText.addEventListener('input', () => {
    updateSelectedImageWatermarkSettings(settings => {
      if (settings.textConfig) {
        settings.textConfig.text = elements.watermarkText.value;
      }
    }, false); // Don't save every keystroke to undo
  });
  
  elements.watermarkText.addEventListener('change', () => {
    // Save to undo on blur/enter
    const selectedImage = getSelectedImage();
    if (selectedImage) {
      pushToUndoStack({
        type: 'single',
        imageId: selectedImage.id,
        previousSettings: deepCloneWatermarkSettings(selectedImage.watermarkSettings),
        newSettings: deepCloneWatermarkSettings(selectedImage.watermarkSettings),
      });
    }
  });
  
  elements.watermarkFont.addEventListener('change', () => {
    updateSelectedImageWatermarkSettings(settings => {
      if (settings.textConfig) {
        settings.textConfig.fontFamily = elements.watermarkFont.value;
      }
    });
  });
  
  elements.watermarkColor.addEventListener('input', () => {
    updateSelectedImageWatermarkSettings(settings => {
      if (settings.textConfig) {
        settings.textConfig.fontColor = elements.watermarkColor.value;
      }
    }, false);
  });
  
  elements.watermarkBold.addEventListener('change', () => {
    updateSelectedImageWatermarkSettings(settings => {
      if (settings.textConfig) {
        settings.textConfig.bold = elements.watermarkBold.checked;
      }
    });
  });
  
  elements.watermarkItalic.addEventListener('change', () => {
    updateSelectedImageWatermarkSettings(settings => {
      if (settings.textConfig) {
        settings.textConfig.italic = elements.watermarkItalic.checked;
      }
    });
  });
  
  // Watermark position
  elements.watermarkPosition.addEventListener('change', () => {
    updateSelectedImageWatermarkSettings(settings => {
      settings.position = elements.watermarkPosition.value as WatermarkPosition;
    });
  });
  
  // Watermark scale
  elements.watermarkScale.addEventListener('input', () => {
    const value = parseInt(elements.watermarkScale.value);
    elements.watermarkScaleValue.textContent = value.toString();
    
    updateSelectedImageWatermarkSettings(settings => {
      settings.scale = value;
    }, false);
  });
  
  elements.watermarkScale.addEventListener('change', () => {
    // Save to undo on release
    const selectedImage = getSelectedImage();
    if (selectedImage) {
      pushToUndoStack({
        type: 'single',
        imageId: selectedImage.id,
        previousSettings: deepCloneWatermarkSettings(selectedImage.watermarkSettings),
        newSettings: deepCloneWatermarkSettings(selectedImage.watermarkSettings),
      });
    }
  });
  
  // Watermark opacity
  elements.watermarkOpacity.addEventListener('input', () => {
    const value = parseInt(elements.watermarkOpacity.value);
    elements.watermarkOpacityValue.textContent = value.toString();
    
    updateSelectedImageWatermarkSettings(settings => {
      if (settings.type === 'image' && settings.imageConfig) {
        settings.imageConfig.opacity = value;
      } else if (settings.textConfig) {
        settings.textConfig.opacity = value;
      }
    }, false);
  });
  
  // Apply to all button
  if (elements.btnApplyToAll) {
    elements.btnApplyToAll.addEventListener('click', applyWatermarkSettingsToAll);
  }
  
  // Confirmation modal buttons
  if (elements.btnConfirmYes) {
    elements.btnConfirmYes.addEventListener('click', () => {
      if (confirmCallback) {
        confirmCallback();
      }
      hideConfirmModal();
    });
  }
  
  if (elements.btnConfirmNo) {
    elements.btnConfirmNo.addEventListener('click', hideConfirmModal);
  }
  
  // Crop preset
  elements.cropPreset.addEventListener('change', () => {
    const preset = elements.cropPreset.value as CropPreset;
    const selectedImage = getSelectedImage();
    if (selectedImage) {
      selectedImage.cropSettings.preset = preset;
      updatePreview();
    }
  });
  
  // Export format
  elements.exportFormat.addEventListener('change', () => {
    state.exportFormat = elements.exportFormat.value as ExportFormat;
    
    // Show/hide quality slider for PNG
    if (state.exportFormat === 'png') {
      elements.qualityControl.style.display = 'none';
    } else {
      elements.qualityControl.style.display = 'block';
    }
  });
  
  // Export quality
  elements.exportQuality.addEventListener('input', () => {
    const value = parseInt(elements.exportQuality.value);
    state.exportQuality = value;
    elements.exportQualityValue.textContent = value.toString();
  });

  // Export scale
  elements.exportScale.addEventListener('input', () => {
    const value = parseInt(elements.exportScale.value);
    state.exportScale = value;
    elements.exportScaleValue.textContent = value.toString();
  });
  
  // Cancel export
  elements.btnCancelExport.addEventListener('click', () => {
    state.cancelExport = true;
  });
  
  // Window resize - reposition watermark handle
  window.addEventListener('resize', () => {
    const selectedImage = getSelectedImage();
    if (selectedImage?.watermarkSettings.position === 'custom') {
      positionWatermarkHandle();
    }
  });
  
  // Note: Keyboard shortcuts are set up in setupKeyboardShortcuts()
}

// ============================================================================
// Project Save/Load Functions
// ============================================================================

/**
 * Mark the project as having unsaved changes
 */
function markUnsavedChanges(): void {
  if (!state.hasUnsavedChanges) {
    state.hasUnsavedChanges = true;
    updateWindowTitle();
  }
}

/**
 * Update the window title to reflect project state
 */
function updateWindowTitle(): void {
  const baseName = state.currentProjectPath 
    ? state.currentProjectPath.split('/').pop()?.split('\\').pop() || 'Untitled'
    : 'Untitled';
  const unsavedMarker = state.hasUnsavedChanges ? ' *' : '';
  document.title = `${baseName}${unsavedMarker} - Image Watermark Tool`;
}

/**
 * Save the current project
 */
async function saveProject(saveAs = false): Promise<void> {
  if (state.images.length === 0) {
    alert('No images to save. Add some images first.');
    return;
  }
  
  // Create project data
  const projectData: ProjectFile = {
    version: '1.0.0',
    savedAt: new Date().toISOString(),
    settings: {
      globalWatermarkSettings: state.globalWatermarkSettings,
      exportFormat: state.exportFormat,
      exportQuality: state.exportQuality,
      exportScale: state.exportScale,
    },
    images: state.images.map(img => ({
      id: img.id,
      fileName: img.fileName,
      filePath: img.filePath,
      width: img.width,
      height: img.height,
      watermarkSettings: img.watermarkSettings,
      cropSettings: img.cropSettings,
    })),
  };
  
  const filePath = saveAs ? undefined : state.currentProjectPath || undefined;
  
  const result = await window.electronAPI.saveProject({
    projectData: JSON.stringify(projectData, null, 2),
    filePath,
  });
  
  if (result.success && result.filePath) {
    state.currentProjectPath = result.filePath;
    state.hasUnsavedChanges = false;
    updateWindowTitle();
    
    // Add to recent projects
    addToRecentProjects(result.filePath);
  }
}

/**
 * Open a project file
 */
async function openProject(): Promise<void> {
  // Check for unsaved changes
  if (state.hasUnsavedChanges && state.images.length > 0) {
    const shouldContinue = confirm(
      'You have unsaved changes. Do you want to continue without saving?'
    );
    if (!shouldContinue) return;
  }
  
  const result = await window.electronAPI.openProject();
  
  if (result.canceled || !result.success || !result.data) {
    return;
  }
  
  try {
    const projectData = JSON.parse(result.data) as ProjectFile;
    
    // Clear current state
    state.images = [];
    state.selectedImageId = null;
    state.undoStack = [];
    state.redoStack = [];
    
    // Load project settings
    state.globalWatermarkSettings = projectData.settings.globalWatermarkSettings;
    state.exportFormat = projectData.settings.exportFormat;
    state.exportQuality = projectData.settings.exportQuality;
    state.exportScale = projectData.settings.exportScale ?? state.settings.defaultExportScale;
    
    // Load images - check if files still exist
    const missingFiles: string[] = [];
    
    for (const imgRef of projectData.images) {
      try {
        const fileInfo = await window.electronAPI.getFileInfo(imgRef.filePath);
        
        if (!fileInfo.exists) {
          missingFiles.push(imgRef.fileName);
          continue;
        }
        
        // Load the image
        const dataUrl = await window.electronAPI.readImageAsBase64(imgRef.filePath);
        
        // Generate thumbnails
        const [thumbnailData, previewData] = await Promise.all([
          generateThumbnail(dataUrl, THUMBNAIL_SIZE),
          generateThumbnail(dataUrl, PREVIEW_SIZE),
        ]);
        
        const imageItem: ImageItem = {
          id: imgRef.id,
          fileName: imgRef.fileName,
          filePath: imgRef.filePath,
          originalData: dataUrl,
          width: imgRef.width,
          height: imgRef.height,
          thumbnailData,
          previewData,
          watermarkSettings: imgRef.watermarkSettings,
          cropSettings: imgRef.cropSettings,
          processed: false,
          processing: false,
        };
        
        state.images.push(imageItem);
      } catch (error) {
        console.error('Failed to load image:', imgRef.filePath, error);
        missingFiles.push(imgRef.fileName);
      }
    }
    
    // Select first image if available
    if (state.images.length > 0) {
      state.selectedImageId = state.images[0].id;
    }
    
    // Update project path
    state.currentProjectPath = result.filePath || null;
    state.hasUnsavedChanges = false;
    
    // Update UI
    updateUI();
    syncUIWithSelectedImage();
    syncExportSettingsUI();
    updateWindowTitle();
    
    // Show warning about missing files
    if (missingFiles.length > 0) {
      alert(
        `The following files could not be found and were skipped:\n\n${missingFiles.join('\n')}`
      );
    }
    
    // Add to recent projects
    if (result.filePath) {
      addToRecentProjects(result.filePath);
    }
  } catch (error) {
    console.error('Failed to parse project file:', error);
    alert('Failed to open project. The file may be corrupted.');
  }
}

/**
 * Add a path to recent projects
 */
function addToRecentProjects(filePath: string): void {
  // Remove if already exists
  state.settings.recentProjects = state.settings.recentProjects.filter((p: string) => p !== filePath);
  
  // Add to beginning
  state.settings.recentProjects.unshift(filePath);
  
  // Limit size
  if (state.settings.recentProjects.length > state.settings.maxRecentProjects) {
    state.settings.recentProjects = state.settings.recentProjects.slice(0, state.settings.maxRecentProjects);
  }
  
  // Save settings
  saveSettings();
}

/**
 * Sync export settings UI with state
 */
function syncExportSettingsUI(): void {
  elements.exportFormat.value = state.exportFormat;
  elements.exportQuality.value = state.exportQuality.toString();
  elements.exportQualityValue.textContent = state.exportQuality.toString();
  elements.exportScale.value = state.exportScale.toString();
  elements.exportScaleValue.textContent = state.exportScale.toString();
  
  // Show/hide quality slider for PNG
  if (state.exportFormat === 'png') {
    elements.qualityControl.style.display = 'none';
  } else {
    elements.qualityControl.style.display = 'block';
  }
}

// ============================================================================
// Settings Functions
// ============================================================================

/**
 * Load settings from disk
 */
async function loadSettings(): Promise<void> {
  const settings = await window.electronAPI.loadSettings();
  state.settings = settings;
  
  // Apply theme
  applyTheme(settings.theme);
  
  // Apply other settings
  state.zoom.level = settings.defaultZoom;
  state.globalWatermarkSettings.position = settings.defaultWatermarkPosition;
  state.exportFormat = settings.defaultExportFormat;
  state.exportQuality = settings.defaultExportQuality;
  state.exportScale = settings.defaultExportScale;
}

/**
 * Save settings to disk
 */
async function saveSettings(): Promise<void> {
  await window.electronAPI.saveSettings(state.settings);
}

/**
 * Apply theme to the document
 */
function applyTheme(theme: 'light' | 'dark' | 'auto'): void {
  // Remove existing theme classes
  document.documentElement.classList.remove('theme-light', 'theme-dark');
  
  if (theme === 'auto') {
    // Use system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.add(prefersDark ? 'theme-dark' : 'theme-light');
  } else {
    document.documentElement.classList.add(`theme-${theme}`);
  }
  
  // Notify main process to update native theme
  window.electronAPI.setNativeTheme(theme);
}

/**
 * Show settings modal
 */
function showSettingsModal(): void {
  const modal = document.getElementById('settings-modal');
  if (modal) {
    // Populate settings values
    const themeSelect = document.getElementById('setting-theme') as HTMLSelectElement;
    const previewQualitySelect = document.getElementById('setting-preview-quality') as HTMLSelectElement;
    const defaultPositionSelect = document.getElementById('setting-default-position') as HTMLSelectElement;
    const defaultFormatSelect = document.getElementById('setting-default-format') as HTMLSelectElement;
    const defaultQualityInput = document.getElementById('setting-default-quality') as HTMLInputElement;
    const defaultScaleInput = document.getElementById('setting-default-scale') as HTMLInputElement;
    
    if (themeSelect) themeSelect.value = state.settings.theme;
    if (previewQualitySelect) previewQualitySelect.value = state.settings.previewQuality;
    if (defaultPositionSelect) defaultPositionSelect.value = state.settings.defaultWatermarkPosition;
    if (defaultFormatSelect) defaultFormatSelect.value = state.settings.defaultExportFormat;
    if (defaultQualityInput) {
      defaultQualityInput.value = state.settings.defaultExportQuality.toString();
      const qualityValue = document.getElementById('setting-default-quality-value');
      if (qualityValue) qualityValue.textContent = state.settings.defaultExportQuality.toString();
    }
    if (defaultScaleInput) {
      defaultScaleInput.value = state.settings.defaultExportScale.toString();
      const scaleValue = document.getElementById('setting-default-scale-value');
      if (scaleValue) scaleValue.textContent = state.settings.defaultExportScale.toString();
    }
    
    modal.style.display = 'flex';
  }
}

/**
 * Hide settings modal
 */
function hideSettingsModal(): void {
  const modal = document.getElementById('settings-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

/**
 * Save settings from modal
 */
function saveSettingsFromModal(): void {
  const themeSelect = document.getElementById('setting-theme') as HTMLSelectElement;
  const previewQualitySelect = document.getElementById('setting-preview-quality') as HTMLSelectElement;
  const defaultPositionSelect = document.getElementById('setting-default-position') as HTMLSelectElement;
  const defaultFormatSelect = document.getElementById('setting-default-format') as HTMLSelectElement;
  const defaultQualityInput = document.getElementById('setting-default-quality') as HTMLInputElement;
  const defaultScaleInput = document.getElementById('setting-default-scale') as HTMLInputElement;
  
  if (themeSelect) {
    state.settings.theme = themeSelect.value as 'light' | 'dark' | 'auto';
    applyTheme(state.settings.theme);
  }
  if (previewQualitySelect) {
    state.settings.previewQuality = previewQualitySelect.value as PreviewQuality;
  }
  if (defaultPositionSelect) {
    state.settings.defaultWatermarkPosition = defaultPositionSelect.value as WatermarkPosition;
    state.globalWatermarkSettings.position = state.settings.defaultWatermarkPosition;
  }
  if (defaultFormatSelect) {
    state.settings.defaultExportFormat = defaultFormatSelect.value as 'png' | 'jpg' | 'webp';
  }
  if (defaultQualityInput) {
    state.settings.defaultExportQuality = parseInt(defaultQualityInput.value);
  }
  if (defaultScaleInput) {
    state.settings.defaultExportScale = parseInt(defaultScaleInput.value);
    state.exportScale = state.settings.defaultExportScale;
  }
  
  saveSettings();
  syncExportSettingsUI();
  hideSettingsModal();
}

// ============================================================================
// Zoom Functions
// ============================================================================

/**
 * Set zoom level
 */
function setZoom(level: number): void {
  // Clamp between 25% and 400%
  state.zoom.level = Math.max(25, Math.min(400, level));
  updateZoomDisplay();
  updatePreview();
}

/**
 * Zoom in by step
 */
function zoomIn(): void {
  setZoom(state.zoom.level + state.settings.zoomStep);
}

/**
 * Zoom out by step
 */
function zoomOut(): void {
  setZoom(state.zoom.level - state.settings.zoomStep);
}

/**
 * Reset zoom to fit
 */
function zoomToFit(): void {
  setZoom(100);
  state.zoom.panX = 0;
  state.zoom.panY = 0;
}

/**
 * Zoom to actual size (100%)
 */
function zoomToActual(): void {
  setZoom(100);
}

/**
 * Update zoom display in UI
 */
function updateZoomDisplay(): void {
  const zoomValue = document.getElementById('zoom-value');
  if (zoomValue) {
    zoomValue.textContent = `${state.zoom.level}%`;
  }
}

// ============================================================================
// Additional Keyboard Shortcuts
// ============================================================================

/**
 * Setup all keyboard shortcuts
 */
function setupKeyboardShortcuts(): void {
  document.addEventListener('keydown', (e) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
    
    // Cmd/Ctrl + Z for undo
    if (cmdOrCtrl && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
      return;
    }
    
    // Cmd/Ctrl + Shift + Z or Cmd/Ctrl + Y for redo
    if (cmdOrCtrl && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
      e.preventDefault();
      redo();
      return;
    }
    
    // Cmd/Ctrl + S for save
    if (cmdOrCtrl && e.key === 's' && !e.shiftKey) {
      e.preventDefault();
      saveProject(false);
      return;
    }
    
    // Cmd/Ctrl + Shift + S for save as
    if (cmdOrCtrl && e.key === 's' && e.shiftKey) {
      e.preventDefault();
      saveProject(true);
      return;
    }
    
    // Cmd/Ctrl + O for open
    if (cmdOrCtrl && e.key === 'o') {
      e.preventDefault();
      openProject();
      return;
    }
    
    // Cmd/Ctrl + , for settings
    if (cmdOrCtrl && e.key === ',') {
      e.preventDefault();
      showSettingsModal();
      return;
    }
    
    // Cmd/Ctrl + Plus for zoom in
    if (cmdOrCtrl && (e.key === '=' || e.key === '+')) {
      e.preventDefault();
      zoomIn();
      return;
    }
    
    // Cmd/Ctrl + Minus for zoom out
    if (cmdOrCtrl && e.key === '-') {
      e.preventDefault();
      zoomOut();
      return;
    }
    
    // Cmd/Ctrl + 0 for zoom to fit
    if (cmdOrCtrl && e.key === '0') {
      e.preventDefault();
      zoomToFit();
      return;
    }
    
    // Cmd/Ctrl + 1 for actual size
    if (cmdOrCtrl && e.key === '1') {
      e.preventDefault();
      zoomToActual();
      return;
    }
    
    // Arrow keys for image navigation (when not in input)
    if (!isInputFocused()) {
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        selectPreviousImage();
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        selectNextImage();
        return;
      }
      // Delete key to remove selected image
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (state.selectedImageId) {
          removeImage(state.selectedImageId);
        }
        return;
      }
    }
  });
}

/**
 * Check if an input element is focused
 */
function isInputFocused(): boolean {
  const active = document.activeElement;
  return active instanceof HTMLInputElement || 
         active instanceof HTMLTextAreaElement || 
         active instanceof HTMLSelectElement;
}

/**
 * Select the previous image in the list
 */
function selectPreviousImage(): void {
  if (state.images.length === 0) return;
  
  const currentIndex = state.images.findIndex(img => img.id === state.selectedImageId);
  const prevIndex = currentIndex <= 0 ? state.images.length - 1 : currentIndex - 1;
  selectImage(state.images[prevIndex].id);
}

/**
 * Select the next image in the list
 */
function selectNextImage(): void {
  if (state.images.length === 0) return;
  
  const currentIndex = state.images.findIndex(img => img.id === state.selectedImageId);
  const nextIndex = currentIndex >= state.images.length - 1 ? 0 : currentIndex + 1;
  selectImage(state.images[nextIndex].id);
}

// ============================================================================
// Initialize Application
// ============================================================================

async function init(): Promise<void> {
  // Load settings first
  await loadSettings();
  
  // Setup event listeners
  setupEventListeners();
  setupDragAndDrop();
  setupThumbnailContextMenu();
  setupWatermarkDragging();
  setupKeyboardShortcuts();
  setupSettingsModalListeners();
  setupProjectButtonListeners();
  setupZoomControlListeners();
  
  // Update UI
  updateUI();
  syncExportSettingsUI();
  updateWindowTitle();
  updateZoomDisplay();
  
  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (state.settings.theme === 'auto') {
      applyTheme('auto');
    }
  });
  
  console.log('Image Watermark Tool initialized');
}

/**
 * Setup settings modal event listeners
 */
function setupSettingsModalListeners(): void {
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const defaultQualityInput = document.getElementById('setting-default-quality') as HTMLInputElement;
  const defaultScaleInput = document.getElementById('setting-default-scale') as HTMLInputElement;
  
  if (btnCloseSettings) {
    btnCloseSettings.addEventListener('click', hideSettingsModal);
  }
  if (btnSaveSettings) {
    btnSaveSettings.addEventListener('click', saveSettingsFromModal);
  }
  if (defaultQualityInput) {
    defaultQualityInput.addEventListener('input', () => {
      const qualityValue = document.getElementById('setting-default-quality-value');
      if (qualityValue) {
        qualityValue.textContent = defaultQualityInput.value;
      }
    });
  }
  if (defaultScaleInput) {
    defaultScaleInput.addEventListener('input', () => {
      const scaleValue = document.getElementById('setting-default-scale-value');
      if (scaleValue) {
        scaleValue.textContent = defaultScaleInput.value;
      }
    });
  }
}

/**
 * Setup project button event listeners
 */
function setupProjectButtonListeners(): void {
  const btnSave = document.getElementById('btn-save-project');
  const btnOpen = document.getElementById('btn-open-project');
  const btnSettings = document.getElementById('btn-settings');
  
  if (btnSave) {
    btnSave.addEventListener('click', () => saveProject(false));
  }
  if (btnOpen) {
    btnOpen.addEventListener('click', openProject);
  }
  if (btnSettings) {
    btnSettings.addEventListener('click', showSettingsModal);
  }
}

/**
 * Setup zoom control event listeners
 */
function setupZoomControlListeners(): void {
  const btnZoomIn = document.getElementById('btn-zoom-in');
  const btnZoomOut = document.getElementById('btn-zoom-out');
  const btnZoomFit = document.getElementById('btn-zoom-fit');
  
  if (btnZoomIn) {
    btnZoomIn.addEventListener('click', zoomIn);
  }
  if (btnZoomOut) {
    btnZoomOut.addEventListener('click', zoomOut);
  }
  if (btnZoomFit) {
    btnZoomFit.addEventListener('click', zoomToFit);
  }

  elements.previewContainer.addEventListener('wheel', (event) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;
    if (!cmdOrCtrl) return;

    event.preventDefault();
    if (event.deltaY < 0) {
      zoomIn();
    } else {
      zoomOut();
    }
  }, { passive: false });
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
