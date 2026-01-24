// ============================================================================
// Settings Management
// ============================================================================

import { state, DEFAULT_SETTINGS } from '../state';
import { elements } from '../ui/elements';
import type { 
  WatermarkPosition, 
  ExportFormat, 
  PreviewQuality 
} from '../../types';

// ============================================================================
// Theme Management
// ============================================================================

export function applyTheme(theme: 'light' | 'dark' | 'auto'): void {
  document.documentElement.classList.remove('theme-light', 'theme-dark');
  
  if (theme === 'auto') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.add(prefersDark ? 'theme-dark' : 'theme-light');
  } else {
    document.documentElement.classList.add(`theme-${theme}`);
  }
  
  window.electronAPI.setNativeTheme(theme);
}

// ============================================================================
// Settings Persistence
// ============================================================================

export async function loadSettings(): Promise<void> {
  const loadedSettings = await window.electronAPI.loadSettings();
  // Merge with defaults to ensure new fields have values
  state.settings = { ...DEFAULT_SETTINGS, ...loadedSettings };
  
  applyTheme(state.settings.theme);
  
  state.zoom.level = state.settings.defaultZoom;
  state.globalWatermarkSettings.position = state.settings.defaultWatermarkPosition;
  state.exportFormat = state.settings.defaultExportFormat;
  state.exportQuality = state.settings.defaultExportQuality;
  state.exportScale = state.settings.defaultExportScale;
}

export async function saveSettings(): Promise<void> {
  await window.electronAPI.saveSettings(state.settings);
}

// ============================================================================
// Export Settings UI Sync
// ============================================================================

export function syncExportSettingsUI(): void {
  elements.exportFormat.value = state.exportFormat;
  elements.exportQuality.value = state.exportQuality.toString();
  elements.exportQualityValue.textContent = state.exportQuality.toString();
  elements.exportScale.value = state.exportScale.toString();
  elements.exportScaleValue.textContent = state.exportScale.toString();
  
  if (state.exportFormat === 'png') {
    elements.qualityControl.style.display = 'none';
  } else {
    elements.qualityControl.style.display = 'block';
  }
}

// ============================================================================
// Settings Modal
// ============================================================================

export function showSettingsModal(): void {
  const modal = document.getElementById('settings-modal');
  if (modal) {
    const themeSelect = document.getElementById('setting-theme') as HTMLSelectElement;
    const previewQualitySelect = document.getElementById('setting-preview-quality') as HTMLSelectElement;
    const defaultPositionSelect = document.getElementById('setting-default-position') as HTMLSelectElement;
    const defaultFormatSelect = document.getElementById('setting-default-format') as HTMLSelectElement;
    const defaultQualityInput = document.getElementById('setting-default-quality') as HTMLInputElement;
    const defaultScaleInput = document.getElementById('setting-default-scale') as HTMLInputElement;
    const showLabelsCheckbox = document.getElementById('setting-show-labels') as HTMLInputElement;
    const labelOpacityInput = document.getElementById('setting-label-opacity') as HTMLInputElement;
    
    if (themeSelect) themeSelect.value = state.settings.theme;
    if (previewQualitySelect) previewQualitySelect.value = state.settings.previewQuality;
    if (defaultPositionSelect) defaultPositionSelect.value = state.settings.defaultWatermarkPosition;
    if (defaultFormatSelect) defaultFormatSelect.value = state.settings.defaultExportFormat;
    if (defaultQualityInput) {
      defaultQualityInput.value = state.settings.defaultExportQuality.toString();
      const qualityValue = document.getElementById('setting-default-quality-value');
      if (qualityValue) qualityValue.textContent = state.settings.defaultExportQuality.toString();
    }
    if (defaultScaleInput) {
      defaultScaleInput.value = state.settings.defaultExportScale.toString();
      const scaleValue = document.getElementById('setting-default-scale-value');
      if (scaleValue) scaleValue.textContent = state.settings.defaultExportScale.toString();
    }
    if (showLabelsCheckbox) {
      showLabelsCheckbox.checked = state.settings.showThumbnailLabels;
    }
    if (labelOpacityInput) {
      labelOpacityInput.value = state.settings.thumbnailLabelOpacity.toString();
      const opacityValue = document.getElementById('setting-label-opacity-value');
      if (opacityValue) opacityValue.textContent = state.settings.thumbnailLabelOpacity.toString();
    }
    
    modal.style.display = 'flex';
  }
}

export function hideSettingsModal(): void {
  const modal = document.getElementById('settings-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

export function saveSettingsFromModal(): void {
  const themeSelect = document.getElementById('setting-theme') as HTMLSelectElement;
  const previewQualitySelect = document.getElementById('setting-preview-quality') as HTMLSelectElement;
  const defaultPositionSelect = document.getElementById('setting-default-position') as HTMLSelectElement;
  const defaultFormatSelect = document.getElementById('setting-default-format') as HTMLSelectElement;
  const defaultQualityInput = document.getElementById('setting-default-quality') as HTMLInputElement;
  const defaultScaleInput = document.getElementById('setting-default-scale') as HTMLInputElement;
  const showLabelsCheckbox = document.getElementById('setting-show-labels') as HTMLInputElement;
  const labelOpacityInput = document.getElementById('setting-label-opacity') as HTMLInputElement;
  
  if (themeSelect) {
    state.settings.theme = themeSelect.value as 'light' | 'dark' | 'auto';
    applyTheme(state.settings.theme);
  }
  if (previewQualitySelect) {
    state.settings.previewQuality = previewQualitySelect.value as PreviewQuality;
  }
  if (defaultPositionSelect) {
    state.settings.defaultWatermarkPosition = defaultPositionSelect.value as WatermarkPosition;
    state.globalWatermarkSettings.position = state.settings.defaultWatermarkPosition;
  }
  if (defaultFormatSelect) {
    state.settings.defaultExportFormat = defaultFormatSelect.value as ExportFormat;
  }
  if (defaultQualityInput) {
    state.settings.defaultExportQuality = parseInt(defaultQualityInput.value);
  }
  if (defaultScaleInput) {
    state.settings.defaultExportScale = parseInt(defaultScaleInput.value);
    state.exportScale = state.settings.defaultExportScale;
  }
  if (showLabelsCheckbox) {
    state.settings.showThumbnailLabels = showLabelsCheckbox.checked;
  }
  if (labelOpacityInput) {
    state.settings.thumbnailLabelOpacity = parseInt(labelOpacityInput.value);
  }
  
  saveSettings();
  syncExportSettingsUI();
  hideSettingsModal();
}

// ============================================================================
// Settings Modal Event Listeners
// ============================================================================

export function setupSettingsModalListeners(): void {
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const defaultQualityInput = document.getElementById('setting-default-quality') as HTMLInputElement;
  const defaultScaleInput = document.getElementById('setting-default-scale') as HTMLInputElement;
  const labelOpacityInput = document.getElementById('setting-label-opacity') as HTMLInputElement;
  
  if (btnCloseSettings) {
    btnCloseSettings.addEventListener('click', hideSettingsModal);
  }
  if (btnSaveSettings) {
    btnSaveSettings.addEventListener('click', saveSettingsFromModal);
  }
  if (defaultQualityInput) {
    defaultQualityInput.addEventListener('input', () => {
      const qualityValue = document.getElementById('setting-default-quality-value');
      if (qualityValue) {
        qualityValue.textContent = defaultQualityInput.value;
      }
    });
  }
  if (defaultScaleInput) {
    defaultScaleInput.addEventListener('input', () => {
      const scaleValue = document.getElementById('setting-default-scale-value');
      if (scaleValue) {
        scaleValue.textContent = defaultScaleInput.value;
      }
    });
  }
  if (labelOpacityInput) {
    labelOpacityInput.addEventListener('input', () => {
      const opacityValue = document.getElementById('setting-label-opacity-value');
      if (opacityValue) {
        opacityValue.textContent = labelOpacityInput.value;
      }
    });
  }
}
