// ============================================================================
// Layer Management Module
// Handles creating, editing, and managing watermark layers
// ============================================================================

import {
  state,
  getSelectedImage,
  generateLayerId,
  markUnsavedChanges,
} from '../state';
import { elements } from '../ui/elements';
import { deepCloneLayer, deepCloneLayerStack } from '../utils';
import { pushToUndoStack } from './history';
import { updatePreview } from './preview';
import type {
  WatermarkLayer,
  WatermarkType,
  WatermarkPosition,
} from '../../types';

// ============================================================================
// Constants
// ============================================================================

const MAX_LAYERS = 10;

// ============================================================================
// Layer Creation
// ============================================================================

/**
 * Create a new watermark layer with default settings
 */
export function createDefaultLayer(type: WatermarkType): WatermarkLayer {
  const id = generateLayerId();
  const image = getSelectedImage();
  const existingCount = image?.watermarkSettings.layerStack?.layers.filter(
    (l) => l.type === type
  ).length ?? 0;

  const baseName = type === 'image' ? 'Image Layer' : 'Text Layer';

  return {
    id,
    name: existingCount > 0 ? `${baseName} ${existingCount + 1}` : baseName,
    type,
    visible: true,
    locked: false,
    position: 'bottom-right',
    customX: 80,
    customY: 80,
    scale: 20,
    rotation: 0,
    textConfig:
      type === 'text'
        ? {
            text: '',
            fontFamily: 'Arial',
            fontSize: 24,
            fontColor: '#ffffff',
            opacity: 80,
            bold: false,
            italic: false,
          }
        : undefined,
    imageConfig: undefined,
  };
}

/**
 * Add a new layer to the current image
 */
export function addLayer(type: WatermarkType): void {
  const image = getSelectedImage();
  if (!image) return;

  // Initialize layer stack if needed
  if (!image.watermarkSettings.layerStack) {
    image.watermarkSettings.layerStack = {
      layers: [],
      selectedLayerId: null,
    };
  }

  const layerStack = image.watermarkSettings.layerStack;

  // Check layer limit
  if (layerStack.layers.length >= MAX_LAYERS) {
    alert(`Maximum of ${MAX_LAYERS} layers allowed per image.`);
    return;
  }

  const previousStack = deepCloneLayerStack(layerStack);
  const newLayer = createDefaultLayer(type);

  layerStack.layers.push(newLayer);
  layerStack.selectedLayerId = newLayer.id;

  pushToUndoStack({
    type: 'single',
    imageId: image.id,
    previousLayerStack: previousStack,
    newLayerStack: deepCloneLayerStack(layerStack),
  });

  markUnsavedChanges();
  renderLayerList();
  syncLayerSettingsUI();
  updatePreview();
  updateLayerApplyButtons();
}

// ============================================================================
// Layer Selection
// ============================================================================

/**
 * Select a layer by ID
 */
export function selectLayer(layerId: string): void {
  const image = getSelectedImage();
  if (!image?.watermarkSettings.layerStack) return;

  image.watermarkSettings.layerStack.selectedLayerId = layerId;
  renderLayerList();
  syncLayerSettingsUI();
  updatePreview();
}

/**
 * Get the currently selected layer
 */
export function getSelectedLayerFromImage(): WatermarkLayer | undefined {
  const image = getSelectedImage();
  if (!image?.watermarkSettings.layerStack) return undefined;

  const layerId = image.watermarkSettings.layerStack.selectedLayerId;
  if (!layerId) return undefined;

  return image.watermarkSettings.layerStack.layers.find((l) => l.id === layerId);
}

// ============================================================================
// Layer Ordering
// ============================================================================

/**
 * Move a layer from one index to another
 */
export function moveLayer(fromIndex: number, toIndex: number): void {
  const image = getSelectedImage();
  if (!image?.watermarkSettings.layerStack) return;

  const previousStack = deepCloneLayerStack(image.watermarkSettings.layerStack);
  const layers = image.watermarkSettings.layerStack.layers;

  const [removed] = layers.splice(fromIndex, 1);
  layers.splice(toIndex, 0, removed);

  pushToUndoStack({
    type: 'single',
    imageId: image.id,
    previousLayerStack: previousStack,
    newLayerStack: deepCloneLayerStack(image.watermarkSettings.layerStack),
  });

  markUnsavedChanges();
  renderLayerList();
  updatePreview();
}

// ============================================================================
// Layer Updates
// ============================================================================

/**
 * Update the selected layer with partial changes
 */
export function updateSelectedLayer(
  updates: Partial<WatermarkLayer>,
  saveToUndo = false
): void {
  const image = getSelectedImage();
  if (!image?.watermarkSettings.layerStack) return;

  const layer = getSelectedLayerFromImage();
  if (!layer) return;

  if (saveToUndo) {
    const previousStack = deepCloneLayerStack(image.watermarkSettings.layerStack);
    Object.assign(layer, updates);
    pushToUndoStack({
      type: 'single',
      imageId: image.id,
      previousLayerStack: previousStack,
      newLayerStack: deepCloneLayerStack(image.watermarkSettings.layerStack),
    });
  } else {
    Object.assign(layer, updates);
  }

  markUnsavedChanges();
  updatePreview();
}

/**
 * Delete the selected layer
 */
export function deleteSelectedLayer(): void {
  const image = getSelectedImage();
  if (!image?.watermarkSettings.layerStack) return;

  const previousStack = deepCloneLayerStack(image.watermarkSettings.layerStack);
  const layerStack = image.watermarkSettings.layerStack;
  const layerId = layerStack.selectedLayerId;
  const index = layerStack.layers.findIndex((l) => l.id === layerId);

  if (index === -1) return;

  layerStack.layers.splice(index, 1);

  // Select next layer or previous, or null if empty
  if (layerStack.layers.length > 0) {
    const newIndex = Math.min(index, layerStack.layers.length - 1);
    layerStack.selectedLayerId = layerStack.layers[newIndex].id;
  } else {
    layerStack.selectedLayerId = null;
  }

  pushToUndoStack({
    type: 'single',
    imageId: image.id,
    previousLayerStack: previousStack,
    newLayerStack: deepCloneLayerStack(layerStack),
  });

  markUnsavedChanges();
  renderLayerList();
  syncLayerSettingsUI();
  updatePreview();
  updateLayerApplyButtons();
}

// ============================================================================
// Layer Visibility
// ============================================================================

/**
 * Toggle layer visibility
 */
export function toggleLayerVisibility(layerId: string): void {
  const image = getSelectedImage();
  if (!image?.watermarkSettings.layerStack) return;

  const layer = image.watermarkSettings.layerStack.layers.find(
    (l) => l.id === layerId
  );
  if (!layer) return;

  layer.visible = !layer.visible;
  markUnsavedChanges();
  renderLayerList();
  updatePreview();
}

// ============================================================================
// Apply to All Functions
// ============================================================================

/**
 * Apply all layers from current image to all other images
 */
export function applyAllLayersToAll(): void {
  const image = getSelectedImage();
  if (!image?.watermarkSettings.layerStack) return;

  const sourceStack = deepCloneLayerStack(image.watermarkSettings.layerStack);

  // Regenerate IDs for each target image to avoid conflicts
  for (const targetImage of state.images) {
    if (targetImage.id === image.id) continue;

    if (!targetImage.watermarkSettings.layerStack) {
      targetImage.watermarkSettings.layerStack = { layers: [], selectedLayerId: null };
    }

    // Clone the layer stack with new IDs
    const newLayers = sourceStack.layers.map((layer) => ({
      ...deepCloneLayer(layer),
      id: generateLayerId(),
    }));

    targetImage.watermarkSettings.layerStack.layers = newLayers;
    targetImage.watermarkSettings.layerStack.selectedLayerId =
      newLayers.length > 0 ? newLayers[newLayers.length - 1].id : null;
  }

  markUnsavedChanges();
  updatePreview();
}

/**
 * Apply selected layer to all other images
 */
export function applySelectedLayerToAll(): void {
  const image = getSelectedImage();
  const layer = getSelectedLayerFromImage();
  if (!image || !layer) return;

  for (const targetImage of state.images) {
    if (targetImage.id === image.id) continue;

    if (!targetImage.watermarkSettings.layerStack) {
      targetImage.watermarkSettings.layerStack = { layers: [], selectedLayerId: null };
    }

    // Check layer limit
    if (targetImage.watermarkSettings.layerStack.layers.length >= MAX_LAYERS) {
      continue;
    }

    // Clone the layer with a new ID
    const newLayer = {
      ...deepCloneLayer(layer),
      id: generateLayerId(),
    };

    targetImage.watermarkSettings.layerStack.layers.push(newLayer);
    targetImage.watermarkSettings.layerStack.selectedLayerId = newLayer.id;
  }

  markUnsavedChanges();
  updatePreview();
}

// ============================================================================
// UI Rendering
// ============================================================================

/**
 * Render the layer list UI
 */
export function renderLayerList(): void {
  const layerList = elements.layerList;
  if (!layerList) return;

  const image = getSelectedImage();
  if (!image?.watermarkSettings.layerStack?.layers.length) {
    layerList.innerHTML = `
      <div class="layer-empty-state">
        <p>No watermark layers</p>
        <p class="small">Click + to add image or text watermark</p>
      </div>
    `;
    return;
  }

  const selectedId = image.watermarkSettings.layerStack.selectedLayerId;
  const layers = image.watermarkSettings.layerStack.layers;

  // Render layers in reverse order (top layer first in list)
  layerList.innerHTML = [...layers]
    .reverse()
    .map((layer, displayIndex) => {
      const actualIndex = layers.length - 1 - displayIndex;
      const typeIcon = layer.type === 'image' ? '&#128444;&#65039;' : '&#128221;';
      return `
        <div class="layer-item ${layer.id === selectedId ? 'selected' : ''}"
             data-layer-id="${layer.id}"
             data-index="${actualIndex}"
             draggable="true">
          <button class="layer-visibility ${layer.visible ? 'visible' : ''}"
                  data-action="toggle-visibility"
                  title="${layer.visible ? 'Hide' : 'Show'} layer">
            ${layer.visible ? '&#128065;' : '&#128065;'}
          </button>
          <span class="layer-icon">${typeIcon}</span>
          <span class="layer-name">${escapeHtml(layer.name)}</span>
          <span class="layer-drag-handle" title="Drag to reorder">&#8942;&#8942;</span>
        </div>
      `;
    })
    .join('');
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Sync the layer settings UI with the selected layer
 */
export function syncLayerSettingsUI(): void {
  const layerSettings = elements.layerSettings;
  const image = getSelectedImage();

  if (!image?.watermarkSettings.layerStack?.selectedLayerId) {
    if (layerSettings) layerSettings.style.display = 'none';
    return;
  }

  const layer = getSelectedLayerFromImage();
  if (!layer || !layerSettings) {
    if (layerSettings) layerSettings.style.display = 'none';
    return;
  }

  layerSettings.style.display = 'block';

  // Populate form fields with layer data
  if (elements.layerName) elements.layerName.value = layer.name;
  if (elements.layerPosition) elements.layerPosition.value = layer.position;
  if (elements.layerScale) elements.layerScale.value = layer.scale.toString();
  if (elements.layerScaleValue) elements.layerScaleValue.textContent = layer.scale.toString();
  if (elements.layerRotation) elements.layerRotation.value = layer.rotation.toString();
  if (elements.layerRotationValue) elements.layerRotationValue.textContent = layer.rotation.toString();

  const opacity =
    layer.type === 'image'
      ? layer.imageConfig?.opacity ?? 80
      : layer.textConfig?.opacity ?? 80;
  if (elements.layerOpacity) elements.layerOpacity.value = opacity.toString();
  if (elements.layerOpacityValue) elements.layerOpacityValue.textContent = opacity.toString();

  // Show/hide type-specific settings
  if (elements.layerImageSettings) {
    elements.layerImageSettings.style.display = layer.type === 'image' ? 'block' : 'none';
  }
  if (elements.layerTextSettings) {
    elements.layerTextSettings.style.display = layer.type === 'text' ? 'block' : 'none';
  }

  // Populate image preview
  if (layer.type === 'image' && layer.imageConfig?.imageData) {
    if (elements.layerImagePreview) elements.layerImagePreview.style.display = 'block';
    if (elements.layerImagePreviewImg) {
      elements.layerImagePreviewImg.src = layer.imageConfig.imageData;
    }
  } else {
    if (elements.layerImagePreview) elements.layerImagePreview.style.display = 'none';
  }

  // Populate text-specific fields
  if (layer.type === 'text' && layer.textConfig) {
    if (elements.layerTextContent) elements.layerTextContent.value = layer.textConfig.text;
    if (elements.layerFont) elements.layerFont.value = layer.textConfig.fontFamily;
    if (elements.layerColor) elements.layerColor.value = layer.textConfig.fontColor;
    if (elements.layerBold) elements.layerBold.checked = layer.textConfig.bold;
    if (elements.layerItalic) elements.layerItalic.checked = layer.textConfig.italic;
  }
}

/**
 * Update the apply buttons visibility
 */
export function updateLayerApplyButtons(): void {
  const image = getSelectedImage();
  const hasLayers = image?.watermarkSettings.layerStack?.layers.length ?? 0;
  const hasMultipleImages = state.images.length > 1;

  if (elements.layerApplyActions) {
    elements.layerApplyActions.style.display =
      hasLayers > 0 && hasMultipleImages ? 'flex' : 'none';
  }
}

// ============================================================================
// Event Listeners Setup
// ============================================================================

/**
 * Set up all layer-related event listeners
 */
export function setupLayerEventListeners(): void {
  // Add layer buttons - Image layer prompts for image selection first
  elements.btnAddImageLayer?.addEventListener('click', () => loadImageForNewLayer());
  elements.btnAddTextLayer?.addEventListener('click', () => addLayer('text'));
  elements.btnDeleteLayer?.addEventListener('click', deleteSelectedLayer);

  // Apply to all buttons
  elements.btnApplyLayersToAll?.addEventListener('click', applyAllLayersToAll);
  elements.btnApplyLayerToAll?.addEventListener('click', applySelectedLayerToAll);

  // Layer list click delegation
  elements.layerList?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const layerItem = target.closest('.layer-item') as HTMLElement | null;

    if (target.dataset.action === 'toggle-visibility') {
      const layerId = layerItem?.dataset.layerId;
      if (layerId) toggleLayerVisibility(layerId);
      e.stopPropagation();
      return;
    }

    if (layerItem) {
      const layerId = layerItem.dataset.layerId;
      if (layerId) selectLayer(layerId);
    }
  });

  // Layer settings inputs
  setupLayerSettingsInputs();

  // Drag and drop for reordering
  setupLayerDragDrop();
}

/**
 * Set up layer settings input handlers
 */
function setupLayerSettingsInputs(): void {
  // Name input
  elements.layerName?.addEventListener('input', (e) => {
    updateSelectedLayer({ name: (e.target as HTMLInputElement).value });
  });

  elements.layerName?.addEventListener('change', (e) => {
    updateSelectedLayer({ name: (e.target as HTMLInputElement).value }, true);
  });

  // Position select
  elements.layerPosition?.addEventListener('change', (e) => {
    updateSelectedLayer(
      { position: (e.target as HTMLSelectElement).value as WatermarkPosition },
      true
    );
  });

  // Scale slider
  elements.layerScale?.addEventListener('input', (e) => {
    const scale = parseInt((e.target as HTMLInputElement).value);
    if (elements.layerScaleValue) elements.layerScaleValue.textContent = scale.toString();
    updateSelectedLayer({ scale });
  });

  elements.layerScale?.addEventListener('change', (e) => {
    const scale = parseInt((e.target as HTMLInputElement).value);
    updateSelectedLayer({ scale }, true);
  });

  // Rotation slider
  elements.layerRotation?.addEventListener('input', (e) => {
    const rotation = parseInt((e.target as HTMLInputElement).value);
    if (elements.layerRotationValue) elements.layerRotationValue.textContent = rotation.toString();
    updateSelectedLayer({ rotation });
  });

  elements.layerRotation?.addEventListener('change', (e) => {
    const rotation = parseInt((e.target as HTMLInputElement).value);
    updateSelectedLayer({ rotation }, true);
  });

  // Opacity slider
  elements.layerOpacity?.addEventListener('input', (e) => {
    const opacity = parseInt((e.target as HTMLInputElement).value);
    if (elements.layerOpacityValue) elements.layerOpacityValue.textContent = opacity.toString();

    const layer = getSelectedLayerFromImage();
    if (!layer) return;

    if (layer.type === 'image' && layer.imageConfig) {
      updateSelectedLayer({ imageConfig: { ...layer.imageConfig, opacity } });
    } else if (layer.type === 'text' && layer.textConfig) {
      updateSelectedLayer({ textConfig: { ...layer.textConfig, opacity } });
    }
  });

  elements.layerOpacity?.addEventListener('change', (e) => {
    const opacity = parseInt((e.target as HTMLInputElement).value);
    const layer = getSelectedLayerFromImage();
    if (!layer) return;

    if (layer.type === 'image' && layer.imageConfig) {
      updateSelectedLayer({ imageConfig: { ...layer.imageConfig, opacity } }, true);
    } else if (layer.type === 'text' && layer.textConfig) {
      updateSelectedLayer({ textConfig: { ...layer.textConfig, opacity } }, true);
    }
  });

  // Text content
  elements.layerTextContent?.addEventListener('input', (e) => {
    const layer = getSelectedLayerFromImage();
    if (layer?.textConfig) {
      updateSelectedLayer({
        textConfig: { ...layer.textConfig, text: (e.target as HTMLInputElement).value },
      });
    }
  });

  elements.layerTextContent?.addEventListener('change', (e) => {
    const layer = getSelectedLayerFromImage();
    if (layer?.textConfig) {
      updateSelectedLayer(
        { textConfig: { ...layer.textConfig, text: (e.target as HTMLInputElement).value } },
        true
      );
    }
  });

  // Font select
  elements.layerFont?.addEventListener('change', (e) => {
    const layer = getSelectedLayerFromImage();
    if (layer?.textConfig) {
      updateSelectedLayer(
        { textConfig: { ...layer.textConfig, fontFamily: (e.target as HTMLSelectElement).value } },
        true
      );
    }
  });

  // Color input
  elements.layerColor?.addEventListener('input', (e) => {
    const layer = getSelectedLayerFromImage();
    if (layer?.textConfig) {
      updateSelectedLayer({
        textConfig: { ...layer.textConfig, fontColor: (e.target as HTMLInputElement).value },
      });
    }
  });

  elements.layerColor?.addEventListener('change', (e) => {
    const layer = getSelectedLayerFromImage();
    if (layer?.textConfig) {
      updateSelectedLayer(
        { textConfig: { ...layer.textConfig, fontColor: (e.target as HTMLInputElement).value } },
        true
      );
    }
  });

  // Bold checkbox
  elements.layerBold?.addEventListener('change', (e) => {
    const layer = getSelectedLayerFromImage();
    if (layer?.textConfig) {
      updateSelectedLayer(
        { textConfig: { ...layer.textConfig, bold: (e.target as HTMLInputElement).checked } },
        true
      );
    }
  });

  // Italic checkbox
  elements.layerItalic?.addEventListener('change', (e) => {
    const layer = getSelectedLayerFromImage();
    if (layer?.textConfig) {
      updateSelectedLayer(
        { textConfig: { ...layer.textConfig, italic: (e.target as HTMLInputElement).checked } },
        true
      );
    }
  });

  // Change layer image button
  elements.btnChangeLayerImage?.addEventListener('click', async () => {
    const result = await window.electronAPI.selectWatermarkImage();
    if (result.canceled || !result.filePath) return;

    try {
      const imageData = await window.electronAPI.readImageAsBase64(result.filePath);
      const dimensions = await getImageDimensions(imageData);

      const layer = getSelectedLayerFromImage();
      if (layer) {
        updateSelectedLayer(
          {
            imageConfig: {
              imageData,
              originalWidth: dimensions.width,
              originalHeight: dimensions.height,
              opacity: layer.imageConfig?.opacity ?? 80,
            },
          },
          true
        );
        syncLayerSettingsUI();
      }
    } catch (error) {
      console.error('Failed to load watermark image:', error);
    }
  });
}

/**
 * Get image dimensions from a data URL
 */
function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Set up drag and drop for layer reordering
 */
function setupLayerDragDrop(): void {
  const layerList = elements.layerList;
  if (!layerList) return;

  let draggedItem: HTMLElement | null = null;
  let draggedIndex: number | null = null;

  layerList.addEventListener('dragstart', (e) => {
    draggedItem = (e.target as HTMLElement).closest('.layer-item') as HTMLElement | null;
    if (draggedItem) {
      draggedIndex = parseInt(draggedItem.dataset.index ?? '0');
      draggedItem.classList.add('dragging');
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
      }
    }
  });

  layerList.addEventListener('dragend', () => {
    if (draggedItem) {
      draggedItem.classList.remove('dragging');
      draggedItem = null;
      draggedIndex = null;
    }
  });

  layerList.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (!draggedItem) return;

    const afterElement = getDragAfterElement(layerList, e.clientY);
    if (afterElement) {
      layerList.insertBefore(draggedItem, afterElement);
    } else {
      layerList.appendChild(draggedItem);
    }
  });

  layerList.addEventListener('drop', (e) => {
    e.preventDefault();
    if (!draggedItem || draggedIndex === null) return;

    // Calculate new order based on DOM position
    const items = Array.from(layerList.querySelectorAll('.layer-item'));
    const newDisplayIndex = items.indexOf(draggedItem);

    // Convert display index to actual layer index
    // Display is reversed (top layer first), so we need to reverse the indices
    const image = getSelectedImage();
    if (!image?.watermarkSettings.layerStack) return;

    const totalLayers = image.watermarkSettings.layerStack.layers.length;
    const fromActualIndex = draggedIndex;
    const toActualIndex = totalLayers - 1 - newDisplayIndex;

    if (fromActualIndex !== toActualIndex) {
      moveLayer(fromActualIndex, toActualIndex);
    }
  });
}

/**
 * Get the element to insert before during drag
 */
function getDragAfterElement(
  container: HTMLElement,
  y: number
): HTMLElement | null {
  const draggableElements = Array.from(
    container.querySelectorAll('.layer-item:not(.dragging)')
  ) as HTMLElement[];

  return draggableElements.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;

      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      }
      return closest;
    },
    { offset: Number.NEGATIVE_INFINITY, element: null as HTMLElement | null }
  ).element;
}

// ============================================================================
// Image Watermark Loading
// ============================================================================

/**
 * Load a watermark image for a new image layer
 * This prompts the user to select an image first, then creates the layer with the image already set
 */
export async function loadImageForNewLayer(): Promise<void> {
  const result = await window.electronAPI.selectWatermarkImage();
  if (result.canceled || !result.filePath) return;

  const image = getSelectedImage();
  if (!image) return;

  try {
    const imageData = await window.electronAPI.readImageAsBase64(result.filePath);
    const dimensions = await getImageDimensions(imageData);

    // Pre-cache the image before creating the layer so it renders immediately
    await preloadLayerImage(imageData);

    // Create the layer with imageConfig already set
    addImageLayerWithData(imageData, dimensions.width, dimensions.height);
  } catch (error) {
    console.error('Failed to load watermark image:', error);
  }
}

/**
 * Add a new image layer with image data already set
 */
function addImageLayerWithData(imageData: string, width: number, height: number): void {
  const image = getSelectedImage();
  if (!image) return;

  // Initialize layer stack if needed
  if (!image.watermarkSettings.layerStack) {
    image.watermarkSettings.layerStack = {
      layers: [],
      selectedLayerId: null,
    };
  }

  const layerStack = image.watermarkSettings.layerStack;

  // Check layer limit
  if (layerStack.layers.length >= MAX_LAYERS) {
    alert(`Maximum of ${MAX_LAYERS} layers allowed per image.`);
    return;
  }

  const previousStack = deepCloneLayerStack(layerStack);

  // Create layer with image data already set
  const newLayer = createDefaultLayer('image');
  newLayer.imageConfig = {
    imageData,
    originalWidth: width,
    originalHeight: height,
    opacity: 80,
  };

  layerStack.layers.push(newLayer);
  layerStack.selectedLayerId = newLayer.id;

  pushToUndoStack({
    type: 'single',
    imageId: image.id,
    previousLayerStack: previousStack,
    newLayerStack: deepCloneLayerStack(layerStack),
  });

  markUnsavedChanges();
  renderLayerList();
  syncLayerSettingsUI();
  updatePreview();
  updateLayerApplyButtons();
}

/**
 * Pre-load and cache a layer image for immediate display
 */
function preloadLayerImage(imageData: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      // The image will be cached by the preview module when it tries to draw
      resolve();
    };
    img.onerror = () => resolve(); // Resolve anyway on error
    img.src = imageData;
  });
}
