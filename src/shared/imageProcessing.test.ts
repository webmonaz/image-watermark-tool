// ============================================================================
// Image Processing Tests
// Tests for crop area calculation and watermark positioning
// Ensures WYSIWYG behavior between preview and export
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  calculateCropArea,
  calculateOutputDimensions,
  calculateWatermarkPosition,
  CROP_PRESETS,
} from './imageProcessing';
import type { CropSettings, WatermarkSettings } from '../types';

// ============================================================================
// Test Helpers
// ============================================================================

function createDefaultCropSettings(preset: CropSettings['preset'] = 'original'): CropSettings {
  return {
    preset,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  };
}

function createDefaultWatermarkSettings(position: WatermarkSettings['position'] = 'bottom-right'): WatermarkSettings {
  return {
    type: 'image',
    position,
    customX: 50,
    customY: 50,
    scale: 20,
  };
}

// ============================================================================
// Crop Area Calculation Tests
// ============================================================================

describe('calculateCropArea', () => {
  describe('original preset', () => {
    it('should return full image dimensions for original preset', () => {
      const result = calculateCropArea(1920, 1080, createDefaultCropSettings('original'));
      
      expect(result).toEqual({
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
      });
    });

    it('should ignore user modifications for original preset', () => {
      const cropSettings: CropSettings = {
        preset: 'original',
        x: 10,
        y: 20,
        width: 50,
        height: 60,
      };
      
      const result = calculateCropArea(1920, 1080, cropSettings);
      
      expect(result).toEqual({
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
      });
    });
  });

  describe('freeform preset', () => {
    it('should use percentage values for freeform crop', () => {
      const cropSettings: CropSettings = {
        preset: 'freeform',
        x: 10,
        y: 20,
        width: 50,
        height: 60,
      };
      
      const result = calculateCropArea(1000, 1000, cropSettings);
      
      expect(result).toEqual({
        x: 100,
        y: 200,
        width: 500,
        height: 600,
      });
    });

    it('should handle edge case of full freeform crop', () => {
      const cropSettings: CropSettings = {
        preset: 'freeform',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      };
      
      const result = calculateCropArea(800, 600, cropSettings);
      
      expect(result).toEqual({
        x: 0,
        y: 0,
        width: 800,
        height: 600,
      });
    });
  });

  describe('ratio-based presets without user modifications', () => {
    it('should center crop for 16:9 on a wider image', () => {
      // Image is 2000x1000 (2:1 ratio), target is 16:9
      const result = calculateCropArea(2000, 1000, createDefaultCropSettings('16:9'));
      
      // 16:9 = 1.777..., image is 2:1 = 2.0
      // Image is wider, so crop width
      // cropHeight = 1000, cropWidth = 1000 * (16/9) = 1777.77...
      const expectedWidth = 1000 * (16 / 9);
      const expectedX = (2000 - expectedWidth) / 2;
      
      expect(result.height).toBe(1000);
      expect(result.width).toBeCloseTo(expectedWidth, 1);
      expect(result.x).toBeCloseTo(expectedX, 1);
      expect(result.y).toBe(0);
    });

    it('should center crop for 16:9 on a taller image', () => {
      // Image is 1600x1200 (4:3 ratio), target is 16:9
      const result = calculateCropArea(1600, 1200, createDefaultCropSettings('16:9'));
      
      // 16:9 < 4:3, so image is taller - crop height
      // cropWidth = 1600, cropHeight = 1600 / (16/9) = 900
      const expectedHeight = 1600 / (16 / 9);
      const expectedY = (1200 - expectedHeight) / 2;
      
      expect(result.width).toBe(1600);
      expect(result.height).toBeCloseTo(expectedHeight, 1);
      expect(result.x).toBe(0);
      expect(result.y).toBeCloseTo(expectedY, 1);
    });

    it('should center crop for 1:1 square preset', () => {
      const result = calculateCropArea(1600, 1200, createDefaultCropSettings('1:1'));
      
      // Image is wider, so use height as basis
      // cropWidth = cropHeight = 1200
      expect(result.width).toBe(1200);
      expect(result.height).toBe(1200);
      expect(result.x).toBe(200); // (1600 - 1200) / 2
      expect(result.y).toBe(0);
    });

    it('should use fixed dimensions for facebook-thumb preset', () => {
      const result = calculateCropArea(2000, 1500, createDefaultCropSettings('facebook-thumb'));
      
      // facebookThumb is 1200x630, ratio = 1200/630 = 1.904...
      // Image is 2000x1500, ratio = 1.333
      // Image is taller than target, so crop height
      const targetRatio = 1200 / 630;
      const expectedHeight = 2000 / targetRatio;
      const expectedY = (1500 - expectedHeight) / 2;
      
      expect(result.width).toBe(2000);
      expect(result.height).toBeCloseTo(expectedHeight, 1);
      expect(result.x).toBe(0);
      expect(result.y).toBeCloseTo(expectedY, 1);
    });
  });

  describe('ratio-based presets WITH user modifications (moved/resized crop)', () => {
    it('should respect user-modified crop position for 16:9 preset', () => {
      // User has moved the crop box to top-left
      const cropSettings: CropSettings = {
        preset: '16:9',
        x: 5,
        y: 10,
        width: 60,
        height: 33.75, // 60 / (16/9) = 33.75 to maintain ratio
      };
      
      const result = calculateCropArea(1000, 1000, cropSettings);
      
      // Should use percentage values, NOT recalculate centered crop
      expect(result.x).toBe(50);  // 5% of 1000
      expect(result.y).toBe(100); // 10% of 1000
      expect(result.width).toBe(600);   // 60% of 1000
      expect(result.height).toBe(337.5); // 33.75% of 1000
    });

    it('should respect user-modified crop when only x is changed', () => {
      // User moved crop horizontally
      const cropSettings: CropSettings = {
        preset: '1:1',
        x: 25,
        y: 0,
        width: 100,
        height: 100,
      };
      
      const result = calculateCropArea(800, 600, cropSettings);
      
      // hasUserModifications = true because x !== 0
      expect(result.x).toBe(200); // 25% of 800
      expect(result.y).toBe(0);
      expect(result.width).toBe(800);
      expect(result.height).toBe(600);
    });

    it('should respect user-modified crop when width is changed', () => {
      // User resized the crop
      const cropSettings: CropSettings = {
        preset: '4:5',
        x: 0,
        y: 0,
        width: 80,
        height: 100,
      };
      
      const result = calculateCropArea(1000, 1000, cropSettings);
      
      // hasUserModifications = true because width !== 100
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
      expect(result.width).toBe(800);
      expect(result.height).toBe(1000);
    });
  });

  describe('edge cases', () => {
    it('should handle very small images', () => {
      const result = calculateCropArea(10, 10, createDefaultCropSettings('1:1'));
      
      expect(result.width).toBe(10);
      expect(result.height).toBe(10);
    });

    it('should handle exact ratio match', () => {
      // Image exactly matches 16:9
      const result = calculateCropArea(1920, 1080, createDefaultCropSettings('16:9'));
      
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
      expect(result.width).toBe(1920);
      expect(result.height).toBe(1080);
    });
  });
});

// ============================================================================
// Output Dimensions Tests
// ============================================================================

describe('calculateOutputDimensions', () => {
  it('should use fixed dimensions for presets with defined width/height', () => {
    // facebook-thumb is 1200x630
    const result = calculateOutputDimensions(
      800, 420, // crop area (not matching preset exactly)
      createDefaultCropSettings('facebook-thumb'),
      100 // 100% scale
    );
    
    expect(result.width).toBe(1200);
    expect(result.height).toBe(630);
  });

  it('should use crop dimensions for ratio-only presets', () => {
    const result = calculateOutputDimensions(
      800, 800,
      createDefaultCropSettings('1:1'),
      100
    );
    
    expect(result.width).toBe(800);
    expect(result.height).toBe(800);
  });

  it('should apply export scale correctly', () => {
    const result = calculateOutputDimensions(
      1200, 630,
      createDefaultCropSettings('facebook-thumb'),
      50 // 50% scale
    );
    
    expect(result.width).toBe(600);
    expect(result.height).toBe(315);
  });

  it('should clamp scale to valid range (25-200%)', () => {
    // Scale below 25% should be clamped to 25%
    const result1 = calculateOutputDimensions(
      1200, 630,
      createDefaultCropSettings('facebook-thumb'),
      10 // Should clamp to 25%
    );
    
    expect(result1.width).toBe(300);  // 1200 * 0.25
    expect(result1.height).toBe(158); // 630 * 0.25, rounded
    
    // Scale above 200% should be clamped to 200%
    const result2 = calculateOutputDimensions(
      1200, 630,
      createDefaultCropSettings('facebook-thumb'),
      300 // Should clamp to 200%
    );
    
    expect(result2.width).toBe(2400);
    expect(result2.height).toBe(1260);
  });

  it('should cap very large outputs at 8192px', () => {
    const result = calculateOutputDimensions(
      10000, 5000,
      createDefaultCropSettings('original'),
      200 // 200% scale = 20000x10000
    );
    
    // Should be scaled down to fit within 8192
    expect(result.width).toBeLessThanOrEqual(8192);
    expect(result.height).toBeLessThanOrEqual(8192);
  });

  it('should ensure minimum dimensions of 1px', () => {
    const result = calculateOutputDimensions(
      10, 10,
      createDefaultCropSettings('original'),
      25 // 25% of 10 = 2.5, rounds to 3
    );
    
    expect(result.width).toBeGreaterThanOrEqual(1);
    expect(result.height).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// Watermark Position Tests
// ============================================================================

describe('calculateWatermarkPosition', () => {
  const canvasWidth = 1000;
  const canvasHeight = 800;
  const watermarkWidth = 200;
  const watermarkHeight = 100;
  const padding = 20;

  it('should position watermark in top-left corner', () => {
    const result = calculateWatermarkPosition(
      canvasWidth, canvasHeight,
      watermarkWidth, watermarkHeight,
      createDefaultWatermarkSettings('top-left')
    );
    
    expect(result.x).toBe(padding);
    expect(result.y).toBe(padding);
  });

  it('should position watermark in top-right corner', () => {
    const result = calculateWatermarkPosition(
      canvasWidth, canvasHeight,
      watermarkWidth, watermarkHeight,
      createDefaultWatermarkSettings('top-right')
    );
    
    expect(result.x).toBe(canvasWidth - watermarkWidth - padding);
    expect(result.y).toBe(padding);
  });

  it('should position watermark in bottom-left corner', () => {
    const result = calculateWatermarkPosition(
      canvasWidth, canvasHeight,
      watermarkWidth, watermarkHeight,
      createDefaultWatermarkSettings('bottom-left')
    );
    
    expect(result.x).toBe(padding);
    expect(result.y).toBe(canvasHeight - watermarkHeight - padding);
  });

  it('should position watermark in bottom-right corner', () => {
    const result = calculateWatermarkPosition(
      canvasWidth, canvasHeight,
      watermarkWidth, watermarkHeight,
      createDefaultWatermarkSettings('bottom-right')
    );
    
    expect(result.x).toBe(canvasWidth - watermarkWidth - padding);
    expect(result.y).toBe(canvasHeight - watermarkHeight - padding);
  });

  it('should position watermark in center', () => {
    const result = calculateWatermarkPosition(
      canvasWidth, canvasHeight,
      watermarkWidth, watermarkHeight,
      createDefaultWatermarkSettings('center')
    );
    
    expect(result.x).toBe((canvasWidth - watermarkWidth) / 2);
    expect(result.y).toBe((canvasHeight - watermarkHeight) / 2);
  });

  it('should position watermark at custom percentage position', () => {
    const settings: WatermarkSettings = {
      ...createDefaultWatermarkSettings('custom'),
      customX: 25,
      customY: 75,
    };
    
    const result = calculateWatermarkPosition(
      canvasWidth, canvasHeight,
      watermarkWidth, watermarkHeight,
      settings
    );
    
    expect(result.x).toBe(250); // 25% of 1000
    expect(result.y).toBe(600); // 75% of 800
  });

  it('should handle custom position at 0,0', () => {
    const settings: WatermarkSettings = {
      ...createDefaultWatermarkSettings('custom'),
      customX: 0,
      customY: 0,
    };
    
    const result = calculateWatermarkPosition(
      canvasWidth, canvasHeight,
      watermarkWidth, watermarkHeight,
      settings
    );
    
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  it('should handle custom position at 100,100 (watermark at bottom-right)', () => {
    const settings: WatermarkSettings = {
      ...createDefaultWatermarkSettings('custom'),
      customX: 100,
      customY: 100,
    };
    
    const result = calculateWatermarkPosition(
      canvasWidth, canvasHeight,
      watermarkWidth, watermarkHeight,
      settings
    );
    
    // At 100%, watermark top-left is at canvas edge (watermark extends outside)
    expect(result.x).toBe(1000);
    expect(result.y).toBe(800);
  });

  it('should fall back to top-left for unknown position', () => {
    const settings = {
      ...createDefaultWatermarkSettings('bottom-right'),
      position: 'unknown' as WatermarkSettings['position'],
    };
    
    const result = calculateWatermarkPosition(
      canvasWidth, canvasHeight,
      watermarkWidth, watermarkHeight,
      settings
    );
    
    expect(result.x).toBe(padding);
    expect(result.y).toBe(padding);
  });
});

// ============================================================================
// CROP_PRESETS Configuration Tests
// ============================================================================

describe('CROP_PRESETS', () => {
  it('should have all expected presets defined', () => {
    const expectedPresets = [
      'original', 'freeform',
      'facebook-thumb', 'facebook-post',
      'youtube-thumb', 'tiktok-thumb',
      '1:1', '4:5', '16:9', '9:16'
    ];
    
    expectedPresets.forEach(preset => {
      expect(CROP_PRESETS).toHaveProperty(preset);
    });
  });

  it('should have correct dimensions for fixed-size presets', () => {
    expect(CROP_PRESETS['facebook-thumb']).toEqual({ width: 1200, height: 630 });
    expect(CROP_PRESETS['facebook-post']).toEqual({ width: 1200, height: 1200 });
    expect(CROP_PRESETS['youtube-thumb']).toEqual({ width: 1280, height: 720 });
    expect(CROP_PRESETS['tiktok-thumb']).toEqual({ width: 1080, height: 1920 });
  });

  it('should have correct ratios for ratio-based presets', () => {
    expect(CROP_PRESETS['1:1'].ratio).toBe(1);
    expect(CROP_PRESETS['4:5'].ratio).toBe(4/5);
    expect(CROP_PRESETS['16:9'].ratio).toBe(16/9);
    expect(CROP_PRESETS['9:16'].ratio).toBe(9/16);
  });

  it('should have empty config for original and freeform', () => {
    expect(CROP_PRESETS['original']).toEqual({});
    expect(CROP_PRESETS['freeform']).toEqual({});
  });
});

// ============================================================================
// Integration Tests - Preview/Export Consistency
// ============================================================================

describe('Preview/Export Consistency', () => {
  it('should produce same crop area for moved 16:9 crop box', () => {
    // Simulate user moving the 16:9 crop box to a custom position
    const cropSettings: CropSettings = {
      preset: '16:9',
      x: 15,
      y: 10,
      width: 70,
      height: 39.375, // 70 / (16/9)
    };
    
    // Both preview and worker should use this function
    const result = calculateCropArea(1920, 1080, cropSettings);
    
    // Verify it uses the user's position, not centered
    expect(result.x).toBe(288);   // 15% of 1920
    expect(result.y).toBe(108);   // 10% of 1080
    expect(result.width).toBe(1344);    // 70% of 1920
    expect(result.height).toBeCloseTo(425.25, 1); // 39.375% of 1080
  });

  it('should maintain watermark position relative to crop area', () => {
    // Crop a 1000x1000 image to 500x500 (50% width/height from center)
    const cropSettings: CropSettings = {
      preset: 'freeform',
      x: 25,
      y: 25,
      width: 50,
      height: 50,
    };
    
    const cropArea = calculateCropArea(1000, 1000, cropSettings);
    expect(cropArea.width).toBe(500);
    expect(cropArea.height).toBe(500);
    
    // Place watermark at bottom-right of crop area
    const watermarkPos = calculateWatermarkPosition(
      cropArea.width, cropArea.height,
      100, 50, // watermark size
      createDefaultWatermarkSettings('bottom-right')
    );
    
    // Watermark should be positioned relative to crop area, not original image
    expect(watermarkPos.x).toBe(500 - 100 - 20); // 380
    expect(watermarkPos.y).toBe(500 - 50 - 20);  // 430
  });
});
