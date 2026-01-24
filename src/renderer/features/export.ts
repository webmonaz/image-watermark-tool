// ============================================================================
// Export Processing
// ============================================================================

import { state } from '../state';
import { elements } from '../ui/elements';
import type { 
  ImageItem, 
  ProcessImageMessage, 
  ProcessImageResult 
} from '../../types';
import { markImageExported } from './preview';
import { renderImageList } from './imageList';

// ============================================================================
// Export Folder Selection
// ============================================================================

export async function promptForExportFolder(): Promise<boolean> {
  const result = await window.electronAPI.selectExportFolder();
  if (!result.canceled && result.folderPath) {
    state.exportFolder = result.folderPath;
    if (elements.exportFolderPath) {
      elements.exportFolderPath.textContent = result.folderPath;
    }
    return true;
  }
  
  return false;
}

// ============================================================================
// Worker Processing
// ============================================================================

function processImageWithWorker(image: ImageItem, workerUrl: string): Promise<ProcessImageResult> {
  return new Promise((resolve) => {
    const worker = new Worker(workerUrl, { type: 'module' });
    
    worker.onmessage = (event: MessageEvent<ProcessImageResult>) => {
      worker.terminate();
      resolve(event.data);
    };
    
    worker.onerror = (error) => {
      worker.terminate();
      resolve({
        type: 'result',
        success: false,
        error: error.message,
      });
    };
    
    const message: ProcessImageMessage = {
      type: 'process',
      imageData: image.originalData,
      imageWidth: image.width,
      imageHeight: image.height,
      watermarkSettings: image.watermarkSettings,
      cropSettings: image.cropSettings,
      exportFormat: state.exportFormat,
      quality: state.exportQuality,
      exportScale: state.exportScale,
    };
    
    worker.postMessage(message);
  });
}

// ============================================================================
// Single Image Export
// ============================================================================

export async function exportSingleImage(image: ImageItem): Promise<void> {
  if (state.isExporting) return;
  
  const hasExportFolder = await promptForExportFolder();
  if (!hasExportFolder || !state.exportFolder) return;
  
  state.isExporting = true;
  state.cancelExport = false;
  
  elements.progressOverlay.style.display = 'flex';
  elements.progressBar.style.width = '0%';
  elements.progressText.textContent = '0 of 1 images processed';
  
  const workerUrl = new URL('../../worker/imageProcessor.worker.ts', import.meta.url);
  
  try {
    const result = await processImageWithWorker(image, workerUrl.href);
    
    if (result.success && result.processedData) {
      const exportResult = await window.electronAPI.exportImage({
        base64Data: result.processedData,
        fileName: image.fileName,
        folderPath: state.exportFolder,
        format: state.exportFormat,
      });
      
      if (exportResult.success) {
        image.processed = true;
        markImageExported(image);
        renderImageList();
      } else {
        image.error = exportResult.error || 'Export failed';
      }
    } else {
      image.error = result.error || 'Unknown error';
    }
  } catch (error) {
    image.error = error instanceof Error ? error.message : 'Unknown error';
  }
  
  elements.progressBar.style.width = '100%';
  elements.progressText.textContent = '1 of 1 images processed';
  state.isExporting = false;
  elements.progressOverlay.style.display = 'none';
  
  if (image.error) {
    alert(`Export failed: ${image.error}`);
  } else {
    alert(`Export complete! 1 image saved to ${state.exportFolder}`);
  }
}

// ============================================================================
// Batch Export
// ============================================================================

export async function exportAllImages(): Promise<void> {
  if (state.images.length === 0) return;
  
  const hasExportFolder = await promptForExportFolder();
  if (!hasExportFolder || !state.exportFolder) return;
  
  state.isExporting = true;
  state.cancelExport = false;
  
  elements.progressOverlay.style.display = 'flex';
  elements.progressBar.style.width = '0%';
  elements.progressText.textContent = `0 of ${state.images.length} images processed`;
  
  const workerUrl = new URL('../../worker/imageProcessor.worker.ts', import.meta.url);
  
  let processed = 0;
  let permissionError = false;
  
  for (const image of state.images) {
    if (state.cancelExport) break;
    
    try {
      const result = await processImageWithWorker(image, workerUrl.href);
      
      if (result.success && result.processedData) {
        const exportResult = await window.electronAPI.exportImage({
          base64Data: result.processedData,
          fileName: image.fileName,
          folderPath: state.exportFolder,
          format: state.exportFormat,
        });
        
        if (exportResult.success) {
          image.processed = true;
          markImageExported(image);
        } else {
          image.error = exportResult.error || 'Export failed';
          if (exportResult.error?.includes('Permission denied')) {
            permissionError = true;
            state.cancelExport = true;
          }
        }
      } else {
        image.error = result.error || 'Unknown error';
      }
    } catch (error) {
      image.error = error instanceof Error ? error.message : 'Unknown error';
    }
    
    processed++;
    const percent = (processed / state.images.length) * 100;
    elements.progressBar.style.width = `${percent}%`;
    elements.progressText.textContent = `${processed} of ${state.images.length} images processed`;
  }
  
  state.isExporting = false;
  elements.progressOverlay.style.display = 'none';
  
  // Update image list to show exported status
  renderImageList();
  
  if (!state.cancelExport || permissionError) {
    const errorCount = state.images.filter((item) => item.error).length;
    if (errorCount > 0) {
      alert(
        `Export finished with ${errorCount} errors. Check file permissions and choose an export folder that macOS allows.`,
      );
    } else {
      alert(`Export complete! ${processed} images saved to ${state.exportFolder}`);
    }
  }
}
