// ============================================================================
// Event Listeners Setup
// ============================================================================

import { state, getSelectedImage, markUnsavedChanges } from '../state';
import { elements } from '../ui/elements';
import { deepCloneWatermarkSettings } from '../utils';
import { undo, redo, pushToUndoStack } from '../features/history';
import { updatePreview, updateImageEditStatus } from '../features/preview';
import { updateUI } from '../features/imageList';
import { 
  loadWatermarkImage, 
  updateSelectedImageWatermarkSettings,
  applyWatermarkSettingsToAll,
  hideConfirmModal,
  getConfirmCallback
} from '../features/watermark';
import { 
  updateCropOverlayPosition, 
  getPresetAspectRatio, 
  calculateCenteredCrop 
} from '../features/crop';
import { exportAllImages, exportSingleImage } from '../features/export';
import { saveProject, openProject } from '../features/project';
import { showSettingsModal } from '../features/settings';
import { addImages } from './images';
import type { 
  WatermarkType, 
  WatermarkPosition, 
  CropPreset, 
  ExportFormat 
} from '../../types';

// ============================================================================
// Main Event Listeners
// ============================================================================

export function setupEventListeners(): void {
  let resizeAnimationFrame: number | null = null;

  // Add images button
  elements.btnAddImages.addEventListener('click', async () => {
    const result = await window.electronAPI.selectImages();
    if (!result.canceled && result.filePaths.length > 0) {
      await addImages(result.filePaths);
    }
  });
  
  // Export all button
  elements.btnExportAll.addEventListener('click', () => {
    exportAllImages();
  });

  // Export selected button
  elements.btnExportSelected.addEventListener('click', () => {
    const selectedImage = getSelectedImage();
    if (selectedImage) {
      exportSingleImage(selectedImage);
    }
  });
  
  // Undo/Redo buttons
  if (elements.btnUndo) {
    elements.btnUndo.addEventListener('click', undo);
  }
  if (elements.btnRedo) {
    elements.btnRedo.addEventListener('click', redo);
  }
  
  // Clear all button
  elements.btnClearAll.addEventListener('click', () => {
    state.images = [];
    state.selectedImageId = null;
    state.undoStack = [];
    state.redoStack = [];
    updateUI();
  });
  
  // Watermark type selection
  elements.watermarkTypeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      const type = radio.value as WatermarkType;
      
      updateSelectedImageWatermarkSettings(settings => {
        settings.type = type;
      });
      
      if (type === 'image') {
        elements.imageWatermarkControls.style.display = 'block';
        elements.textWatermarkControls.style.display = 'none';
      } else {
        elements.imageWatermarkControls.style.display = 'none';
        elements.textWatermarkControls.style.display = 'block';
      }
    });
  });
  
  // Select watermark image
  elements.btnSelectWatermark.addEventListener('click', async () => {
    const result = await window.electronAPI.selectWatermarkImage();
    if (!result.canceled && result.filePath) {
      await loadWatermarkImage(result.filePath);
    }
  });
  
  // Remove watermark
  elements.btnRemoveWatermark.addEventListener('click', () => {
    state.images.forEach(img => {
      img.watermarkSettings.imageConfig = undefined;
    });
    state.globalWatermarkSettings.imageConfig = undefined;
    elements.watermarkPreview.style.display = 'none';
    updatePreview();
  });
  
  // Text watermark inputs
  elements.watermarkText.addEventListener('input', () => {
    updateSelectedImageWatermarkSettings(settings => {
      if (settings.textConfig) {
        settings.textConfig.text = elements.watermarkText.value;
      }
    }, false);
  });
  
  elements.watermarkText.addEventListener('change', () => {
    const selectedImage = getSelectedImage();
    if (selectedImage) {
      pushToUndoStack({
        type: 'single',
        imageId: selectedImage.id,
        previousSettings: deepCloneWatermarkSettings(selectedImage.watermarkSettings),
        newSettings: deepCloneWatermarkSettings(selectedImage.watermarkSettings),
      });
    }
  });
  
  elements.watermarkFont.addEventListener('change', () => {
    updateSelectedImageWatermarkSettings(settings => {
      if (settings.textConfig) {
        settings.textConfig.fontFamily = elements.watermarkFont.value;
      }
    });
  });
  
  elements.watermarkColor.addEventListener('input', () => {
    updateSelectedImageWatermarkSettings(settings => {
      if (settings.textConfig) {
        settings.textConfig.fontColor = elements.watermarkColor.value;
      }
    }, false);
  });
  
  elements.watermarkBold.addEventListener('change', () => {
    updateSelectedImageWatermarkSettings(settings => {
      if (settings.textConfig) {
        settings.textConfig.bold = elements.watermarkBold.checked;
      }
    });
  });
  
  elements.watermarkItalic.addEventListener('change', () => {
    updateSelectedImageWatermarkSettings(settings => {
      if (settings.textConfig) {
        settings.textConfig.italic = elements.watermarkItalic.checked;
      }
    });
  });
  
  // Watermark position
  elements.watermarkPosition.addEventListener('change', () => {
    updateSelectedImageWatermarkSettings(settings => {
      settings.position = elements.watermarkPosition.value as WatermarkPosition;
    });
  });
  
  // Watermark scale
  elements.watermarkScale.addEventListener('input', () => {
    const value = parseInt(elements.watermarkScale.value);
    elements.watermarkScaleValue.textContent = value.toString();
    
    updateSelectedImageWatermarkSettings(settings => {
      settings.scale = value;
    }, false);
  });
  
  elements.watermarkScale.addEventListener('change', () => {
    const selectedImage = getSelectedImage();
    if (selectedImage) {
      pushToUndoStack({
        type: 'single',
        imageId: selectedImage.id,
        previousSettings: deepCloneWatermarkSettings(selectedImage.watermarkSettings),
        newSettings: deepCloneWatermarkSettings(selectedImage.watermarkSettings),
      });
    }
  });
  
  // Watermark opacity
  elements.watermarkOpacity.addEventListener('input', () => {
    const value = parseInt(elements.watermarkOpacity.value);
    elements.watermarkOpacityValue.textContent = value.toString();
    
    updateSelectedImageWatermarkSettings(settings => {
      if (settings.type === 'image' && settings.imageConfig) {
        settings.imageConfig.opacity = value;
      } else if (settings.textConfig) {
        settings.textConfig.opacity = value;
      }
    }, false);
  });
  
  // Apply to all button
  if (elements.btnApplyToAll) {
    elements.btnApplyToAll.addEventListener('click', applyWatermarkSettingsToAll);
  }
  
  // Confirmation modal buttons
  if (elements.btnConfirmYes) {
    elements.btnConfirmYes.addEventListener('click', () => {
      const confirmCallback = getConfirmCallback();
      if (confirmCallback) {
        confirmCallback();
      }
      hideConfirmModal();
    });
  }
  
  if (elements.btnConfirmNo) {
    elements.btnConfirmNo.addEventListener('click', hideConfirmModal);
  }
  
  // Crop preset
  elements.cropPreset.addEventListener('change', () => {
    const preset = elements.cropPreset.value as CropPreset;
    const selectedImage = getSelectedImage();
    if (selectedImage) {
      selectedImage.cropSettings.preset = preset;

      if (preset === 'original') {
        selectedImage.cropSettings.x = 0;
        selectedImage.cropSettings.y = 0;
        selectedImage.cropSettings.width = 100;
        selectedImage.cropSettings.height = 100;
      } else if (preset === 'freeform') {
        // Keep current crop
      } else {
        const aspectRatio = getPresetAspectRatio(preset);
        if (aspectRatio !== null) {
          const imgRatio = selectedImage.width / selectedImage.height;
          const centeredCrop = calculateCenteredCrop(imgRatio, aspectRatio);
          selectedImage.cropSettings.x = centeredCrop.x;
          selectedImage.cropSettings.y = centeredCrop.y;
          selectedImage.cropSettings.width = centeredCrop.width;
          selectedImage.cropSettings.height = centeredCrop.height;
        }
      }

      updateCropOverlayPosition();
      updatePreview();
      markUnsavedChanges();
      
      // Update edit status (thumbnail will be captured on focus lost)
      updateImageEditStatus(selectedImage);
    }
  });
  
  // Export format
  elements.exportFormat.addEventListener('change', () => {
    state.exportFormat = elements.exportFormat.value as ExportFormat;
    
    if (state.exportFormat === 'png') {
      elements.qualityControl.style.display = 'none';
    } else {
      elements.qualityControl.style.display = 'block';
    }
  });
  
  // Export quality
  elements.exportQuality.addEventListener('input', () => {
    const value = parseInt(elements.exportQuality.value);
    state.exportQuality = value;
    elements.exportQualityValue.textContent = value.toString();
  });

  // Export scale
  elements.exportScale.addEventListener('input', () => {
    const value = parseInt(elements.exportScale.value);
    state.exportScale = value;
    elements.exportScaleValue.textContent = value.toString();
  });
  
  // Cancel export
  elements.btnCancelExport.addEventListener('click', () => {
    state.cancelExport = true;
  });
  
  // Window resize
  window.addEventListener('resize', () => {
    const selectedImage = getSelectedImage();
    if (selectedImage) {
      if (resizeAnimationFrame !== null) {
        cancelAnimationFrame(resizeAnimationFrame);
      }
      resizeAnimationFrame = requestAnimationFrame(() => {
        resizeAnimationFrame = null;
        updatePreview();
      });
    }
  });
}

// ============================================================================
// Project Button Listeners
// ============================================================================

export function setupProjectButtonListeners(): void {
  const btnSave = document.getElementById('btn-save-project');
  const btnOpen = document.getElementById('btn-open-project');
  const btnSettings = document.getElementById('btn-settings');
  const { btnAbout, aboutModal, btnCloseAbout, btnAboutClose } = elements;
  
  if (btnSave) {
    btnSave.addEventListener('click', () => saveProject(false));
  }
  if (btnOpen) {
    btnOpen.addEventListener('click', openProject);
  }
  if (btnSettings) {
    btnSettings.addEventListener('click', showSettingsModal);
  }
  if (btnAbout && aboutModal) {
    btnAbout.addEventListener('click', () => {
      aboutModal.style.display = 'flex';
    });
  }
  if (aboutModal && btnCloseAbout) {
    btnCloseAbout.addEventListener('click', () => {
      aboutModal.style.display = 'none';
    });
  }
  if (aboutModal && btnAboutClose) {
    btnAboutClose.addEventListener('click', () => {
      aboutModal.style.display = 'none';
    });
  }
}
