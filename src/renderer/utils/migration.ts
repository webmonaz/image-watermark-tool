// ============================================================================
// Project File Migration Utilities
// ============================================================================

import type {
  ProjectFile,
  WatermarkSettings,
  WatermarkLayerStack,
  WatermarkLayer,
  ProjectImageReference,
} from '../../types';
import { generateLayerId } from '../state';

/**
 * Migrate old single-watermark settings to layer stack
 * This converts legacy WatermarkSettings to the new layer-based system
 */
export function migrateWatermarkSettingsToLayerStack(
  oldSettings: WatermarkSettings
): WatermarkLayerStack {
  // If already has layer stack, return it as-is
  if (oldSettings.layerStack && oldSettings.layerStack.layers.length > 0) {
    return oldSettings.layerStack;
  }

  // Check if there's any watermark data to migrate
  const hasImageWatermark =
    oldSettings.type === 'image' && oldSettings.imageConfig?.imageData;
  const hasTextWatermark =
    oldSettings.type === 'text' && oldSettings.textConfig?.text;

  if (!hasImageWatermark && !hasTextWatermark) {
    return { layers: [], selectedLayerId: null };
  }

  // Create layer from old settings
  const layer: WatermarkLayer = {
    id: generateLayerId(),
    name: oldSettings.type === 'image' ? 'Migrated Logo' : 'Migrated Text',
    type: oldSettings.type,
    visible: true,
    locked: false,
    position: oldSettings.position,
    customX: oldSettings.customX,
    customY: oldSettings.customY,
    scale: oldSettings.scale,
    rotation: 0, // Default rotation for migrated layers
    textConfig: oldSettings.textConfig,
    imageConfig: oldSettings.imageConfig,
  };

  return {
    layers: [layer],
    selectedLayerId: layer.id,
  };
}

/**
 * Check if project file needs migration
 */
export function needsMigration(projectData: ProjectFile): boolean {
  const version = projectData.version || '1.0.0';
  // Version 2.x and above use the layer system
  return !version.startsWith('2.');
}

/**
 * Migrate entire project file to new version with layer support
 */
export function migrateProjectFile(projectData: ProjectFile): ProjectFile {
  if (!needsMigration(projectData)) {
    // Already migrated
    return projectData;
  }

  // Migrate v1.x to v2.0
  const migratedImages: ProjectImageReference[] = projectData.images.map(
    (img) => {
      const layerStack = migrateWatermarkSettingsToLayerStack(
        img.watermarkSettings
      );
      return {
        ...img,
        watermarkSettings: {
          ...img.watermarkSettings,
          layerStack,
        },
      };
    }
  );

  const globalLayerStack = migrateWatermarkSettingsToLayerStack(
    projectData.settings.globalWatermarkSettings
  );

  return {
    ...projectData,
    version: '2.0.0',
    settings: {
      ...projectData.settings,
      globalWatermarkSettings: {
        ...projectData.settings.globalWatermarkSettings,
        layerStack: globalLayerStack,
      },
    },
    images: migratedImages,
  };
}

/**
 * Ensure an image item has a proper layer stack
 * Used when loading images that might not have the new structure
 */
export function ensureImageHasLayerStack(
  watermarkSettings: WatermarkSettings
): WatermarkSettings {
  if (watermarkSettings.layerStack) {
    return watermarkSettings;
  }

  return {
    ...watermarkSettings,
    layerStack: migrateWatermarkSettingsToLayerStack(watermarkSettings),
  };
}
