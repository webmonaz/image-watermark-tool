// ============================================================================
// Renderer Process - Main Entry Point
// ============================================================================

import '../index.css';

// State
import { state } from './state';

// Features
import { setUpdatePreviewFn } from './features/history';
import { 
  updatePreview, 
  setUpdateCropOverlayPositionFn,
  setPositionWatermarkHandleFn 
} from './features/preview';
import { 
  updateUI, 
  setupThumbnailContextMenu,
  setExportSingleImageFn 
} from './features/imageList';
import { 
  setupWatermarkDragging,
  positionWatermarkHandle
} from './features/watermark';
import { 
  setupCropInteraction,
  updateCropOverlayPosition 
} from './features/crop';
import { exportSingleImage } from './features/export';
import { updateWindowTitle } from './features/project';
import { 
  loadSettings, 
  syncExportSettingsUI,
  setupSettingsModalListeners,
  applyTheme 
} from './features/settings';
import { setupZoomControlListeners, updateZoomDisplay } from './features/zoom';

// Events
import { setupEventListeners, setupProjectButtonListeners } from './events/setup';
import { setupKeyboardShortcuts } from './events/keyboard';
import { setupDragAndDrop } from './events/dragdrop';

// ============================================================================
// Wire Up Cross-Module Dependencies
// ============================================================================

// Set up circular dependency resolutions
setUpdatePreviewFn(updatePreview);
setUpdateCropOverlayPositionFn(updateCropOverlayPosition);
setPositionWatermarkHandleFn(positionWatermarkHandle);
setExportSingleImageFn(exportSingleImage);

// ============================================================================
// Initialize Application
// ============================================================================

async function init(): Promise<void> {
  // Load settings first
  await loadSettings();
  
  // Setup all event listeners and interactions
  setupEventListeners();
  setupDragAndDrop();
  setupThumbnailContextMenu();
  setupWatermarkDragging();
  setupCropInteraction();
  setupKeyboardShortcuts();
  setupSettingsModalListeners();
  setupProjectButtonListeners();
  setupZoomControlListeners();
  
  // Initial UI updates
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

// ============================================================================
// Start Application
// ============================================================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
