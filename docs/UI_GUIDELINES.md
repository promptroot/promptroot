# PromptRoot UI Guidelines

**Version:** 2.0  
**Last Updated:** January 6, 2026

These conventions ensure UI changes remain consistent, maintainable, and accessible across all pages and features. Follow them for new features and when refactoring existing code.

> **Note**: For JavaScript patterns and code style, see [CODE_STYLE_GUIDE.md](CODE_STYLE_GUIDE.md).

---

## Design Principles

1. **Consistency first**: Use shared utilities, components, and patterns.
2. **Semantic HTML**: Proper headings (`<h1>`, `<h2>`), lists (`<ul>`, `<ol>`), buttons (`<button>`), and inputs with appropriate elements.
3. **No inline styles**: Prefer utility classes and component styles. Avoid `style=""` attributes.
4. **File type segregation**: Keep CSS in `.css` files, JS in `.js` files, HTML in `.html` files. No `<style>` or `<script>` tags in HTML. No HTML strings in JS.
5. **Responsive by default**: Layouts should flex/stack cleanly across breakpoints (1000px, 600px, 400px).
6. **Dark theme optimized**: Use CSS custom properties (`:root` variables) for colors.

---

## CSS Architecture

### File Structure

```
src/styles/
├── base.css           # Variables, reset, global utilities
├── layout.css         # Grid, responsive breakpoints
├── components/        # Reusable UI components
│   ├── buttons.css
│   ├── card.css
│   ├── content.css
│   ├── dropdown.css
│   ├── header.css
│   ├── modals.css
│   ├── navbar.css
│   ├── pills.css
│   ├── sidebar.css
│   ├── status-bar.css
│   ├── list.css
│   ├── tree.css
│   └── tags.css
└── pages/             # Page-specific styles
    ├── home.css
    ├── jules.css
    ├── queue.css
    ├── sessions.css
    ├── profile.css
    └── webcapture.css
```

### CSS Variables (Design Tokens)

Located in `base.css`:

```css
:root {
  /* Core Colors */
  --bg: #0a0e1a;
  --text: #f0f3f8;
  --accent: #4dd9ff;
  --accent-glow: #4dd9ff1a;
  --border: #222438;
  
  /* Gradients */
  --gradient-primary: linear-gradient(135deg, #4dd9ff 0%, #5ad1ff 100%);
  --gradient-bg: linear-gradient(180deg, #0d1424 0%, #0a0e1a 100%);
  
  /* Semantic Colors */
  --danger: #c0504d;
  --warn: #f39c12;
  --info: #2980b9;
  --success: #27ae60;
  --error: #ff6b6b;
}
```

**Usage**: Always reference variables (`var(--accent)`) rather than hardcoding colors.

---

## Naming Conventions

- **Hyphen-case**: `.section-heading`, `.user-menu`, `.modal-content`
- **BEM-inspired for components**: `.modal`, `.modal__content`, `.modal__overlay`
- **Modifier variants with double dash**: `.btn--sm`, `.btn--primary`, `.custom-dropdown--compact`
- **State classes**: `.hidden`, `.show`, `.open`, `.active`, `.collapsed`
- **Utility classes**: Short, composable helpers (`.mb-md`, `.flex`, `.gap-sm`)

---

## Utility Classes

### Layout Utilities

```css
.flex          /* display: flex */
.grid          /* display: grid */
.hidden        /* display: none !important */
.w-full        /* width: 100% */
```

### Spacing Utilities

```css
.gap-sm        /* gap: 8px */
.gap-md        /* gap: 16px */
.mb-sm         /* margin-bottom: 8px */
.mb-md         /* margin-bottom: 16px */
.mt-sm         /* margin-top: 8px */
.mt-md         /* margin-top: 16px */
.ml-auto       /* margin-left: auto */
.pad-lg        /* padding: 24px */
.pad-xl        /* padding: 48px */
```

### Typography Utilities

```css
.text-center   /* text-align: center */
.font-16       /* font-size: 16px */
.fw-600        /* font-weight: 600 */
.small-text    /* font-size: 13px */
```

### Overflow Utilities

```css
.y-scroll      /* overflow-y: auto */
.max-h-300     /* max-height: 300px */
.max-h-250     /* max-height: 250px */
.min-h-400     /* min-height: 400px */
```

### Additional Typography

```css
.font-12       /* font-size: 12px */
.font-15       /* font-size: 15px */
.font-18       /* font-size: 18px */
.font-20       /* font-size: 20px */
.font-24       /* font-size: 24px */
.font-28       /* font-size: 28px */
.font-48       /* font-size: 48px */
.lh-16         /* line-height: 1.6 */
.lh-18         /* line-height: 1.8 */
```

### Additional Spacing

```css
.mb-lg         /* margin-bottom: 24px */
.mb-xl         /* margin-bottom: 40px */
.mt-lg         /* margin-top: 28px */
.mt-none       /* margin-top: 0 */
.m-auto        /* margin-left/right: auto */
```

### Flex Utilities

```css
.flex-1        /* flex: 1 */
.flex-shrink-0 /* flex-shrink: 0 */
```

### Layout Overrides

```css
.wrap-single   /* Force single column layout */
```

---

## Component Patterns

### Buttons

**Classes**: `.btn`, `.btn.primary`, `.btn.danger`, `.btn.warn`, `.btn.info`, `.btn.success`  
**Size variants**: `.btn.sm`, `.btn.lg`, `.btn.xl`

```html
<button class="btn">Default</button>
<button class="btn primary">Primary</button>
<button class="btn danger">Delete</button>
<button class="btn sm">Compact</button>
<button class="btn xl primary">Large Primary</button>
```

**Guidelines**:
- Use semantic variants for intent (`.primary` for primary actions, `.danger` for destructive)
- Use `.btn.sm` for header/toolbar actions to keep UI compact
- Avoid inline styles; use defined size/variant classes

### Cards

**Class**: `.card`

```html
<div class="card pad-lg">
  <!-- Card content -->
</div>
```

**Guidelines**:
- Use `.card` for main content containers (sidebar, main area)
- Combine with padding utilities (`.pad-lg`, `.pad-xl`)
- Cards have gradient background, border, rounded corners, and backdrop blur

### Modals

**Structure**:
```html
<div id="exampleModal" class="modal">
  <div class="modal-content">
    <h2>Modal Title</h2>
    <p>Description text</p>
    <!-- Form inputs, content -->
    <div class="modal-buttons">
      <button class="btn">Cancel</button>
      <button class="btn primary">Confirm</button>
    </div>
  </div>
</div>
```

**Size variants**: `.modal-content.modal-sm`, `.modal-content.modal-lg`, `.modal-content.modal-xl`

**Show/hide**: Toggle `.show` class on `.modal`

```javascript
modal.classList.add('show');    // Open
modal.classList.remove('show'); // Close
```

**Accessibility requirements**:
- Add `role="dialog"` and `aria-modal="true"`
- Label with `aria-labelledby` pointing to heading ID
- Trap focus within modal when open
- Close on `Esc` key and overlay click
- Restore focus to trigger element on close

**Inputs**: Use `.modal-input` for text inputs, `.modal-textarea` for textareas, `.modal select` for dropdowns

### Dropdowns

**Structure**:
```html
<div class="custom-dropdown">
  <button class="custom-dropdown-btn" type="button">
    <span>Selected Item</span>
    <span class="custom-dropdown-caret">▼</span>
  </button>
  <div class="custom-dropdown-menu" role="menu">
    <div class="custom-dropdown-item">Item 1</div>
    <div class="custom-dropdown-item selected">Item 2</div>
    <div class="custom-dropdown-item">Item 3</div>
  </div>
</div>
```

**Variants**:
- `.custom-dropdown--compact`: Narrow trigger width
- `.custom-dropdown--wide-menu`: Wide menu anchored to right

**Show/hide**: Toggle menu `display` via JavaScript or manage with state class

**Accessibility requirements**:
- Add `aria-haspopup="true"` and `aria-expanded="false/true"` to button
- Support Arrow keys for navigation, Enter/Space to select, Esc to close
- Close on outside click
- Add `role="menu"` to menu and `role="menuitem"` to items

### Pills/Badges

**Class**: `.pill`

```html
<span class="pill">Active</span>
```

**Guidelines**:
- Use for status indicators, tags, and labels
- Inline-flex with icon support

### Lists & Items

**Class**: `.item`

```html
<div class="item">
  <div>
    <div class="item-title">Item Title</div>
    <div class="item-meta">Metadata</div>
  </div>
  <!-- Actions -->
</div>
```

**Active state**: Add `.active` class for selected items

### Status Bar

**ID**: `#statusBar`  
**Show/hide**: Toggle `.status-visible` class

```javascript
statusBar.classList.add('status-visible');
statusBar.querySelector('.status-msg').textContent = 'Processing...';
```

**Guidelines**:
- Use for long-running operations
- Position: fixed at bottom
- Replace native `alert()`, `confirm()`, `prompt()` with non-blocking UI

### Tree Navigation

**Structure**: Used in sidebar for hierarchical file lists

```html
<div class="tree-dir">
  <button aria-expanded="false">▶</button>
  <span class="folder-name">Folder Name</span>
  <div class="folder-icons">
    <span class="add-file-icon">+</span>
  </div>
</div>
```

**State class**: `.submenu-open` when expanded

### Menu Panels

**Structure**: Contextual popup menus

```html
<div class="menu-anchor">
  <button class="btn">Actions ▼</button>
  <div class="menu-panel menu-panel-sm menu-panel--below-left">
    <div class="custom-dropdown-item">Option 1</div>
    <div class="custom-dropdown-item">Option 2</div>
  </div>
</div>
```

**Size variants**:
- `.menu-panel-sm`: min-width 150px
- `.menu-panel-md`: min-width 180px

**Position variants**:
- `.menu-panel--above`: Opens above trigger
- `.menu-panel--below-left`: Opens below, aligned left
- `.menu-panel--below-right`: Opens below, aligned right

### Scroll Boxes

**Class**: `.scroll-box` for content previews

```html
<div class="scroll-box scroll-box-sm">
  <!-- Scrollable content -->
</div>
```

**Variants**:
- `.scroll-box-sm`: max-height 150px

**Guidelines**:
- Use for content previews and text displays
- Includes pre-wrap and overflow-y auto

### Tag Badges

**Structure**: Colored classification tags

```html
<div class="tag-container">
  <span class="tag-badge tag-review">Review</span>
  <span class="tag-badge tag-bug">Bug</span>
  <span class="tag-badge tag-design">Design</span>
  <span class="tag-badge tag-refactor">Refactor</span>
</div>
```

**Variants**:
- `.tag-review`: Purple theme
- `.tag-bug`: Red theme
- `.tag-design`: Blue theme
- `.tag-refactor`: Purple theme

---

## Layout Patterns

### Page Structure

```html
<body data-page="home">
  <div class="wrap">
    <aside id="sidebar" class="card">
      <!-- Sidebar content -->
    </aside>
    <main id="main" class="card pad-lg">
      <!-- Main content -->
    </main>
  </div>
</body>
```

**Guidelines**:
- Use `.wrap` container for grid layout (sidebar + main)
- Add `data-page` attribute to `<body>` for page identification
- Sidebar collapses responsively on mobile (< 1000px)

### Section Headings

**Class**: `.section-heading`

```html
<h2 class="section-heading">Section Title</h2>
```

**Guidelines**:
- Consistent margin and sizing
- Use for major page sections

**Variants**:
- `.section-title`: Alternative section heading style (20px)
- `.section-title-lg`: Larger page-level heading (24px, bold)
- `.section-subheading`: Smaller subheading (16px, bold)
- `.section-label`: Muted label text (14px, muted color)
- `.section-mb`: Bottom margin for sections (40px)

### Page Headers with Actions

```html
<div class="page-header">
  <h2 class="section-title-lg">Page Title</h2>
  <div class="toolbar-actions">
    <button class="btn sm">Action 1</button>
    <button class="btn sm primary">Action 2</button>
  </div>
</div>
```

### Toolbars

**Class**: `.toolbar`

```html
<div class="toolbar">
  <div>Left content</div>
  <div class="toolbar-actions">
    <button class="btn sm">Filter</button>
    <button class="btn sm">Sort</button>
  </div>
</div>
```

### Forms

**Structure**:
```html
<div class="form-row">
  <div class="form-col">
    <label class="form-label">Label:</label>
    <input type="text" class="modal-input" />
  </div>
  <div class="form-col">
    <label class="form-label">Label:</label>
    <input type="text" class="modal-input" />
  </div>
</div>
```

**Form controls**:
- `.modal-input`: Text inputs
- `.modal-textarea`: Textareas
- `.text-input`: Larger textarea variant
- `.form-label`: Form labels
- `.options-box`: Container for checkbox/radio groups

### Panels

**Classes**: `.panel`, `.panel-tight`

```html
<div class="panel">
  <!-- Panel content -->
</div>
```

**Variants**:
- `.panel`: Standard panel with margin
- `.panel-tight`: No margin
- `.danger-panel`: Red-themed warning panel
- `.hero-panel`: Large centered promotional panel
- `.instruction-panel`: Documentation/guide panel
- `.info-card`: Information display card

### Error Display

**Components for error states**:

```html
<div class="error-banner">
  <span>⚠️</span>
  <span>Error message here</span>
</div>

<div class="error-details">
  <!-- Error stack trace or details -->
</div>
```

**Classes**:
- `.error-banner`: Alert-style error display
- `.error-details`: Monospace error details
- `.error-title`: Error heading
- `.danger-text`: Red danger text

---

## Responsive Breakpoints

Defined in `layout.css`:

| Breakpoint | Max Width | Behavior |
|------------|-----------|----------|
| Desktop | > 1000px | Two-column grid (sidebar + main) |
| Tablet/Mobile | ≤ 1000px | Single column, mobile menu |
| Mobile | ≤ 600px | Adjusted spacing, status bar |
| Small Mobile | ≤ 400px | Compact navbar, smaller fonts |

**Mobile-specific**:
- `#mobileMenuBtn` shows hamburger menu
- `#mobileSidebar` slides in from left
- `#mobileOverlay` adds backdrop
- Desktop sidebar hidden, replaced by mobile navigation

---

## Accessibility Guidelines

### Keyboard Support

| Component | Keys | Behavior |
|-----------|------|----------|
| Modals | `Esc` | Close modal |
| Dropdowns | `Arrow Up/Down` | Navigate items |
| | `Enter/Space` | Select item |
| | `Esc` | Close dropdown |
| Buttons/Links | `Enter/Space` | Activate |
| Tree navigation | `Arrow Left/Right` | Collapse/expand |

### Focus Management

- **Modals**: Trap focus within modal when open; restore focus to trigger on close
- **Dropdowns**: Move focus to first item when opened
- **Focus indicators**: Ensure visible focus styles (`:focus`)

### ARIA Attributes

- **Modals**: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
- **Dropdowns**: `aria-haspopup="true"`, `aria-expanded`, `role="menu"`, `role="menuitem"`
- **Buttons**: `aria-label` for icon-only buttons
- **Expandable sections**: `aria-expanded="true/false"`

### Color Contrast

- Meet WCAG AA standards (4.5:1 for normal text, 3:1 for large text)
- Test with color contrast tools
- Use semantic color variables for consistency

### Semantic HTML

- Use proper heading hierarchy (`<h1>` → `<h2>` → `<h3>`)
- Use `<button>` for actions, `<a>` for navigation
- Use `<label>` for form inputs
- Use semantic elements: `<nav>`, `<main>`, `<aside>`, `<header>`, `<footer>`

---

## Anti-Patterns (Avoid)

❌ **Inline styles**
```html
<div style="color: red; padding: 10px;">Bad</div>
```
✅ Use utility classes or component styles

❌ **Direct style manipulation**
```javascript
element.style.display = 'block';
```
✅ Use `.hidden` class and `toggleClass()`

❌ **Generic IDs**
```html
<div id="modal">...</div>
<div id="modal">...</div> <!-- Conflict! -->
```
✅ Use specific IDs or classes

❌ **Hard-coded colors**
```css
.my-element { color: #4dd9ff; }
```
✅ Use CSS variables
```css
.my-element { color: var(--accent); }
```

❌ **Non-semantic HTML**
```html
<div onclick="handleClick()">Click me</div>
```
✅ Use semantic elements
```html
<button onclick="handleClick()">Click me</button>
```

❌ **Native blocking popups**
```javascript
alert('Hello');
confirm('Are you sure?');
```
✅ Use modals and status bar

---

## Review Checklist

Before merging UI changes, verify:

- [ ] Section spacing consistent (`.section-heading`, `.page-header`)
- [ ] Header actions use `.btn.sm` for compactness
- [ ] No inline styles; use utility/component classes
- [ ] No `<style>` tags in HTML files
- [ ] No `<script>` tags with inline JS in HTML files
- [ ] No HTML string generation in JS files
- [ ] Modals and dropdowns use shared structure
- [ ] Keyboard accessible (Enter/Space/Arrow/Esc support)
- [ ] Focus management implemented for modals/dropdowns
- [ ] ARIA attributes present where appropriate
- [ ] Color contrast meets WCAG AA standards
- [ ] Responsive across breakpoints (1000px, 600px, 400px)
- [ ] Semantic HTML elements used
- [ ] CSS variables used for colors (not hard-coded hex values)
- [ ] Works with dark theme

---

## Common Tasks

### Add a new page

**1. Create HTML file** in `pages/pagename/pagename.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Page Title</title>
  <link rel="stylesheet" href="../../src/styles.css" />
</head>
<body data-page="pagename">
  <div class="wrap">
    <!-- Page content -->
  </div>
  
  <!-- Load shared components (header, Firebase) -->
  <script type="module" src="../../src/shared-init.js"></script>
  
  <!-- Load page-specific initialization -->
  <script type="module" src="../../src/pages/pagename-page.js"></script>
</body>
</html>
```

**2. Create page initialization file** in `src/pages/pagename-page.js`:

```javascript
import { waitForFirebase } from '../shared-init.js';

function waitForComponents() {
  if (document.querySelector('header')) {
    initApp();
  } else {
    setTimeout(waitForComponents, 50);
  }
}

function initApp() {
  // Set up event handlers
  const btn = document.getElementById('myBtn');
  if (btn) {
    btn.onclick = handleClick;
  }
  
  // Initialize features
  waitForFirebase(() => {
    window.auth.onAuthStateChanged((user) => {
      if (user) {
        loadUserData();
      }
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', waitForComponents);
} else {
  waitForComponents();
}
```

**3. Add page-specific styles** (if needed) in `src/styles/pages/pagename.css`

### Add a new modal

1. Create HTML structure with `.modal` and `.modal-content`
2. Add `.show` class toggle in JavaScript
3. Implement keyboard handlers (Esc to close)
4. Add focus trap and restoration
5. Add ARIA attributes

### Add a new dropdown

1. Use `.custom-dropdown` structure from patterns
2. Implement show/hide logic (toggle menu display)
3. Add outside-click handler to close
4. Implement keyboard navigation (Arrow/Enter/Esc)
5. Add ARIA attributes

### Style a hero/marketing section

```html
<div class="hero-panel">
  <h2 class="hero-title">Feature Title</h2>
  <p class="hero-desc">Description text</p>
  <button class="btn xl primary">Call to Action</button>
  <p class="hero-note">Additional note</p>
</div>
```

### Create a feature grid

```html
<div class="feature-grid">
  <div class="feature-card">
    <div class="feature-icon">🚀</div>
    <div class="feature-content">
      <div class="feature-title">Feature Name</div>
      <div class="feature-desc">Feature description</div>
    </div>
  </div>
</div>
```

---

## File Reference

### CSS Files

- `src/styles/base.css` - Variables, reset, global utilities
- `src/styles/layout.css` - Grid layout, responsive breakpoints
- `src/styles/components/*.css` - Reusable UI components
- `src/styles/pages/*.css` - Page-specific styles

### HTML Templates

- `partials/header.html` - Shared header HTML (loaded by `header.js`)
- `index.html` - Home page template
- `pages/*/*.html` - Individual page templates

---

## Progressive Enhancement

When adding new features:

1. **Start high-traffic pages**: Home, Jules
2. **Then secondary pages**: Sessions, Queue, Profile, Web Capture
3. **Then modules**: Individual component improvements
4. **Test mobile-first**: Ensure responsive behavior works at all breakpoints

---

## Version History

- **v2.0** (Jan 6, 2026): Split from combined guide; focused on UI/CSS only
- **v1.0**: Initial combined guidelines

---

**Questions?** Check existing implementations in `src/styles/components/` for reference patterns. For JavaScript patterns, see [CODE_STYLE_GUIDE.md](CODE_STYLE_GUIDE.md).
