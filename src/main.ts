// ============================================================================
// Main Process - Electron Entry Point
// Handles window creation, IPC handlers, and file system operations
// ============================================================================

import { app, BrowserWindow, dialog, ipcMain, nativeTheme } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import started from 'electron-squirrel-startup';
import type { AppSettings, ThemeMode } from './types';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Main window reference
let mainWindow: BrowserWindow | null = null;

// Settings file path
const getSettingsPath = () => path.join(app.getPath('userData'), 'settings.json');

// Default settings
const DEFAULT_SETTINGS: AppSettings = {
  theme: 'auto',
  thumbnailQuality: 'performance',
  previewQuality: 'balanced',
  defaultExportFormat: 'jpg',
  defaultExportQuality: 85,
  recentProjects: [],
  maxRecentProjects: 10,
  sidebarWidth: 280,
  showImageInfo: true,
  defaultZoom: 100,
  zoomStep: 25,
};

/**
 * Create the main application window
 */
const createWindow = (): void => {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Required for preload script
    },
    titleBarStyle: 'hiddenInset', // Modern look on macOS
    show: false, // Show when ready to prevent flashing
  });

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Load the app
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development' || MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools();
  }
};

// ============================================================================
// IPC Handlers - File Dialogs and Operations
// ============================================================================

/**
 * Open file dialog to select images for watermarking
 */
ipcMain.handle('dialog:selectImages', async () => {
  if (!mainWindow) return { filePaths: [], canceled: true };

  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Images to Watermark',
    message: 'Choose one or more images to add watermarks to',
    buttonLabel: 'Select Images',
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'] },
    ],
    properties: ['openFile', 'multiSelections'],
  });

  return {
    filePaths: result.filePaths,
    canceled: result.canceled,
  };
});

/**
 * Open file dialog to select watermark image
 */
ipcMain.handle('dialog:selectWatermark', async () => {
  if (!mainWindow) return { filePath: '', canceled: true };

  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Watermark Image',
    message: 'Choose an image to use as watermark (PNG with transparency recommended)',
    buttonLabel: 'Select Watermark',
    filters: [
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] },
    ],
    properties: ['openFile'],
  });

  return {
    filePath: result.filePaths[0] || '',
    canceled: result.canceled,
  };
});

/**
 * Open folder dialog to select export destination
 */
ipcMain.handle('dialog:selectExportFolder', async () => {
  if (!mainWindow) return { folderPath: '', canceled: true };

  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Export Folder',
    message: 'Choose where to save watermarked images',
    buttonLabel: 'Select Folder',
    properties: ['openDirectory', 'createDirectory'],
  });

  return {
    folderPath: result.filePaths[0] || '',
    canceled: result.canceled,
  };
});

/**
 * Read an image file and return as base64
 */
ipcMain.handle('file:readImage', async (_event: Electron.IpcMainInvokeEvent, filePath: string) => {
  try {
    const buffer = await fs.promises.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
    };
    const mimeType = mimeTypes[ext] || 'image/png';
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  } catch (error) {
    console.error('Error reading image:', error);
    throw error;
  }
});

/**
 * Export a processed image to disk
 */
ipcMain.handle('file:exportImage', async (_event: Electron.IpcMainInvokeEvent, data: {
  base64Data: string;
  fileName: string;
  folderPath: string;
  format: string;
}) => {
  try {
    const { base64Data, fileName, folderPath, format } = data;
    
    // Remove data URL prefix if present
    const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Content, 'base64');
    
    // Construct output path
    const baseName = path.basename(fileName, path.extname(fileName));
    const outputName = `${baseName}_watermarked.${format}`;
    const outputPath = path.join(folderPath, outputName);
    
    // Write file
    await fs.promises.writeFile(outputPath, buffer);
    
    return { success: true };
  } catch (error) {
    console.error('Error exporting image:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

/**
 * Get file info (size, exists, modified date)
 */
ipcMain.handle('file:getInfo', async (_event: Electron.IpcMainInvokeEvent, filePath: string) => {
  try {
    const stats = await fs.promises.stat(filePath);
    return {
      exists: true,
      size: stats.size,
      modifiedAt: stats.mtime.toISOString(),
    };
  } catch {
    return { exists: false };
  }
});

/**
 * Get list of common web-safe fonts
 * Note: Getting system fonts requires native modules which may not be store-compliant
 * We use a curated list of web-safe fonts instead
 */
ipcMain.handle('system:getFonts', async () => {
  // Web-safe fonts that work across platforms
  return [
    'Arial',
    'Arial Black',
    'Comic Sans MS',
    'Courier New',
    'Georgia',
    'Impact',
    'Lucida Console',
    'Lucida Sans Unicode',
    'Palatino Linotype',
    'Tahoma',
    'Times New Roman',
    'Trebuchet MS',
    'Verdana',
    // System fonts
    '-apple-system',
    'BlinkMacSystemFont',
    'Segoe UI',
    'Roboto',
    'Helvetica Neue',
    'sans-serif',
    'serif',
    'monospace',
  ];
});

// ============================================================================
// IPC Handlers - Project File Operations
// ============================================================================

/**
 * Save project to file
 */
ipcMain.handle('project:save', async (_event: Electron.IpcMainInvokeEvent, data: {
  projectData: string;
  filePath?: string;
}) => {
  try {
    let outputPath = data.filePath;
    
    // If no path provided, show save dialog
    if (!outputPath && mainWindow) {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Save Project',
        defaultPath: 'untitled.iwp',
        filters: [
          { name: 'Image Watermark Project', extensions: ['iwp'] },
          { name: 'JSON', extensions: ['json'] },
        ],
      });
      
      if (result.canceled || !result.filePath) {
        return { success: false, error: 'Save canceled' };
      }
      outputPath = result.filePath;
    }
    
    if (!outputPath) {
      return { success: false, error: 'No file path provided' };
    }
    
    await fs.promises.writeFile(outputPath, data.projectData, 'utf-8');
    
    return { success: true, filePath: outputPath };
  } catch (error) {
    console.error('Error saving project:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

/**
 * Open project file
 */
ipcMain.handle('project:open', async () => {
  if (!mainWindow) return { success: false, canceled: true };
  
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Open Project',
      filters: [
        { name: 'Image Watermark Project', extensions: ['iwp'] },
        { name: 'JSON', extensions: ['json'] },
      ],
      properties: ['openFile'],
    });
    
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }
    
    const filePath = result.filePaths[0];
    const data = await fs.promises.readFile(filePath, 'utf-8');
    
    return { success: true, data, filePath };
  } catch (error) {
    console.error('Error opening project:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// ============================================================================
// IPC Handlers - Settings
// ============================================================================

/**
 * Load app settings
 */
ipcMain.handle('settings:load', async () => {
  try {
    const settingsPath = getSettingsPath();
    
    if (fs.existsSync(settingsPath)) {
      const data = await fs.promises.readFile(settingsPath, 'utf-8');
      const loadedSettings = JSON.parse(data);
      // Merge with defaults to handle new settings
      return { ...DEFAULT_SETTINGS, ...loadedSettings };
    }
    
    return DEFAULT_SETTINGS;
  } catch (error) {
    console.error('Error loading settings:', error);
    return DEFAULT_SETTINGS;
  }
});

/**
 * Save app settings
 */
ipcMain.handle('settings:save', async (_event: Electron.IpcMainInvokeEvent, settings: AppSettings) => {
  try {
    const settingsPath = getSettingsPath();
    await fs.promises.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
    return { success: true };
  } catch (error) {
    console.error('Error saving settings:', error);
    return { success: false };
  }
});

/**
 * Set native theme
 */
ipcMain.handle('theme:set', (_event: Electron.IpcMainInvokeEvent, theme: ThemeMode) => {
  if (theme === 'auto') {
    nativeTheme.themeSource = 'system';
  } else {
    nativeTheme.themeSource = theme;
  }
});

// ============================================================================
// IPC Handlers - EXIF Data
// ============================================================================

/**
 * Read EXIF data from image
 * Note: Basic EXIF reading without external dependencies
 * For full EXIF support, consider adding exif-js or similar library
 */
ipcMain.handle('file:readExif', async (_event: Electron.IpcMainInvokeEvent, filePath: string) => {
  try {
    // Basic EXIF reading - for full support consider adding exif-parser or similar
    const stats = await fs.promises.stat(filePath);
    
    // Return basic file info if EXIF parsing is not available
    return {
      fileSize: stats.size,
      dateTime: stats.mtime.toISOString(),
    };
  } catch (error) {
    console.error('Error reading EXIF:', error);
    return null;
  }
});

/**
 * Get app version
 */
ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

// ============================================================================
// App Lifecycle Events
// ============================================================================

// Ready to create windows
app.on('ready', createWindow);

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Re-create window on macOS when dock icon is clicked
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (_event: Electron.Event, contents: Electron.WebContents) => {
  contents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });
});
