# Image Watermark Tool - Project Guidelines

## Project Overview
A cross-platform desktop application for adding watermarks (image or text) to images with batch processing support. Built with Electron + TypeScript + Vite, designed for Mac App Store and Windows Store distribution.

## Tech Stack
- **Framework**: Electron 40 with Electron Forge
- **Build Tool**: Vite
- **Language**: TypeScript
- **Image Processing**: Canvas API + Web Workers (no native dependencies for store compliance)

## Architecture

### Process Model
- **Main Process** (`src/main.ts`): Handles file system operations, dialogs, and IPC
- **Renderer Process** (`src/renderer.ts`): UI and user interactions
- **Preload Script** (`src/preload.ts`): Secure IPC bridge between main and renderer
- **Web Worker** (`src/worker/imageProcessor.worker.ts`): Off-main-thread image processing

### Security Model
- `nodeIntegration: false` - No direct Node.js access in renderer
- `contextIsolation: true` - Isolated preload context
- All file operations go through IPC handlers in main process
- Use `dialog.showOpenDialog` and `dialog.showSaveDialog` for file access

## Key Features

### Watermark Types
1. **Image Watermark**: PNG/JPG with transparency support
2. **Text Watermark**: Custom font, size, color, opacity

### Watermark Positioning
- **Fixed Positions**: Top-left, Top-right, Bottom-left, Bottom-right, Center
- **Custom Position**: Drag-and-drop placement on each image
- Position stored as percentages for consistent scaling

### Image Crop/Resize Presets
- Facebook Thumbnail (1200x630)
- Facebook Post (1200x1200)
- YouTube Thumbnail (1280x720)
- TikTok Thumbnail (1080x1920)
- Common ratios: 1:1, 4:5, 16:9, 9:16
- Original size (no crop)
- Freeform crop

### Export Options
- **Formats**: PNG (lossless), JPG (lossy), WebP (modern web)
- **Quality**: Slider for JPG/WebP (1-100)
- **Batch Export**: Process all images with progress indicator

## Code Conventions

### TypeScript
- Use strict mode
- Define interfaces for all data structures
- Prefer `const` over `let`
- Use async/await for asynchronous operations

### File Organization
```
src/
  main.ts           # Main process entry
  preload.ts        # IPC bridge
  renderer.ts       # Renderer entry
  index.css         # Global styles
  types/            # TypeScript interfaces
  worker/           # Web Workers
```

### IPC Channels
- `dialog:selectImages` - Open file picker for images
- `dialog:selectWatermark` - Open file picker for watermark image
- `dialog:selectExportFolder` - Choose export destination
- `file:exportImages` - Save processed images to disk
- `file:readImage` - Read image file as base64

## Store Compliance Guidelines

### Mac App Store
- Enable sandboxing in production builds
- Use only App Store-approved APIs
- No auto-updater (App Store handles updates)
- No telemetry without explicit consent
- Sign with Apple Developer certificate

### Windows Store
- Use MSIX packaging
- Follow Windows App Certification requirements
- No background services
- Proper manifest with capabilities declared

### Both Stores
- All processing must be local (no server uploads)
- Clear privacy policy (no data collection)
- No cryptocurrency mining or hidden functionality
- Proper content ratings

## Development Commands

```bash
# Start development server
npm start

# Package for current platform
npm run package

# Create distributable
npm run make

# Lint code
npm run lint
```

## UI/UX Guidelines
- Simple, clean interface suitable for basic IT knowledge users
- Include tooltips and help text for all controls
- Show format recommendations (e.g., "PNG for transparency, WebP for web")
- Progress indicators for batch operations
- Drag-and-drop support for image import
- Preview changes before export

## Performance Considerations
- Use Web Workers for image processing to prevent UI freezing
- Process images in queue, not all at once
- Show per-image progress during batch export
- Lazy-load image thumbnails for large batches
