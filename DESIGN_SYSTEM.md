# Image Watermark Tool - Design System

A comprehensive design system for maintaining consistency across the application.

## Table of Contents

1. [Design Principles](#design-principles)
2. [Color System](#color-system)
3. [Typography](#typography)
4. [Spacing System](#spacing-system)
5. [Layout Components](#layout-components)
6. [UI Components](#ui-components)
7. [Icons](#icons)
8. [Keyboard Shortcuts](#keyboard-shortcuts)
9. [Accessibility](#accessibility)
10. [Performance Guidelines](#performance-guidelines)

---

## Design Principles

### 1. Simplicity First
- Keep interfaces clean and uncluttered
- Show only essential information by default
- Use progressive disclosure for advanced features

### 2. Performance Focused
- Optimize for large image handling (4K+)
- Use thumbnails for previews, full resolution only when needed
- Lazy load and cache aggressively

### 3. Professional Workflow
- Support keyboard-driven workflows
- Respect industry-standard shortcuts
- Provide quick access to common actions

### 4. Non-Destructive Editing
- Never modify original files
- Support undo/redo for all actions
- Allow project save/restore

---

## Color System

### CSS Variables

```css
:root {
  /* ========================================
     LIGHT THEME (Default)
     ======================================== */
  
  /* Primary Brand Colors */
  --color-primary: #3b82f6;
  --color-primary-hover: #2563eb;
  --color-primary-active: #1d4ed8;
  --color-primary-light: rgba(59, 130, 246, 0.1);
  
  /* Semantic Colors */
  --color-success: #22c55e;
  --color-success-hover: #16a34a;
  --color-success-light: rgba(34, 197, 94, 0.1);
  
  --color-danger: #ef4444;
  --color-danger-hover: #dc2626;
  --color-danger-light: rgba(239, 68, 68, 0.1);
  
  --color-warning: #f59e0b;
  --color-warning-hover: #d97706;
  --color-warning-light: rgba(245, 158, 11, 0.1);
  
  --color-info: #06b6d4;
  --color-info-hover: #0891b2;
  
  /* Neutral Colors - Light Theme */
  --color-bg: #f8fafc;
  --color-bg-secondary: #ffffff;
  --color-bg-tertiary: #f1f5f9;
  --color-bg-elevated: #ffffff;
  
  --color-border: #e2e8f0;
  --color-border-focus: #94a3b8;
  --color-border-strong: #cbd5e1;
  
  --color-text: #1e293b;
  --color-text-secondary: #64748b;
  --color-text-muted: #94a3b8;
  --color-text-inverse: #ffffff;
  
  /* Canvas/Preview Background */
  --color-canvas-bg: #1e293b;
  --color-canvas-pattern: #334155;
}

/* ========================================
   DARK THEME
   ======================================== */

[data-theme="dark"] {
  --color-bg: #0f172a;
  --color-bg-secondary: #1e293b;
  --color-bg-tertiary: #334155;
  --color-bg-elevated: #1e293b;
  
  --color-border: #334155;
  --color-border-focus: #475569;
  --color-border-strong: #475569;
  
  --color-text: #f1f5f9;
  --color-text-secondary: #94a3b8;
  --color-text-muted: #64748b;
  
  --color-canvas-bg: #0f172a;
  --color-canvas-pattern: #1e293b;
}
```

### Color Usage Guidelines

| Purpose | Light Theme | Dark Theme |
|---------|-------------|------------|
| Page background | `--color-bg` | `--color-bg` |
| Cards/Panels | `--color-bg-secondary` | `--color-bg-secondary` |
| Input backgrounds | `--color-bg-secondary` | `--color-bg-tertiary` |
| Primary actions | `--color-primary` | `--color-primary` |
| Destructive actions | `--color-danger` | `--color-danger` |
| Success states | `--color-success` | `--color-success` |
| Borders | `--color-border` | `--color-border` |
| Primary text | `--color-text` | `--color-text` |
| Secondary text | `--color-text-secondary` | `--color-text-secondary` |

---

## Typography

### Font Stack

```css
--font-family-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 
                    'Helvetica Neue', Arial, sans-serif;
--font-family-mono: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', 
                    Consolas, monospace;
```

### Font Sizes

| Token | Size | Line Height | Usage |
|-------|------|-------------|-------|
| `--text-xs` | 11px | 1.4 | Captions, badges |
| `--text-sm` | 12px | 1.4 | Help text, labels |
| `--text-base` | 14px | 1.5 | Body text, inputs |
| `--text-lg` | 16px | 1.5 | Section headers |
| `--text-xl` | 18px | 1.4 | Page titles |
| `--text-2xl` | 24px | 1.3 | Modal titles |

### Font Weights

| Token | Weight | Usage |
|-------|--------|-------|
| `--font-normal` | 400 | Body text |
| `--font-medium` | 500 | Labels, buttons |
| `--font-semibold` | 600 | Headers, emphasis |
| `--font-bold` | 700 | Strong emphasis |

---

## Spacing System

### Base Unit: 4px

| Token | Value | Usage |
|-------|-------|-------|
| `--spacing-xs` | 4px | Tight spacing, icon gaps |
| `--spacing-sm` | 8px | Compact elements |
| `--spacing-md` | 16px | Standard padding |
| `--spacing-lg` | 24px | Section spacing |
| `--spacing-xl` | 32px | Large gaps |
| `--spacing-2xl` | 48px | Page sections |

### Layout Dimensions

```css
--sidebar-width: 280px;
--sidebar-width-collapsed: 60px;
--header-height: 56px;
--titlebar-height: 28px;
--footer-height: 32px;
--modal-width-sm: 400px;
--modal-width-md: 560px;
--modal-width-lg: 720px;
```

---

## Layout Components

### Application Shell

```
+------------------------------------------+
|  Titlebar (drag region, 28px)            |
+------------------------------------------+
|  Header (actions, 56px)                  |
+--------+-------------------+-------------+
|        |                   |             |
| Left   |    Main Content   |    Right    |
| Side   |    (Preview)      |    Side     |
| bar    |                   |    bar      |
| 280px  |    Flexible       |    280px    |
|        |                   |             |
+--------+-------------------+-------------+
|  Status Bar (optional, 32px)             |
+------------------------------------------+
```

### Panel Structure

```html
<aside class="sidebar sidebar-left">
  <div class="sidebar-header">
    <h2>Title</h2>
    <span class="badge">0</span>
  </div>
  <div class="sidebar-content">
    <!-- Scrollable content -->
  </div>
  <div class="sidebar-footer">
    <!-- Actions -->
  </div>
</aside>
```

### Control Section Structure

```html
<div class="control-section">
  <div class="control-section-header">
    <h3>Section Title</h3>
    <button class="btn btn-small">Action</button>
  </div>
  <div class="control-group">
    <label>Field Label</label>
    <div class="help-text">Description of the field</div>
    <input type="text" />
  </div>
</div>
```

---

## UI Components

### Buttons

#### Variants

| Class | Usage |
|-------|-------|
| `.btn-primary` | Main actions (Add, Save, Export) |
| `.btn-secondary` | Secondary actions (Cancel, Select) |
| `.btn-success` | Positive confirmations (Export, Apply) |
| `.btn-danger` | Destructive actions (Delete, Clear) |
| `.btn-ghost` | Subtle actions (Close, Dismiss) |

#### Sizes

| Class | Height | Padding |
|-------|--------|---------|
| `.btn-small` | 28px | 4px 8px |
| `.btn` (default) | 32px | 8px 16px |
| `.btn-large` | 40px | 12px 24px |

#### States

```css
.btn:hover { /* Darken background 10% */ }
.btn:active { /* Darken background 15% */ }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn:focus-visible { /* Focus ring */ }
```

### Form Inputs

#### Text Input

```html
<div class="control-group">
  <label for="input-id">Label</label>
  <div class="help-text">Optional description</div>
  <input type="text" id="input-id" placeholder="Placeholder" />
  <div class="error-text">Error message</div>
</div>
```

#### Select

```html
<select class="select">
  <option value="">Choose option...</option>
  <optgroup label="Group">
    <option value="1">Option 1</option>
  </optgroup>
</select>
```

#### Range Slider

```html
<div class="control-group">
  <label>Scale: <span class="value">20</span>%</label>
  <input type="range" min="5" max="100" value="20" />
</div>
```

### Cards

```html
<div class="card">
  <div class="card-header">
    <h4>Card Title</h4>
    <button class="btn-icon">×</button>
  </div>
  <div class="card-body">
    <!-- Content -->
  </div>
  <div class="card-footer">
    <button class="btn btn-secondary">Cancel</button>
    <button class="btn btn-primary">Confirm</button>
  </div>
</div>
```

### Modals

```html
<div class="modal-overlay">
  <div class="modal" role="dialog">
    <div class="modal-header">
      <h3>Modal Title</h3>
      <button class="btn-close" aria-label="Close">×</button>
    </div>
    <div class="modal-body">
      <!-- Content -->
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary">Cancel</button>
      <button class="btn btn-primary">Confirm</button>
    </div>
  </div>
</div>
```

### Tooltips

```html
<button data-tooltip="Helpful description" data-tooltip-position="top">
  Hover me
</button>
```

Positions: `top`, `bottom`, `left`, `right`

### Badges

```html
<span class="badge">12</span>
<span class="badge badge-success">Done</span>
<span class="badge badge-warning">Modified</span>
<span class="badge badge-danger">Error</span>
```

---

## Icons

### Icon System

Use inline SVG icons for best performance and styling flexibility.

```html
<svg class="icon" width="16" height="16" viewBox="0 0 24 24" 
     fill="none" stroke="currentColor" stroke-width="2">
  <path d="..." />
</svg>
```

### Icon Sizes

| Class | Size | Usage |
|-------|------|-------|
| `.icon-sm` | 14px | Inline with small text |
| `.icon` | 16px | Default, buttons |
| `.icon-md` | 20px | Headers, emphasis |
| `.icon-lg` | 24px | Feature icons |
| `.icon-xl` | 32px | Empty states |

### Common Icons (SVG Paths)

```javascript
const ICONS = {
  // File operations
  folder: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
  save: 'M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z M17 21v-8H7v8 M7 3v5h8',
  
  // Edit operations
  undo: 'M3 10h10a5 5 0 015 5v2 M3 10l4-4 M3 10l4 4',
  redo: 'M21 10H11a5 5 0 00-5 5v2 M21 10l-4-4 M21 10l-4 4',
  
  // View operations
  zoomIn: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z M10 7v6 M7 10h6',
  zoomOut: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z M7 10h6',
  zoomFit: 'M15 3h6v6 M9 21H3v-6 M21 3l-7 7 M3 21l7-7',
  
  // UI elements
  close: 'M18 6L6 18 M6 6l12 12',
  menu: 'M4 6h16 M4 12h16 M4 18h16',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06...',
  info: 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M12 16v-4 M12 8h.01',
};
```

---

## Keyboard Shortcuts

### Global Shortcuts

| Shortcut | Action | Context |
|----------|--------|---------|
| `Cmd/Ctrl + O` | Open project | Global |
| `Cmd/Ctrl + S` | Save project | Global |
| `Cmd/Ctrl + Shift + S` | Save project as | Global |
| `Cmd/Ctrl + ,` | Open settings | Global |
| `Cmd/Ctrl + Z` | Undo | Global |
| `Cmd/Ctrl + Shift + Z` | Redo | Global |
| `Cmd/Ctrl + Y` | Redo (alternative) | Global |

### Image Navigation

| Shortcut | Action |
|----------|--------|
| `Arrow Up/Down` | Previous/Next image |
| `Home` | First image |
| `End` | Last image |
| `Delete/Backspace` | Remove selected image |

### Zoom Controls

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + +` or `Cmd/Ctrl + =` | Zoom in |
| `Cmd/Ctrl + -` | Zoom out |
| `Cmd/Ctrl + 0` | Fit to view |
| `Cmd/Ctrl + 1` | Actual size (100%) |
| `Space + Drag` | Pan (when zoomed) |
| `Mouse Wheel` | Zoom in/out |

### Export

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + E` | Export all |
| `Cmd/Ctrl + Shift + E` | Export selected |

---

## Accessibility

### Focus Management

- All interactive elements must be focusable
- Focus order follows visual layout
- Modal dialogs trap focus
- Return focus to trigger after modal closes

### ARIA Patterns

```html
<!-- Dialog -->
<div role="dialog" aria-modal="true" aria-labelledby="modal-title">
  <h2 id="modal-title">Dialog Title</h2>
</div>

<!-- Alert -->
<div role="alert" aria-live="polite">
  Operation completed successfully
</div>

<!-- Progress -->
<div role="progressbar" aria-valuenow="50" aria-valuemin="0" aria-valuemax="100">
  50% complete
</div>

<!-- Image with action -->
<div role="button" tabindex="0" aria-label="Select image: photo.jpg">
  <img src="..." alt="" />
</div>
```

### Color Contrast

- Text contrast ratio: minimum 4.5:1 (WCAG AA)
- Large text (18px+): minimum 3:1
- Interactive elements: minimum 3:1 against background

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Performance Guidelines

### Image Handling

| Use Case | Max Dimension | Format | Quality |
|----------|---------------|--------|---------|
| Sidebar thumbnail | 200px | JPEG | 85% |
| Preview (Performance) | 800px | JPEG | 80% |
| Preview (Quality) | 1600px | JPEG | 90% |
| Preview (Full) | Original | Original | 100% |
| Export | Original | User choice | User choice |

### Lazy Loading

```javascript
// Load thumbnails immediately
// Load preview on selection
// Load full resolution only when:
//   - User selects "Full Quality" mode
//   - User zooms beyond preview resolution
//   - Exporting
```

### Memory Management

```javascript
// Thumbnail cache: Keep all (small)
// Preview cache: Keep last 5 images
// Full resolution: Keep only current, release on switch
// Watermark image: Single cached instance
```

### Debouncing

| Action | Debounce Time |
|--------|---------------|
| Search/Filter | 300ms |
| Slider changes | 16ms (RAF) |
| Window resize | 100ms |
| Auto-save | 2000ms |

---

## File Formats

### Project File (.iwp)

```json
{
  "version": "1.0.0",
  "savedAt": "2024-01-15T10:30:00Z",
  "settings": {
    "globalWatermarkSettings": { ... },
    "exportSettings": { ... }
  },
  "images": [
    {
      "id": "abc123",
      "fileName": "photo.jpg",
      "filePath": "/Users/.../photo.jpg",
      "width": 4000,
      "height": 3000,
      "watermarkSettings": { ... },
      "cropSettings": { ... }
    }
  ]
}
```

### Settings File

```json
{
  "theme": "auto",
  "previewQuality": "balanced",
  "thumbnailQuality": "performance",
  "recentProjects": [],
  "defaultExportFormat": "jpg",
  "defaultExportQuality": 85,
  "shortcuts": { ... }
}
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-01 | Initial design system |

---

## Contributing

When adding new components or modifying existing ones:

1. Update this document first
2. Follow existing naming conventions
3. Test in both light and dark themes
4. Verify keyboard accessibility
5. Check performance impact
