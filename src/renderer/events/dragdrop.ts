// ============================================================================
// Drag and Drop Handling
// ============================================================================

import { state, markUnsavedChanges } from '../state';
import { elements } from '../ui/elements';
import { 
  generateId, 
  getImageDimensions, 
  generateThumbnail, 
  readFileAsDataUrl,
  deepCloneWatermarkSettings,
  THUMBNAIL_SIZE,
  PREVIEW_SIZE 
} from '../utils';
import { updateUI } from '../features/imageList';
import { syncUIWithSelectedImage } from '../features/preview';
import type { ImageItem } from '../../types';

// ============================================================================
// Drag and Drop Setup
// ============================================================================

export function setupDragAndDrop(): void {
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

// ============================================================================
// Drop Handler
// ============================================================================

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
  
  for (const file of imageFiles) {
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const { width, height } = await getImageDimensions(dataUrl);
      
      const [thumbnailData, previewData] = await Promise.all([
        generateThumbnail(dataUrl, THUMBNAIL_SIZE),
        generateThumbnail(dataUrl, PREVIEW_SIZE),
      ]);
      
      const imageSettings = deepCloneWatermarkSettings(state.globalWatermarkSettings);
      
      const imageItem: ImageItem = {
        id: generateId(),
        fileName: file.name,
        filePath: file.name,
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
  
  if (imageFiles.length > 0) {
    markUnsavedChanges();
  }
  
  updateUI();
  syncUIWithSelectedImage();
}
