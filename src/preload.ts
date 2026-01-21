// ============================================================================
// Preload Script - Secure IPC Bridge
// Exposes safe APIs to renderer without enabling nodeIntegration
// ============================================================================

import { contextBridge, ipcRenderer } from 'electron';
import type { ExportFormat, AppSettings, ExifData, ThemeMode } from './types';

// Expose protected methods to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // ========================================
  // File Dialogs
  // ========================================
  
  /**
   * Open file picker to select images for watermarking
   * @returns Promise with file paths array and canceled status
   */
  selectImages: (): Promise<{ filePaths: string[]; canceled: boolean }> => {
    return ipcRenderer.invoke('dialog:selectImages');
  },

  /**
   * Open file picker to select a watermark image
   * @returns Promise with file path and canceled status
   */
  selectWatermarkImage: (): Promise<{ filePath: string; canceled: boolean }> => {
    return ipcRenderer.invoke('dialog:selectWatermark');
  },

  /**
   * Open folder picker to select export destination
   * @returns Promise with folder path and canceled status
   */
  selectExportFolder: (): Promise<{ folderPath: string; canceled: boolean }> => {
    return ipcRenderer.invoke('dialog:selectExportFolder');
  },

  // ========================================
  // Image Operations
  // ========================================

  /**
   * Read an image file and return as base64 encoded string
   * @param filePath - Absolute path to the image file
   * @returns Promise with base64 encoded image data
   */
  readImageAsBase64: (filePath: string): Promise<string> => {
    return ipcRenderer.invoke('file:readImage', filePath);
  },

  /**
   * Export a processed image to disk
   * @param data - Export data including base64 image, filename, folder, and format
   * @returns Promise with success status and optional error message
   */
  exportImage: (data: {
    base64Data: string;
    fileName: string;
    folderPath: string;
    format: ExportFormat;
  }): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('file:exportImage', data);
  },

  /**
   * Get list of system fonts available for text watermarks
   * @returns Promise with array of font family names
   */
  getSystemFonts: (): Promise<string[]> => {
    return ipcRenderer.invoke('system:getFonts');
  },

  // ========================================
  // File Info
  // ========================================

  /**
   * Get file info (exists, size, modified date)
   * @param filePath - Absolute path to the file
   */
  getFileInfo: (filePath: string): Promise<{
    exists: boolean;
    size?: number;
    modifiedAt?: string;
  }> => {
    return ipcRenderer.invoke('file:getInfo', filePath);
  },

  // ========================================
  // Project File Operations
  // ========================================

  /**
   * Save project to file
   * @param data - Project data and optional file path
   */
  saveProject: (data: {
    projectData: string;
    filePath?: string;
  }): Promise<{ success: boolean; filePath?: string; error?: string }> => {
    return ipcRenderer.invoke('project:save', data);
  },

  /**
   * Open project file
   */
  openProject: (): Promise<{
    success: boolean;
    data?: string;
    filePath?: string;
    error?: string;
    canceled?: boolean;
  }> => {
    return ipcRenderer.invoke('project:open');
  },

  // ========================================
  // Settings
  // ========================================

  /**
   * Load app settings from disk
   */
  loadSettings: (): Promise<AppSettings> => {
    return ipcRenderer.invoke('settings:load');
  },

  /**
   * Save app settings to disk
   */
  saveSettings: (settings: AppSettings): Promise<{ success: boolean }> => {
    return ipcRenderer.invoke('settings:save', settings);
  },

  // ========================================
  // EXIF Reading
  // ========================================

  /**
   * Read EXIF data from image file
   * @param filePath - Absolute path to the image file
   */
  readExifData: (filePath: string): Promise<ExifData | null> => {
    return ipcRenderer.invoke('file:readExif', filePath);
  },

  // ========================================
  // App Info
  // ========================================

  /**
   * Get app version
   */
  getAppVersion: (): Promise<string> => {
    return ipcRenderer.invoke('app:getVersion');
  },

  // ========================================
  // Theme
  // ========================================

  /**
   * Set native theme (light/dark/auto)
   */
  setNativeTheme: (theme: ThemeMode): void => {
    ipcRenderer.invoke('theme:set', theme);
  },
});
