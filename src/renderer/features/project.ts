// ============================================================================
// Project Save/Load Management
// ============================================================================

import { state } from '../state';
import { elements } from '../ui/elements';
import { 
  generateThumbnail, 
  THUMBNAIL_SIZE, 
  PREVIEW_SIZE 
} from '../utils';
import { updateUI } from './imageList';
import { syncUIWithSelectedImage } from './preview';
import { saveSettings, syncExportSettingsUI } from './settings';
import type { ImageItem, ProjectFile } from '../../types';

// ============================================================================
// Window Title
// ============================================================================

export function updateWindowTitle(): void {
  const defaultName = 'Untitled.iwp';
  const baseName = state.currentProjectPath
    ? state.currentProjectPath.split('/').pop()?.split('\\').pop() || defaultName
    : defaultName;
  const unsavedMarker = state.hasUnsavedChanges ? ' *' : '';
  const displayName = `${baseName}${unsavedMarker}`;
  document.title = `${displayName} - Image Watermark Tool`;
  if (elements.projectTitle) {
    elements.projectTitle.textContent = displayName;
  }
}

// ============================================================================
// Recent Projects
// ============================================================================

function addToRecentProjects(filePath: string): void {
  state.settings.recentProjects = state.settings.recentProjects.filter((p: string) => p !== filePath);
  state.settings.recentProjects.unshift(filePath);
  
  if (state.settings.recentProjects.length > state.settings.maxRecentProjects) {
    state.settings.recentProjects = state.settings.recentProjects.slice(0, state.settings.maxRecentProjects);
  }
  
  saveSettings();
}

// ============================================================================
// Save Project
// ============================================================================

export async function saveProject(saveAs = false): Promise<void> {
  if (state.images.length === 0) {
    alert('No images to save. Add some images first.');
    return;
  }
  
  const projectData: ProjectFile = {
    version: '1.0.0',
    savedAt: new Date().toISOString(),
    settings: {
      globalWatermarkSettings: state.globalWatermarkSettings,
      exportFormat: state.exportFormat,
      exportQuality: state.exportQuality,
      exportScale: state.exportScale,
    },
    images: state.images.map(img => ({
      id: img.id,
      fileName: img.fileName,
      filePath: img.filePath,
      width: img.width,
      height: img.height,
      watermarkSettings: img.watermarkSettings,
      cropSettings: img.cropSettings,
    })),
  };
  
  const filePath = saveAs ? undefined : state.currentProjectPath || undefined;
  
  const result = await window.electronAPI.saveProject({
    projectData: JSON.stringify(projectData, null, 2),
    filePath,
  });
  
  if (result.success && result.filePath) {
    state.currentProjectPath = result.filePath;
    state.hasUnsavedChanges = false;
    updateWindowTitle();
    addToRecentProjects(result.filePath);
  }
}

// ============================================================================
// Open Project
// ============================================================================

export async function openProject(): Promise<void> {
  if (state.hasUnsavedChanges && state.images.length > 0) {
    const shouldContinue = confirm(
      'You have unsaved changes. Do you want to continue without saving?'
    );
    if (!shouldContinue) return;
  }
  
  const result = await window.electronAPI.openProject();
  
  if (result.canceled || !result.success || !result.data) {
    return;
  }
  
  try {
    const projectData = JSON.parse(result.data) as ProjectFile;
    
    state.images = [];
    state.selectedImageId = null;
    state.undoStack = [];
    state.redoStack = [];
    
    state.globalWatermarkSettings = projectData.settings.globalWatermarkSettings;
    state.exportFormat = projectData.settings.exportFormat;
    state.exportQuality = projectData.settings.exportQuality;
    state.exportScale = projectData.settings.exportScale ?? state.settings.defaultExportScale;
    
    const missingFiles: string[] = [];
    
    for (const imgRef of projectData.images) {
      try {
        const fileInfo = await window.electronAPI.getFileInfo(imgRef.filePath);
        
        if (!fileInfo.exists) {
          missingFiles.push(imgRef.fileName);
          continue;
        }
        
        const dataUrl = await window.electronAPI.readImageAsBase64(imgRef.filePath);
        
        const [thumbnailData, previewData] = await Promise.all([
          generateThumbnail(dataUrl, THUMBNAIL_SIZE),
          generateThumbnail(dataUrl, PREVIEW_SIZE),
        ]);
        
        const imageItem: ImageItem = {
          id: imgRef.id,
          fileName: imgRef.fileName,
          filePath: imgRef.filePath,
          originalData: dataUrl,
          width: imgRef.width,
          height: imgRef.height,
          thumbnailData,
          previewData,
          watermarkSettings: imgRef.watermarkSettings,
          cropSettings: imgRef.cropSettings,
          processed: false,
          processing: false,
        };
        
        state.images.push(imageItem);
      } catch (error) {
        console.error('Failed to load image:', imgRef.filePath, error);
        missingFiles.push(imgRef.fileName);
      }
    }
    
    if (state.images.length > 0) {
      state.selectedImageId = state.images[0].id;
    }
    
    state.currentProjectPath = result.filePath || null;
    state.hasUnsavedChanges = false;
    
    updateUI();
    syncUIWithSelectedImage();
    syncExportSettingsUI();
    updateWindowTitle();
    
    if (missingFiles.length > 0) {
      alert(
        `The following files could not be found and were skipped:\n\n${missingFiles.join('\n')}`
      );
    }
    
    if (result.filePath) {
      addToRecentProjects(result.filePath);
    }
  } catch (error) {
    console.error('Failed to parse project file:', error);
    alert('Failed to open project. The file may be corrupted.');
  }
}
