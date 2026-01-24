// ============================================================================
// Undo/Redo History Management
// ============================================================================

import { state, type HistoryEntry } from '../state';
import { elements } from '../ui/elements';
import { deepCloneWatermarkSettings } from '../utils';
import { syncUIWithSelectedImage } from './preview';

// Forward declaration - will be set by preview module
let updatePreviewFn: (() => void) | null = null;

export function setUpdatePreviewFn(fn: () => void): void {
  updatePreviewFn = fn;
}

// ============================================================================
// History Stack Operations
// ============================================================================

export function pushToUndoStack(entry: HistoryEntry): void {
  state.undoStack.push(entry);
  // Limit stack size
  if (state.undoStack.length > 50) {
    state.undoStack.shift();
  }
  // Clear redo stack when new action is performed
  state.redoStack = [];
  updateUndoRedoButtons();
}

export function undo(): void {
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
    const currentSettings = new Map<string, import('../../types').WatermarkSettings>();
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
  if (updatePreviewFn) updatePreviewFn();
}

export function redo(): void {
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
    const currentSettings = new Map<string, import('../../types').WatermarkSettings>();
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
  if (updatePreviewFn) updatePreviewFn();
}

export function updateUndoRedoButtons(): void {
  if (elements.btnUndo) {
    elements.btnUndo.disabled = state.undoStack.length === 0;
  }
  if (elements.btnRedo) {
    elements.btnRedo.disabled = state.redoStack.length === 0;
  }
}
