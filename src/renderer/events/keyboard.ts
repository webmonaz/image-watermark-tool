// ============================================================================
// Keyboard Shortcuts
// ============================================================================

import { state } from '../state';
import { undo, redo } from '../features/history';
import { removeImage, selectPreviousImage, selectNextImage } from '../features/imageList';
import { saveProject, openProject, newProject } from '../features/project';
import { showSettingsModal } from '../features/settings';
import { zoomIn, zoomOut, zoomToFit, zoomToActual } from '../features/zoom';

// ============================================================================
// Input Focus Check
// ============================================================================

function isInputFocused(): boolean {
  const active = document.activeElement;
  return active instanceof HTMLInputElement || 
         active instanceof HTMLTextAreaElement || 
         active instanceof HTMLSelectElement;
}

// ============================================================================
// Keyboard Shortcuts Setup
// ============================================================================

export function setupKeyboardShortcuts(): void {
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

    // Cmd/Ctrl + N for new project
    if (cmdOrCtrl && e.key === 'n') {
      e.preventDefault();
      newProject();
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
