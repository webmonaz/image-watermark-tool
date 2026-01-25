# Image Watermark Tool - Architecture

This document describes the modular architecture of the Image Watermark Tool application, an Electron-based desktop app for adding watermarks to images.

## Overview

The application follows Electron's process model with:
- **Main Process** (`src/main.ts`) - File system operations, dialogs, native integration
- **Preload Script** (`src/preload.ts`) - Secure IPC bridge between main and renderer
- **Renderer Process** (`src/renderer/`) - All UI logic, organized into modules
- **Web Worker** (`src/worker/imageProcessor.worker.ts`) - Off-main-thread image processing

## Directory Structure

```
src/
├── main.ts                    # Electron main process entry
├── preload.ts                 # IPC bridge (contextBridge)
├── renderer.ts                # Re-exports from renderer/
├── index.css                  # Global styles
├── types/
│   └── index.ts               # Shared TypeScript interfaces
├── renderer/
│   ├── index.ts               # Main entry point, wiring modules together
│   ├── state/
│   │   └── index.ts           # Application state management
│   ├── ui/
│   │   └── elements.ts        # DOM element references
│   ├── utils/
│   │   └── index.ts           # Shared utility functions
│   ├── features/
│   │   ├── history.ts         # Undo/redo operations
│   │   ├── preview.ts         # Canvas preview rendering
│   │   ├── imageList.ts       # Sidebar image list management
│   │   ├── layers.ts          # Multi-layer watermark management
│   │   ├── watermark.ts       # Legacy watermark + drag/resize handling
│   │   ├── crop.ts            # Crop overlay interaction
│   │   ├── export.ts          # Export workflow with worker
│   │   ├── project.ts         # Project save/load
│   │   ├── settings.ts        # App settings and themes
│   │   └── zoom.ts            # Zoom controls
│   └── events/
│       ├── setup.ts           # Main event listeners setup
│       ├── keyboard.ts        # Keyboard shortcuts
│       ├── dragdrop.ts        # Drag and drop handling
│       └── images.ts          # Image loading from file paths
└── worker/
    └── imageProcessor.worker.ts  # Off-thread image processing
```

## Module Descriptions

### State (`renderer/state/index.ts`)

Central application state management.

**Exports:**
- `state` - Global mutable state object
- `AppState` - TypeScript interface for state shape
- `HistoryEntry` - Interface for undo/redo entries
- `DEFAULT_SETTINGS` - Default app settings configuration
- `getSelectedImage()` - Helper to get currently selected image
- `markUnsavedChanges()` - Flag project as having unsaved changes

**Dependencies:** None (leaf module)

### UI Elements (`renderer/ui/elements.ts`)

Centralized DOM element references.

**Exports:**
- `elements` - Object containing all DOM element references

**Dependencies:** None (leaf module)

### Utilities (`renderer/utils/index.ts`)

Shared utility functions and constants.

**Exports:**
- `THUMBNAIL_SIZE`, `PREVIEW_SIZE` - Size constants
- `generateId()` - Unique ID generator
- `getImageDimensions()` - Get image size from data URL
- `generateThumbnail()` - Create resized thumbnail
- `deepCloneWatermarkSettings()` - Deep clone watermark settings
- `readFileAsDataUrl()` - Read file as base64 data URL

**Dependencies:** None (leaf module)

### History (`renderer/features/history.ts`)

Undo/redo functionality.

**Exports:**
- `pushToUndoStack()` - Add entry to undo stack
- `undo()` - Undo last action
- `redo()` - Redo last undone action
- `updateUndoRedoButtons()` - Update button disabled states
- `setUpdatePreviewFn()` - Inject preview update function (resolves circular dep)

**Dependencies:** `state`, `elements`, `utils`

### Preview (`renderer/features/preview.ts`)

Canvas-based image preview rendering.

**Exports:**
- `updatePreview()` - Main preview update function
- `getPreviewLayout()` - Calculate preview dimensions
- `calculateCropArea()` - Calculate crop area in pixels
- `getWatermarkBounds()` - Get watermark position/size
- `positionWatermarkHandle()` - Position the watermark drag handle
- `updateCropOverlayPosition()` - Position crop overlay
- `setPositionWatermarkHandleFn()` - Inject function (resolves circular dep)
- Watermark preview cache management

**Dependencies:** `state`, `elements`, `utils`

### Image List (`renderer/features/imageList.ts`)

Sidebar thumbnail list management.

**Exports:**
- `renderImageList()` - Render all thumbnails
- `selectImage()` - Select an image by ID
- `removeImage()` - Remove an image from the list
- `setupThumbnailContextMenu()` - Setup right-click menu
- `exportSingleImage` reference for context menu

**Dependencies:** `state`, `elements`, `utils`, `preview`

### Layers (`renderer/features/layers.ts`)

Multi-layer watermark management system (up to 10 layers per image).

**Exports:**
- `addLayer()` - Add a new watermark layer (image or text)
- `loadImageForNewLayer()` - Prompt for image then create layer
- `selectLayer()` - Select a layer by ID
- `moveLayer()` - Reorder layers
- `updateSelectedLayer()` - Update selected layer properties
- `deleteSelectedLayer()` - Remove selected layer
- `toggleLayerVisibility()` - Show/hide layer
- `applyAllLayersToAll()` - Copy all layers to all images
- `applySelectedLayerToAll()` - Copy selected layer to all images
- `renderLayerList()` - Render layer list UI
- `syncLayerSettingsUI()` - Sync UI with selected layer
- `setupLayerEventListeners()` - Initialize layer UI event handlers

**Dependencies:** `state`, `elements`, `utils`, `preview`, `history`

### Watermark (`renderer/features/watermark.ts`)

Legacy single-watermark configuration and drag/resize handling.

**Exports:**
- `loadWatermarkImage()` - Load watermark image from file (legacy)
- `updateSelectedImageWatermarkSettings()` - Update watermark settings (legacy)
- `applyWatermarkSettingsToAll()` - Apply to all images (legacy)
- `showConfirmModal()`, `hideConfirmModal()` - Confirmation dialog
- `syncUIWithSelectedImage()` - Sync UI controls with image settings
- `setupWatermarkDragging()` - Setup watermark/layer position dragging (supports both systems)

**Dependencies:** `state`, `elements`, `utils`, `preview`, `history`

### Crop (`renderer/features/crop.ts`)

Crop overlay interaction (move, resize, aspect ratio constraints).

**Exports:**
- `setupCropInteraction()` - Initialize crop dragging/resizing
- `getPresetAspectRatio()` - Get aspect ratio for crop preset

**Dependencies:** `state`, `elements`, `preview`

### Export (`renderer/features/export.ts`)

Export workflow with Web Worker integration.

**Exports:**
- `exportSingleImage()` - Export one image
- `exportAllImages()` - Batch export all images
- `promptForExportFolder()` - Show folder picker

**Dependencies:** `state`, `elements`

### Project (`renderer/features/project.ts`)

Project file save/load (.iwp format).

**Exports:**
- `saveProject()` - Save current project to file
- `openProject()` - Load project from file
- `newProject()` - Create new empty project
- `updateWindowTitle()` - Update window title with project name

**Dependencies:** `state`, `elements`, `utils`, `preview`, `imageList`, `watermark`

### Settings (`renderer/features/settings.ts`)

Application settings and theme management.

**Exports:**
- `loadSettings()` - Load settings from storage
- `saveSettings()` - Save settings to storage
- `applyTheme()` - Apply color theme
- `updateRecentProjects()` - Manage recent projects list

**Dependencies:** `state`, `elements`

### Zoom (`renderer/features/zoom.ts`)

Preview zoom controls.

**Exports:**
- `setupZoomControls()` - Initialize zoom buttons and slider
- `setZoom()` - Set zoom level programmatically
- `resetZoom()` - Reset to 100%

**Dependencies:** `state`, `elements`, `preview`

### Event Setup (`renderer/events/setup.ts`)

Central event listener registration.

**Exports:**
- `setupEventListeners()` - Register all DOM event listeners

**Dependencies:** All feature modules, `state`, `elements`

### Keyboard (`renderer/events/keyboard.ts`)

Keyboard shortcut handling.

**Exports:**
- `setupKeyboardShortcuts()` - Register keyboard listeners

**Dependencies:** `state`, feature modules

### Drag & Drop (`renderer/events/dragdrop.ts`)

File drag and drop handling.

**Exports:**
- `setupDragAndDrop()` - Initialize drag/drop on image list

**Dependencies:** `state`, `elements`, `utils`, `imageList`

### Images (`renderer/events/images.ts`)

Image loading from file paths.

**Exports:**
- `addImages()` - Load images from file paths

**Dependencies:** `state`, `utils`, `imageList`, `watermark`

## Module Dependency Graph

```
                    ┌──────────────────┐
                    │  renderer/index  │  (entry point)
                    └────────┬─────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
    ┌─────────┐       ┌──────────┐       ┌────────────┐
    │  state  │       │ elements │       │   utils    │
    └────┬────┘       └────┬─────┘       └─────┬──────┘
         │                 │                   │
         └─────────────────┼───────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
    ┌─────────┐      ┌──────────┐      ┌─────────┐
    │ history │◄────►│ preview  │◄────►│  crop   │
    └─────────┘      └────┬─────┘      └─────────┘
                          │
    ┌─────────────────────┼─────────────────────┐
    │                     │                     │
    ▼                     ▼                     ▼
┌───────────┐      ┌───────────┐      ┌────────────┐
│ imageList │      │ watermark │      │   export   │
└───────────┘      └───────────┘      └────────────┘
                          │
                    ┌─────┼─────┐
                    │     │     │
                    ▼     ▼     ▼
               ┌─────────┐ ┌─────────┐ ┌──────┐
               │ project │ │settings │ │ zoom │
               └─────────┘ └─────────┘ └──────┘
                    │
              ┌─────┴─────┐
              │           │
              ▼           ▼
        ┌──────────┐ ┌──────────┐
        │ keyboard │ │ dragdrop │
        └──────────┘ └──────────┘
```

## Circular Dependency Resolution

Some modules have circular dependencies (e.g., `preview` → `crop` → `preview`). These are resolved using setter injection:

```typescript
// In preview.ts
export function setPositionWatermarkHandleFn(fn: () => void): void {
  _positionWatermarkHandle = fn;
}

// In index.ts (wiring)
import { setPositionWatermarkHandleFn } from './features/preview';
import { positionWatermarkHandle } from './features/watermark';
setPositionWatermarkHandleFn(positionWatermarkHandle);
```

## Data Flow

### Image Loading Flow
1. User drops files or clicks "Add Images"
2. `events/images.ts::addImages()` reads files via IPC
3. Thumbnails generated in `utils/index.ts`
4. Image added to `state.images[]`
5. `imageList.ts::renderImageList()` updates UI
6. `preview.ts::updatePreview()` draws canvas

### Watermark Application Flow (Layer System)
1. User clicks "Add Image Layer" button
2. `layers.ts::loadImageForNewLayer()` prompts for image file
3. Image loaded and cached via `preloadLayerImage()`
4. Layer created with image data via `addImageLayerWithData()`
5. Layer stored in `image.watermarkSettings.layerStack.layers[]`
6. Preview renders all layers via `preview.ts::drawAllLayersPreview()`
7. User can drag selected layer to reposition (switches to custom position)
8. Layer settings (scale, rotation, opacity) adjustable via UI controls

### Export Flow
1. User clicks "Export All"
2. `export.ts::exportAllImages()` prompts for folder
3. For each image:
   - Create Web Worker
   - Send image + settings to worker
   - Worker renders final image on OffscreenCanvas
   - Worker returns processed data
   - Main process saves file via IPC
4. Progress bar updates

## Future Improvements

### Short Term
- [ ] Add unit tests for utility functions
- [ ] Add E2E tests for export workflow
- [ ] Implement image reordering in sidebar

### Medium Term
- [ ] Extract preview canvas logic to separate CanvasRenderer class
- [ ] Add plugin system for custom watermark types
- [ ] Implement batch processing queue with priority
- [ ] Add image metadata preservation

### Long Term
- [x] ~~Support multiple watermarks per image~~ (Implemented in v1.1.0 - multi-layer system)
- [x] ~~Add watermark rotation support~~ (Implemented in v1.1.0)
- [ ] Add video watermarking support
- [ ] Cloud storage integration (optional)
- [ ] Collaborative projects (optional)

## Security Considerations

- **Context Isolation**: Renderer has no direct Node.js access
- **IPC Bridge**: Only whitelisted operations exposed via preload
- **File Access**: All file operations go through Electron dialogs
- **No Remote Code**: Application runs fully offline
- **Sandbox**: Enabled for App Store builds

## Performance Notes

- Thumbnails cached at load time (200px max)
- Preview images scaled to 1200px max
- Web Workers prevent UI blocking during export
- Watermark image cached for reuse
- DOM elements cached in `elements.ts`

---

*Last updated: January 2025*
