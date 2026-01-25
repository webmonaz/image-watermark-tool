// ============================================================================
// Undo/Redo History Management
// ============================================================================

import { state, type HistoryEntry } from '../state';
import { elements } from '../ui/elements';
import { deepCloneWatermarkSettings, deepCloneLayerStack } from '../utils';
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

// Forward declaration for layer list rendering
let renderLayerListFn: (() => void) | null = null;
let syncLayerSettingsUIFn: (() => void) | null = null;

export function setRenderLayerListFn(fn: () => void): void {
  renderLayerListFn = fn;
}

export function setSyncLayerSettingsUIFn(fn: () => void): void {
  syncLayerSettingsUIFn = fn;
}

export function undo(): void {
  const entry = state.undoStack.pop();
  if (!entry) return;

  if (entry.type === 'single' && entry.imageId) {
    const image = state.images.find(img => img.id === entry.imageId);
    if (image) {
      // Check if this is a layer-based entry
      if (entry.previousLayerStack) {
        // Save current state for redo
        state.redoStack.push({
          type: 'single',
          imageId: entry.imageId,
          previousLayerStack: image.watermarkSettings.layerStack
            ? deepCloneLayerStack(image.watermarkSettings.layerStack)
            : undefined,
          newLayerStack: entry.previousLayerStack,
        });
        // Restore previous layer stack
        image.watermarkSettings.layerStack = deepCloneLayerStack(entry.previousLayerStack);
      } else if (entry.previousSettings) {
        // Legacy: Save current state for redo
        state.redoStack.push({
          type: 'single',
          imageId: entry.imageId,
          previousSettings: deepCloneWatermarkSettings(image.watermarkSettings),
          newSettings: entry.previousSettings,
        });
        // Restore previous settings
        image.watermarkSettings = deepCloneWatermarkSettings(entry.previousSettings);
      }
    }
  } else if (entry.type === 'all') {
    if (entry.allPreviousLayerStacks) {
      // Layer-based: Save current state for redo
      const currentLayerStacks = new Map<string, import('../../types').WatermarkLayerStack>();
      state.images.forEach(img => {
        if (img.watermarkSettings.layerStack) {
          currentLayerStacks.set(img.id, deepCloneLayerStack(img.watermarkSettings.layerStack));
        }
      });

      state.redoStack.push({
        type: 'all',
        previousLayerStack: entry.previousLayerStack,
        newLayerStack: entry.newLayerStack,
        allPreviousLayerStacks: currentLayerStacks,
      });

      // Restore all previous layer stacks
      entry.allPreviousLayerStacks.forEach((layerStack, id) => {
        const image = state.images.find(img => img.id === id);
        if (image) {
          image.watermarkSettings.layerStack = deepCloneLayerStack(layerStack);
        }
      });
    } else if (entry.allPreviousSettings) {
      // Legacy: Save current state for redo
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
  }

  updateUndoRedoButtons();
  syncUIWithSelectedImage();
  if (renderLayerListFn) renderLayerListFn();
  if (syncLayerSettingsUIFn) syncLayerSettingsUIFn();
  if (updatePreviewFn) updatePreviewFn();
}

export function redo(): void {
  const entry = state.redoStack.pop();
  if (!entry) return;

  if (entry.type === 'single' && entry.imageId) {
    const image = state.images.find(img => img.id === entry.imageId);
    if (image) {
      // Check if this is a layer-based entry
      if (entry.newLayerStack) {
        // Save current state for undo
        state.undoStack.push({
          type: 'single',
          imageId: entry.imageId,
          previousLayerStack: image.watermarkSettings.layerStack
            ? deepCloneLayerStack(image.watermarkSettings.layerStack)
            : undefined,
          newLayerStack: entry.newLayerStack,
        });
        // Apply new layer stack
        image.watermarkSettings.layerStack = deepCloneLayerStack(entry.newLayerStack);
      } else if (entry.newSettings) {
        // Legacy: Save current state for undo
        state.undoStack.push({
          type: 'single',
          imageId: entry.imageId,
          previousSettings: deepCloneWatermarkSettings(image.watermarkSettings),
          newSettings: entry.newSettings,
        });
        // Apply new settings
        image.watermarkSettings = deepCloneWatermarkSettings(entry.newSettings);
      }
    }
  } else if (entry.type === 'all') {
    if (entry.allPreviousLayerStacks) {
      // Layer-based: Save current state for undo
      const currentLayerStacks = new Map<string, import('../../types').WatermarkLayerStack>();
      state.images.forEach(img => {
        if (img.watermarkSettings.layerStack) {
          currentLayerStacks.set(img.id, deepCloneLayerStack(img.watermarkSettings.layerStack));
        }
      });

      state.undoStack.push({
        type: 'all',
        previousLayerStack: entry.previousLayerStack,
        newLayerStack: entry.newLayerStack,
        allPreviousLayerStacks: currentLayerStacks,
      });

      // Apply new layer stacks to all
      if (entry.newLayerStack) {
        state.images.forEach(img => {
          img.watermarkSettings.layerStack = deepCloneLayerStack(entry.newLayerStack!);
        });
      }
    } else if (entry.allPreviousSettings && entry.newSettings) {
      // Legacy: Save current state for undo
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
        img.watermarkSettings = deepCloneWatermarkSettings(entry.newSettings!);
      });
    }
  }

  updateUndoRedoButtons();
  syncUIWithSelectedImage();
  if (renderLayerListFn) renderLayerListFn();
  if (syncLayerSettingsUIFn) syncLayerSettingsUIFn();
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
