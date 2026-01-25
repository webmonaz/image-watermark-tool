// ============================================================================
// Application State Management
// ============================================================================

import type {
  ImageItem,
  WatermarkSettings,
  WatermarkLayer,
  WatermarkLayerStack,
  ExportFormat,
  AppSettings,
  ZoomState,
} from '../../types';

// ============================================================================
// History Entry Type (for Undo/Redo)
// ============================================================================

export interface HistoryEntry {
  type: 'single' | 'all';
  imageId?: string;
  /** @deprecated Use previousLayerStack instead */
  previousSettings?: WatermarkSettings;
  /** @deprecated Use newLayerStack instead */
  newSettings?: WatermarkSettings;
  /** Previous layer stack state for undo */
  previousLayerStack?: WatermarkLayerStack;
  /** New layer stack state for redo */
  newLayerStack?: WatermarkLayerStack;
  allPreviousSettings?: Map<string, WatermarkSettings>;
  allPreviousLayerStacks?: Map<string, WatermarkLayerStack>;
}

// ============================================================================
// Default Settings
// ============================================================================

export const DEFAULT_SETTINGS: AppSettings = {
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
  showThumbnailLabels: true,
  thumbnailLabelOpacity: 80,
};

// ============================================================================
// App State Interface
// ============================================================================

export interface AppState {
  images: ImageItem[];
  selectedImageId: string | null;
  /** @deprecated Use globalLayerStack instead for new watermark system */
  globalWatermarkSettings: WatermarkSettings;
  /** Global layer stack template for new images */
  globalLayerStack: WatermarkLayerStack;
  exportFormat: ExportFormat;
  exportQuality: number;
  exportFolder: string;
  exportScale: number;
  isExporting: boolean;
  cancelExport: boolean;
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
  settings: AppSettings;
  zoom: ZoomState;
  currentProjectPath: string | null;
  hasUnsavedChanges: boolean;
}

// ============================================================================
// Initial State
// ============================================================================

export const state: AppState = {
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
  globalLayerStack: {
    layers: [],
    selectedLayerId: null,
  },
  exportFormat: 'png',
  exportQuality: 85,
  exportFolder: '',
  exportScale: 100,
  isExporting: false,
  cancelExport: false,
  undoStack: [],
  redoStack: [],
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
// State Helpers
// ============================================================================

export function getSelectedImage(): ImageItem | undefined {
  return state.images.find(img => img.id === state.selectedImageId);
}

export function markUnsavedChanges(): void {
  if (!state.hasUnsavedChanges) {
    state.hasUnsavedChanges = true;
  }
}

/**
 * Generate a unique ID for watermark layers
 */
export function generateLayerId(): string {
  return `layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get the currently selected watermark layer from the selected image
 */
export function getSelectedLayer(): WatermarkLayer | undefined {
  const image = getSelectedImage();
  if (!image?.watermarkSettings.layerStack) return undefined;

  const layerId = image.watermarkSettings.layerStack.selectedLayerId;
  if (!layerId) return undefined;

  return image.watermarkSettings.layerStack.layers.find(l => l.id === layerId);
}

/**
 * Get the layer stack from the selected image, falling back to empty stack
 */
export function getSelectedImageLayerStack(): WatermarkLayerStack {
  const image = getSelectedImage();
  if (!image?.watermarkSettings.layerStack) {
    return { layers: [], selectedLayerId: null };
  }
  return image.watermarkSettings.layerStack;
}
