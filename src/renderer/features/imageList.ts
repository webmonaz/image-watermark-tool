// ============================================================================
// Image List Management
// ============================================================================

import { state, markUnsavedChanges } from '../state';
import { elements } from '../ui/elements';
import type { ImageItem } from '../../types';
import { updateUndoRedoButtons } from './history';
import { 
  updateImageCount, 
  syncUIWithSelectedImage, 
  updatePreview 
} from './preview';

// ============================================================================
// Context Menu State
// ============================================================================

let thumbnailContextMenu: HTMLDivElement | null = null;
let contextMenuImageId: string | null = null;

// Forward declaration for export function
let exportSingleImageFn: ((image: ImageItem) => Promise<void>) | null = null;

export function setExportSingleImageFn(fn: (image: ImageItem) => Promise<void>): void {
  exportSingleImageFn = fn;
}

// ============================================================================
// Image List Rendering
// ============================================================================

export function renderImageList(): void {
  const thumbnails = elements.imageList.querySelectorAll('.image-thumbnail');
  thumbnails.forEach(el => el.remove());
  
  state.images.forEach(image => {
    const thumbnail = createThumbnail(image);
    elements.imageList.insertBefore(thumbnail, elements.dropZone);
  });
}

function createThumbnail(image: ImageItem): HTMLDivElement {
  const div = document.createElement('div');
  div.className = `image-thumbnail ${image.id === state.selectedImageId ? 'selected' : ''}`;
  div.dataset.id = image.id;
  
  const hasCustomPosition = image.watermarkSettings.position === 'custom';
  const customIndicator = hasCustomPosition ? '<span class="custom-indicator" title="Custom watermark position">*</span>' : '';
  
  div.innerHTML = `
    <img src="${image.thumbnailData}" alt="${image.fileName}" loading="lazy" />
    <div class="thumbnail-overlay">
      <span class="thumbnail-name">${image.fileName}${customIndicator}</span>
      <button class="thumbnail-remove" title="Remove image">×</button>
    </div>
  `;
  
  div.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).classList.contains('thumbnail-remove')) return;
    selectImage(image.id);
  });

  div.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    selectImage(image.id);
    showThumbnailContextMenu(e.clientX, e.clientY, image.id);
  });
  
  const removeBtn = div.querySelector('.thumbnail-remove') as HTMLButtonElement;
  removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    removeImage(image.id);
  });
  
  return div;
}

// ============================================================================
// Context Menu
// ============================================================================

export function setupThumbnailContextMenu(): void {
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
    
    if (action === 'export' && exportSingleImageFn) {
      exportSingleImageFn(image);
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

// ============================================================================
// Image Selection and Removal
// ============================================================================

export function selectImage(id: string): void {
  state.selectedImageId = id;
  updateImageCount();
  renderImageList();
  syncUIWithSelectedImage();
  updatePreview();
}

export function removeImage(id: string): void {
  state.images = state.images.filter(img => img.id !== id);
  if (state.selectedImageId === id) {
    state.selectedImageId = state.images[0]?.id || null;
  }
  markUnsavedChanges();
  updateUI();
}

// ============================================================================
// Image Navigation
// ============================================================================

export function selectPreviousImage(): void {
  if (state.images.length === 0) return;
  
  const currentIndex = state.images.findIndex(img => img.id === state.selectedImageId);
  const prevIndex = currentIndex <= 0 ? state.images.length - 1 : currentIndex - 1;
  selectImage(state.images[prevIndex].id);
}

export function selectNextImage(): void {
  if (state.images.length === 0) return;
  
  const currentIndex = state.images.findIndex(img => img.id === state.selectedImageId);
  const nextIndex = currentIndex >= state.images.length - 1 ? 0 : currentIndex + 1;
  selectImage(state.images[nextIndex].id);
}

// ============================================================================
// Full UI Update
// ============================================================================

export function updateUI(): void {
  updateImageCount();
  renderImageList();
  updatePreview();
  updateUndoRedoButtons();
}
