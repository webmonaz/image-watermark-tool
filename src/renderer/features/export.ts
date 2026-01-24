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
// Progress Helpers
// ============================================================================

type ProgressStage = 'preparing' | 'processing' | 'saving' | 'done';

function getImageLabel(count: number): string {
  return count === 1 ? 'image' : 'images';
}

function getProgressPercent(stage: ProgressStage, completed: number, total: number): number {
  if (total === 0) return 0;

  switch (stage) {
    case 'saving':
      return Math.min(99, ((completed + 0.5) / total) * 100);
    case 'processing':
    case 'preparing':
      return Math.min(99, (completed / total) * 100);
    case 'done':
    default:
      return Math.min(100, (completed / total) * 100);
  }
}

function formatProgressText(
  stage: ProgressStage,
  completed: number,
  total: number,
  currentIndex?: number,
  fileName?: string
): string {
  const label = getImageLabel(total);
  const fileSuffix = fileName ? ` - ${fileName}` : '';

  switch (stage) {
    case 'preparing':
      return `Preparing ${total} ${label}...`;
    case 'processing':
      return `Processing ${currentIndex ?? completed + 1} of ${total} ${label}${fileSuffix}`;
    case 'saving':
      return `Saving ${currentIndex ?? completed + 1} of ${total} ${label}${fileSuffix}`;
    case 'done':
    default:
      return `${completed} of ${total} ${label} processed`;
  }
}

function updateProgressDisplay(
  stage: ProgressStage,
  completed: number,
  total: number,
  currentIndex?: number,
  fileName?: string
): void {
  const percent = getProgressPercent(stage, completed, total);
  elements.progressBar.style.width = `${percent}%`;
  elements.progressText.textContent = formatProgressText(stage, completed, total, currentIndex, fileName);
}

function waitForProgressPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
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
  updateProgressDisplay('preparing', 0, 1);
  await waitForProgressPaint();
  
  const workerUrl = new URL('../../worker/imageProcessor.worker.ts', import.meta.url);
  
  try {
    updateProgressDisplay('processing', 0, 1, 1, image.fileName);
    await waitForProgressPaint();
    const result = await processImageWithWorker(image, workerUrl.href);
    
    if (result.success && result.processedData) {
      updateProgressDisplay('saving', 0, 1, 1, image.fileName);
      await waitForProgressPaint();
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

  updateProgressDisplay('done', 1, 1);
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
  updateProgressDisplay('preparing', 0, state.images.length);
  await waitForProgressPaint();
  
  const workerUrl = new URL('../../worker/imageProcessor.worker.ts', import.meta.url);
  
  let processed = 0;
  let permissionError = false;
  
  for (const image of state.images) {
    if (state.cancelExport) break;

    try {
      updateProgressDisplay('processing', processed, state.images.length, processed + 1, image.fileName);
      await waitForProgressPaint();
      const result = await processImageWithWorker(image, workerUrl.href);
      
      if (result.success && result.processedData) {
        updateProgressDisplay('saving', processed, state.images.length, processed + 1, image.fileName);
        await waitForProgressPaint();
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
    updateProgressDisplay('done', processed, state.images.length);
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
