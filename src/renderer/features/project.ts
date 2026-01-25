// ============================================================================
// Project Save/Load Management
// ============================================================================

import { state } from '../state';
import { elements } from '../ui/elements';
import {
  generateThumbnail,
  THUMBNAIL_SIZE,
  PREVIEW_SIZE,
} from '../utils';
import { migrateProjectFile, ensureImageHasLayerStack } from '../utils/migration';
import { updateUI } from './imageList';
import { syncUIWithSelectedImage, setCachedWatermarkImage } from './preview';
import { saveSettings, syncExportSettingsUI } from './settings';
import { updateZoomDisplay } from './zoom';
import type { ImageItem, ProjectFile, WatermarkSettings } from '../../types';

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
    version: '2.0.0',
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
    // Parse and migrate project data if needed
    let projectData = JSON.parse(result.data) as ProjectFile;
    projectData = migrateProjectFile(projectData);

    state.images = [];
    state.selectedImageId = null;
    state.undoStack = [];
    state.redoStack = [];

    // Ensure watermark settings have layer stack
    state.globalWatermarkSettings = ensureImageHasLayerStack(
      projectData.settings.globalWatermarkSettings
    );
    // Also update global layer stack
    if (state.globalWatermarkSettings.layerStack) {
      state.globalLayerStack = state.globalWatermarkSettings.layerStack;
    }
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
          watermarkSettings: ensureImageHasLayerStack(imgRef.watermarkSettings),
          cropSettings: imgRef.cropSettings,
          processed: false,
          processing: false,
          editStatus: 'untouched',
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

// ============================================================================
// New Project
// ============================================================================

function buildDefaultWatermarkSettings(): WatermarkSettings {
  return {
    type: 'image',
    position: state.settings.defaultWatermarkPosition,
    customX: 80,
    customY: 80,
    scale: 20,
    imageConfig: undefined,
    textConfig: {
      text: '',
      fontFamily: 'Arial',
      fontSize: 24,
      fontColor: '#ffffff',
      opacity: 80,
      bold: false,
      italic: false,
    },
  };
}

export function newProject(): void {
  if (state.hasUnsavedChanges && state.images.length > 0) {
    const shouldContinue = confirm(
      'You have unsaved changes. Do you want to start a new project without saving?'
    );
    if (!shouldContinue) return;
  }

  state.images = [];
  state.selectedImageId = null;
  state.undoStack = [];
  state.redoStack = [];
  state.currentProjectPath = null;
  state.hasUnsavedChanges = false;

  state.globalWatermarkSettings = buildDefaultWatermarkSettings();
  state.globalLayerStack = { layers: [], selectedLayerId: null };
  state.exportFormat = state.settings.defaultExportFormat;
  state.exportQuality = state.settings.defaultExportQuality;
  state.exportScale = state.settings.defaultExportScale;
  state.zoom.level = state.settings.defaultZoom;
  state.zoom.panX = 0;
  state.zoom.panY = 0;
  state.zoom.isPanning = false;

  setCachedWatermarkImage(null);
  elements.watermarkPreview.style.display = 'none';
  elements.watermarkPreviewImg.src = '';

  elements.watermarkTypeRadios.forEach(radio => {
    radio.checked = radio.value === 'image';
  });
  elements.imageWatermarkControls.style.display = 'block';
  elements.textWatermarkControls.style.display = 'none';
  elements.watermarkPosition.value = state.globalWatermarkSettings.position;
  elements.watermarkScale.value = state.globalWatermarkSettings.scale.toString();
  elements.watermarkScaleValue.textContent = state.globalWatermarkSettings.scale.toString();
  const defaultOpacity = state.globalWatermarkSettings.textConfig?.opacity ?? 80;
  elements.watermarkOpacity.value = defaultOpacity.toString();
  elements.watermarkOpacityValue.textContent = defaultOpacity.toString();

  if (state.globalWatermarkSettings.textConfig) {
    elements.watermarkText.value = state.globalWatermarkSettings.textConfig.text;
    elements.watermarkFont.value = state.globalWatermarkSettings.textConfig.fontFamily;
    elements.watermarkColor.value = state.globalWatermarkSettings.textConfig.fontColor;
    elements.watermarkBold.checked = state.globalWatermarkSettings.textConfig.bold;
    elements.watermarkItalic.checked = state.globalWatermarkSettings.textConfig.italic;
  }

  elements.cropPreset.value = 'original';

  updateUI();
  syncExportSettingsUI();
  updateWindowTitle();
  updateZoomDisplay();
}
