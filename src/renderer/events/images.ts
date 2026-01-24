// ============================================================================
// Image Loading and Management
// ============================================================================

import { state, markUnsavedChanges } from '../state';
import { 
  generateId, 
  getImageDimensions, 
  generateThumbnail, 
  deepCloneWatermarkSettings,
  THUMBNAIL_SIZE,
  PREVIEW_SIZE 
} from '../utils';
import { updateUI } from '../features/imageList';
import { syncUIWithSelectedImage } from '../features/preview';
import type { ImageItem } from '../../types';

// ============================================================================
// Add Images from File Paths
// ============================================================================

export async function addImages(filePaths: string[]): Promise<void> {
  for (const filePath of filePaths) {
    try {
      const dataUrl = await window.electronAPI.readImageAsBase64(filePath);
      const { width, height } = await getImageDimensions(dataUrl);
      const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || 'image';
      
      const [thumbnailData, previewData] = await Promise.all([
        generateThumbnail(dataUrl, THUMBNAIL_SIZE),
        generateThumbnail(dataUrl, PREVIEW_SIZE),
      ]);
      
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
        editStatus: 'untouched',
      };
      
      state.images.push(imageItem);
    } catch (error) {
      console.error('Failed to load image:', filePath, error);
    }
  }
  
  if (!state.selectedImageId && state.images.length > 0) {
    state.selectedImageId = state.images[0].id;
  }
  
  if (filePaths.length > 0) {
    markUnsavedChanges();
  }
  
  updateUI();
  syncUIWithSelectedImage();
}
