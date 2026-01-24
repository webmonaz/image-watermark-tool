// ============================================================================
// Image Watermark Tool - TypeScript Interfaces
// ============================================================================

/**
 * Watermark position presets
 * Users can choose a fixed position or use 'custom' for drag-and-drop
 */
export type WatermarkPosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'center'
  | 'custom';

/**
 * Watermark type - either an image or text
 */
export type WatermarkType = 'image' | 'text';

/**
 * Export format options
 * - PNG: Best for images with transparency, lossless quality
 * - JPG: Best for photos, smaller file size, no transparency
 * - WebP: Modern format, best for web, supports transparency
 */
export type ExportFormat = 'png' | 'jpg' | 'webp';

/**
 * Crop preset options for popular social media platforms
 */
export type CropPreset =
  | 'original'        // Keep original size
  | 'freeform'        // User-defined crop area
  | 'facebook-thumb'  // 1200x630
  | 'facebook-post'   // 1200x1200
  | 'youtube-thumb'   // 1280x720
  | 'tiktok-thumb'    // 1080x1920
  | '1:1'             // Square
  | '4:5'             // Portrait (Instagram)
  | '16:9'            // Landscape (Widescreen)
  | '9:16';           // Vertical (Stories/Reels)

/**
 * Theme options
 */
export type ThemeMode = 'light' | 'dark' | 'auto';

/**
 * Thumbnail edit status for visual indicators
 * - untouched: Image has not been modified
 * - watermarked: Watermark settings have been changed
 * - cropped: Crop settings have been changed  
 * - edited: Both watermark and crop have been modified
 * - exported: Image has been exported
 */
export type ThumbnailEditStatus = 'untouched' | 'watermarked' | 'cropped' | 'edited' | 'exported';

/**
 * Preview quality options for performance vs quality tradeoff
 */
export type PreviewQuality = 'performance' | 'balanced' | 'quality' | 'full';

/**
 * Crop preset dimensions and aspect ratios
 */
export interface CropPresetInfo {
  name: string;
  description: string;
  width?: number;    // Fixed width (if applicable)
  height?: number;   // Fixed height (if applicable)
  ratio?: number;    // Aspect ratio as width/height
}

/**
 * Crop settings for an image
 */
export interface CropSettings {
  preset: CropPreset;
  // For freeform crop, these are percentages (0-100)
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Text watermark configuration
 */
export interface TextWatermarkConfig {
  text: string;
  fontFamily: string;
  fontSize: number;      // In pixels
  fontColor: string;     // Hex color (e.g., '#ffffff')
  opacity: number;       // 0-100
  bold: boolean;
  italic: boolean;
}

/**
 * Image watermark configuration
 */
export interface ImageWatermarkConfig {
  imageData: string;     // Base64 encoded image
  originalWidth: number;
  originalHeight: number;
  opacity: number;       // 0-100
}

/**
 * Watermark settings (common for both types)
 */
export interface WatermarkSettings {
  type: WatermarkType;
  position: WatermarkPosition;
  // Custom position as percentages (0-100) from top-left
  customX: number;
  customY: number;
  // Scale as percentage of image width
  scale: number;
  // Type-specific config
  textConfig?: TextWatermarkConfig;
  imageConfig?: ImageWatermarkConfig;
}

/**
 * EXIF data extracted from image
 */
export interface ExifData {
  make?: string;           // Camera manufacturer
  model?: string;          // Camera model
  dateTime?: string;       // Date taken
  exposureTime?: string;   // Shutter speed
  fNumber?: number;        // Aperture
  iso?: number;            // ISO sensitivity
  focalLength?: number;    // Focal length in mm
  flash?: string;          // Flash status
  orientation?: number;    // Image orientation
  gpsLatitude?: number;    // GPS latitude
  gpsLongitude?: number;   // GPS longitude
  software?: string;       // Software used
  copyright?: string;      // Copyright info
  artist?: string;         // Artist/Author
}

/**
 * Single image in the processing queue
 */
export interface ImageItem {
  id: string;
  fileName: string;
  filePath: string;
  originalData: string;  // Base64 encoded original image
  width: number;
  height: number;
  fileSize?: number;     // File size in bytes
  // Thumbnails for performance (generated on load)
  thumbnailData: string;   // Small thumbnail for sidebar (~200px)
  previewData: string;     // Medium preview for main area (~1200px)
  previewHQData?: string;  // High quality preview (~2400px), loaded on demand
  // EXIF metadata
  exifData?: ExifData;
  // Per-image settings (can override global)
  watermarkSettings: WatermarkSettings;
  cropSettings: CropSettings;
  // Processing state
  processed: boolean;
  processing: boolean;
  error?: string;
  // Edit status for thumbnail labels
  editStatus: ThumbnailEditStatus;
  // Preview thumbnail showing current edits (captured from canvas)
  previewThumbnail?: string;
}

/**
 * Export settings applied to all images
 */
export interface ExportSettings {
  format: ExportFormat;
  quality: number;       // 1-100 (for JPG/WebP)
  outputFolder: string;
  namingPattern: string; // e.g., '{original}_watermarked'
  scale: number;         // 1-200 (percent scale for output resolution)
}

/**
 * Application settings (persisted)
 */
export interface AppSettings {
  // Theme
  theme: ThemeMode;
  // Preview quality settings
  thumbnailQuality: PreviewQuality;   // For sidebar
  previewQuality: PreviewQuality;     // For main preview area
  // Default watermark settings
  defaultWatermarkPosition: WatermarkPosition;
  // Default export settings
  defaultExportFormat: ExportFormat;
  defaultExportQuality: number;
  defaultExportScale: number;
  // Recent projects
  recentProjects: string[];  // File paths
  maxRecentProjects: number;
  // UI preferences
  sidebarWidth: number;
  showImageInfo: boolean;
  // Zoom settings
  defaultZoom: number;  // 100 = 100%
  zoomStep: number;     // How much to zoom per step (e.g., 25 = 25%)
  // Thumbnail label settings
  showThumbnailLabels: boolean;  // Show status labels on thumbnails
  thumbnailLabelOpacity: number; // Opacity of labels (0-100)
}

/**
 * Project file structure (saved to .iwp file)
 */
export interface ProjectFile {
  version: string;
  savedAt: string;  // ISO date string
  settings: {
    globalWatermarkSettings: WatermarkSettings;
    exportFormat: ExportFormat;
    exportQuality: number;
    exportScale?: number;
  };
  images: ProjectImageReference[];
}

/**
 * Image reference in project file (stores path, not full data)
 */
export interface ProjectImageReference {
  id: string;
  fileName: string;
  filePath: string;
  width: number;
  height: number;
  watermarkSettings: WatermarkSettings;
  cropSettings: CropSettings;
}

/**
 * Image load result with error handling
 */
export interface ImageLoadResult {
  success: boolean;
  image?: ImageItem;
  error?: string;
  missingFile?: boolean;  // True if file was moved/deleted
}

/**
 * Zoom state for preview
 */
export interface ZoomState {
  level: number;      // Zoom level as percentage (100 = 100%)
  panX: number;       // Pan offset X in pixels
  panY: number;       // Pan offset Y in pixels
  isPanning: boolean; // Currently panning
}

/**
 * Application state
 */
export interface AppState {
  images: ImageItem[];
  selectedImageId: string | null;
  globalWatermarkSettings: WatermarkSettings;
  exportSettings: ExportSettings;
  isExporting: boolean;
  exportProgress: number; // 0-100
  // New fields
  settings: AppSettings;
  zoom: ZoomState;
  currentProjectPath: string | null;
  hasUnsavedChanges: boolean;
}

/**
 * Message sent to Web Worker for processing
 */
export interface ProcessImageMessage {
  type: 'process';
  imageData: string;
  imageWidth: number;
  imageHeight: number;
  watermarkSettings: WatermarkSettings;
  cropSettings: CropSettings;
  exportFormat: ExportFormat;
  quality: number;
  exportScale: number;
}

/**
 * Response from Web Worker after processing
 */
export interface ProcessImageResult {
  type: 'result';
  success: boolean;
  processedData?: string;  // Base64 encoded result
  error?: string;
}

/**
 * Progress update from Web Worker
 */
export interface ProcessProgressMessage {
  type: 'progress';
  percent: number;
}

/**
 * IPC API exposed to renderer via preload
 */
export interface ElectronAPI {
  // File dialogs
  selectImages: () => Promise<{ filePaths: string[]; canceled: boolean }>;
  selectWatermarkImage: () => Promise<{ filePath: string; canceled: boolean }>;
  selectExportFolder: () => Promise<{ folderPath: string; canceled: boolean }>;
  
  // Image operations
  readImageAsBase64: (filePath: string) => Promise<string>;
  exportImage: (data: {
    base64Data: string;
    fileName: string;
    folderPath: string;
    format: ExportFormat;
  }) => Promise<{ success: boolean; error?: string }>;
  getSystemFonts: () => Promise<string[]>;
  
  // File info
  getFileInfo: (filePath: string) => Promise<{
    exists: boolean;
    size?: number;
    modifiedAt?: string;
  }>;
  
  // Project file operations
  saveProject: (data: {
    projectData: string;  // JSON string
    filePath?: string;    // Optional path, if not provided show save dialog
  }) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  
  openProject: () => Promise<{
    success: boolean;
    data?: string;        // JSON string
    filePath?: string;
    error?: string;
    canceled?: boolean;
  }>;
  
  // Settings
  loadSettings: () => Promise<AppSettings>;
  saveSettings: (settings: AppSettings) => Promise<{ success: boolean }>;
  
  // EXIF reading
  readExifData: (filePath: string) => Promise<ExifData | null>;
  
  // App info
  getAppVersion: () => Promise<string>;
  openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;
  
  // Theme
  setNativeTheme: (theme: ThemeMode) => void;
}

// Extend Window interface to include our API
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
