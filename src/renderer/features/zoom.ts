// ============================================================================
// Zoom Controls
// ============================================================================

import { state } from '../state';
import { elements } from '../ui/elements';
import { updatePreview } from './preview';

// ============================================================================
// Zoom Level Management
// ============================================================================

export function setZoom(level: number): void {
  // Clamp between 25% and 400%
  state.zoom.level = Math.max(25, Math.min(400, level));
  updateZoomDisplay();
  updatePreview();
}

export function zoomIn(): void {
  setZoom(state.zoom.level + state.settings.zoomStep);
}

export function zoomOut(): void {
  setZoom(state.zoom.level - state.settings.zoomStep);
}

export function zoomToFit(): void {
  setZoom(100);
  state.zoom.panX = 0;
  state.zoom.panY = 0;
}

export function zoomToActual(): void {
  setZoom(100);
}

// ============================================================================
// Zoom Display Update
// ============================================================================

export function updateZoomDisplay(): void {
  const zoomValue = document.getElementById('zoom-value');
  if (zoomValue) {
    zoomValue.textContent = `${state.zoom.level}%`;
  }
}

// ============================================================================
// Zoom Control Event Listeners
// ============================================================================

export function setupZoomControlListeners(): void {
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
