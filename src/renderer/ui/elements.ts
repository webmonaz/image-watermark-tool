// ============================================================================
// DOM Elements - Centralized Element References
// ============================================================================

export const elements = {
  // Header buttons
  btnAddImages: document.getElementById('btn-add-images') as HTMLButtonElement,
  btnExportSelected: document.getElementById('btn-export-selected') as HTMLButtonElement,
  btnExportAll: document.getElementById('btn-export-all') as HTMLButtonElement,
  btnUndo: document.getElementById('btn-undo') as HTMLButtonElement,
  btnRedo: document.getElementById('btn-redo') as HTMLButtonElement,
  btnAbout: document.getElementById('btn-about') as HTMLButtonElement,
  
  // Image list
  imageList: document.getElementById('image-list') as HTMLDivElement,
  imageCount: document.getElementById('image-count') as HTMLSpanElement,
  dropZone: document.getElementById('drop-zone') as HTMLDivElement,
  btnClearAll: document.getElementById('btn-clear-all') as HTMLButtonElement,
  
  // Preview
  previewContainer: document.getElementById('preview-container') as HTMLDivElement,
  previewCanvas: document.getElementById('preview-canvas') as HTMLCanvasElement,
  previewInfo: document.getElementById('preview-info') as HTMLDivElement,
  projectTitle: document.getElementById('project-title') as HTMLSpanElement,
  noImagePlaceholder: document.getElementById('no-image-placeholder') as HTMLDivElement,
  watermarkOverlay: document.getElementById('watermark-overlay') as HTMLDivElement,
  watermarkHandle: document.getElementById('watermark-handle') as HTMLDivElement,
  cropOverlay: document.getElementById('crop-overlay') as HTMLDivElement,
  cropBox: document.getElementById('crop-box') as HTMLDivElement,

  // Watermark type
  watermarkTypeRadios: document.querySelectorAll('input[name="watermark-type"]') as NodeListOf<HTMLInputElement>,
  imageWatermarkControls: document.getElementById('image-watermark-controls') as HTMLDivElement,
  textWatermarkControls: document.getElementById('text-watermark-controls') as HTMLDivElement,
  
  // Image watermark
  btnSelectWatermark: document.getElementById('btn-select-watermark') as HTMLButtonElement,
  watermarkPreview: document.getElementById('watermark-preview') as HTMLDivElement,
  watermarkPreviewImg: document.getElementById('watermark-preview-img') as HTMLImageElement,
  btnRemoveWatermark: document.getElementById('btn-remove-watermark') as HTMLButtonElement,
  
  // Text watermark
  watermarkText: document.getElementById('watermark-text') as HTMLInputElement,
  watermarkFont: document.getElementById('watermark-font') as HTMLSelectElement,
  watermarkColor: document.getElementById('watermark-color') as HTMLInputElement,
  watermarkBold: document.getElementById('watermark-bold') as HTMLInputElement,
  watermarkItalic: document.getElementById('watermark-italic') as HTMLInputElement,
  
  // Common watermark settings
  watermarkPosition: document.getElementById('watermark-position') as HTMLSelectElement,
  watermarkScale: document.getElementById('watermark-scale') as HTMLInputElement,
  watermarkScaleValue: document.getElementById('watermark-scale-value') as HTMLSpanElement,
  watermarkOpacity: document.getElementById('watermark-opacity') as HTMLInputElement,
  watermarkOpacityValue: document.getElementById('watermark-opacity-value') as HTMLSpanElement,
  
  // Apply to all button
  btnApplyToAll: document.getElementById('btn-apply-to-all') as HTMLButtonElement,
  
  // Crop settings
  cropPreset: document.getElementById('crop-preset') as HTMLSelectElement,
  
  // Export settings
  exportFormat: document.getElementById('export-format') as HTMLSelectElement,
  qualityControl: document.getElementById('quality-control') as HTMLDivElement,
  exportQuality: document.getElementById('export-quality') as HTMLInputElement,
  exportQualityValue: document.getElementById('export-quality-value') as HTMLSpanElement,
  exportScale: document.getElementById('export-scale') as HTMLInputElement,
  exportScaleValue: document.getElementById('export-scale-value') as HTMLSpanElement,
  exportFolderPath: document.getElementById('export-folder-path') as HTMLDivElement | null,
  
  // Progress overlay
  progressOverlay: document.getElementById('progress-overlay') as HTMLDivElement,
  progressBar: document.getElementById('progress-bar') as HTMLDivElement,
  progressText: document.getElementById('progress-text') as HTMLParagraphElement,
  btnCancelExport: document.getElementById('btn-cancel-export') as HTMLButtonElement,

  // About modal
  aboutModal: document.getElementById('about-modal') as HTMLDivElement,
  btnCloseAbout: document.getElementById('btn-close-about') as HTMLButtonElement,
  btnAboutClose: document.getElementById('btn-about-close') as HTMLButtonElement,
  aboutLink: document.getElementById('about-link') as HTMLAnchorElement,
  
  // Confirmation modal
  confirmModal: document.getElementById('confirm-modal') as HTMLDivElement,
  confirmMessage: document.getElementById('confirm-message') as HTMLParagraphElement,
  btnConfirmYes: document.getElementById('btn-confirm-yes') as HTMLButtonElement,
  btnConfirmNo: document.getElementById('btn-confirm-no') as HTMLButtonElement,
};
