// ============================================================================
// Application State Management
// ============================================================================

import type {
  ImageItem,
  WatermarkSettings,
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
  previousSettings: WatermarkSettings;
  newSettings: WatermarkSettings;
  allPreviousSettings?: Map<string, WatermarkSettings>;
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
  globalWatermarkSettings: WatermarkSettings;
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
