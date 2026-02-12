# Color Consolidation Gameplan

**Created:** February 12, 2026  
**Goal:** Reduce color palette from 20+ unique colors to 12 semantic CSS variables for better maintainability and consistency

## Current Problems

### 1. Too Many Dark Blue Variants (6+ shades)
- `--bg: #0a0e1a` (body background)
- `--card: #141829` (card backgrounds)
- `#0b0f21` (code blocks in content.css)
- `#0d1424` (gradient backgrounds)
- `#11152a` (form selects in modals.css)
- `#12162a` (text inputs across multiple files)
- `#1a1f35` (tree submenu hover)

**Impact:** Inconsistent surface depths, harder to maintain

### 2. Duplicate Semantic Colors
- `--danger: #c0504d` AND `--error: #ff6b6b` (both red)
- Variable modal adds third red: `#ff4d6a`
- `--warn` should be `--warning` for consistency

**Impact:** Confusion about which color to use

### 3. Hardcoded Alpha Values (15+ instances)
Accent color variations scattered across files:
- `rgba(77,217,255,0.15)` - strong backgrounds
- `rgba(77,217,255,0.12)` - glow effects
- `rgba(77,217,255,0.10)` - medium backgrounds
- `rgba(77,217,255,0.08)` - subtle hover
- `rgba(77,217,255,0.05)` - very subtle backgrounds

**Impact:** Difficult to adjust opacity consistently

### 4. Inconsistent Green Colors
- `--success: #27ae60` (darker, lower contrast)
- `#4ade80` (brighter, used in tree.css)

**Impact:** Success indicators not uniform

### 5. White Overlay Variations (6+ values)
- `rgba(255,255,255,0.02)` to `0.06`
- No standardized system

**Impact:** Subtle but noticeable inconsistency in hover states

---

## Proposed Color System

### New CSS Variables (src/styles/base.css)

```css
:root {
  /* ===== BASE STRUCTURE ===== */
  --bg: #0a0e1a;                    /* Body background (keep) */
  --surface: #141829;               /* Unified surface: cards, inputs, code blocks */
  --surface-elevated: #1a1f35;      /* Hover/elevated states */
  --border: #222438;                /* Keep existing */
  
  /* ===== TEXT ===== */
  --text: #f0f3f8;                  /* Keep existing */
  --text-muted: #8b94a8;            /* Renamed from --muted */
  
  /* ===== ACCENT (CYAN) ===== */
  --accent: #4dd9ff;                /* Keep existing */
  --accent-hover: #5ad1ff;          /* From gradient */
  --accent-glow: rgba(77, 217, 255, 0.12);  /* Keep for shadows */
  --accent-bg-strong: rgba(77, 217, 255, 0.15);
  --accent-bg-medium: rgba(77, 217, 255, 0.10);
  --accent-bg-subtle: rgba(77, 217, 255, 0.05);
  
  /* ===== SEMANTIC COLORS ===== */
  --danger: #ff6b6b;                /* Consolidated (remove --error) */
  --success: #4ade80;               /* Brighter green (better contrast) */
  --warning: #f39c12;               /* Renamed from --warn */
  --info: #2980b9;                  /* Keep existing */
  
  /* ===== OVERLAYS ===== */
  --overlay-subtle: rgba(255, 255, 255, 0.03);
  --overlay-hover: rgba(255, 255, 255, 0.06);
  
  /* ===== GRADIENTS ===== */
  --gradient-primary: linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%);
  --gradient-bg: linear-gradient(180deg, #0d1424 0%, var(--bg) 100%);
  
  /* ===== TYPOGRAPHY ===== */
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
```

---

## Implementation Plan

### Phase 1: Update Base Variables (base.css)
- [ ] Replace color definitions in `:root`
- [ ] Add new variables (--surface, --accent-bg-*, --overlay-*, --text-muted)
- [ ] Rename --muted to --text-muted (keep --muted as alias initially)
- [ ] Rename --warn to --warning (keep --warn as alias initially)
- [ ] Remove --error (use --danger everywhere)
- [ ] Update icon color classes (.icon-error, .icon-warn, etc.)
- [ ] Test: Check homepage renders correctly

### Phase 2: Replace Hardcoded Dark Blues
**Files to update:**
- [ ] `src/styles/components/content.css`
  - Replace `#0b0f21` → `var(--surface)`
  - Replace `#12162a` → `var(--surface)`
- [ ] `src/styles/components/modals.css`
  - Replace `#12162a` → `var(--surface)`
  - Replace `#11152a` → `var(--surface)`
  - Replace `#0a0d1a` → `var(--surface)` or `var(--bg)`
- [ ] `src/styles/components/variable-modal.css`
  - Replace `#12162a` → `var(--surface)`
- [ ] `src/styles/components/tree.css`
  - Replace `#1a1f35` → `var(--surface-elevated)`
- [ ] Test: Check all components still have proper contrast

### Phase 3: Replace Hardcoded Accent Alphas
**Files to update:**
- [ ] `src/styles/components/buttons.css`
  - `rgba(77,217,255,0.15)` → `var(--accent-bg-strong)`
  - `rgba(77,217,255,0.08)` → `var(--accent-bg-subtle)`
- [ ] `src/styles/components/tree.css`
  - Update tree-dir hover and submenu-open states
- [ ] `src/styles/components/dropdown.css` (if exists)
- [ ] Any files with hover effects using accent color
- [ ] Test: Check hover states have consistent appearance

### Phase 4: Replace White Overlay Values
**Files to update:**
- [ ] `src/styles/components/content.css`
  - Standardize panel backgrounds
- [ ] `src/styles/components/utilities.css`
  - Update .bg-subtle and .bg-hover
- [ ] Any other components with white overlays
- [ ] Test: Check subtle backgrounds are visible but not distracting

### Phase 5: Consolidate Red Colors
**Files to update:**
- [ ] `src/styles/base.css`
  - Remove `--error: #ff6b6b`
  - Update `.icon-error` to use `var(--danger)`
- [ ] `src/styles/components/variable-modal.css`
  - Replace `#ff4d6a` → `var(--danger)`
  - Update all related rgba values
- [ ] Search all files for `.error`, `.icon-error`, `var(--error)`
- [ ] Test: Check error states and danger buttons

### Phase 6: Consolidate Green Colors
**Files to update:**
- [ ] `src/styles/base.css`
  - Change `--success: #27ae60` → `--success: #4ade80`
- [ ] `src/styles/components/tree.css`
  - Remove hardcoded `#4ade80`, use `var(--success)`
- [ ] `src/styles/pages/analytics.css`
  - Update success badges to use `var(--success)`
- [ ] Test: Check success indicators and "add file" icons

### Phase 7: Update Analytics Page
**File:** `src/styles/pages/analytics.css`
- [ ] Replace all hardcoded `rgba(20,24,41,...)` gradients
- [ ] Use semantic error/success/warning/info variables
- [ ] Test: Check analytics charts and cards render correctly

### Phase 8: Global Search & Replace
- [ ] Search for remaining `#[0-9a-f]{6}` hex codes
- [ ] Search for `rgba(77,217,255,` (accent variations)
- [ ] Search for `rgba(20,24,41,` (card variations)
- [ ] Search for `rgba(255,255,255,` (overlay variations)
- [ ] Replace any stragglers with appropriate CSS variables

### Phase 9: Remove Deprecated Aliases
- [ ] Remove `--muted` alias (replace with `--text-muted`)
- [ ] Remove `--warn` alias (replace with `--warning`)
- [ ] Update any JavaScript files referencing old variable names
- [ ] Test: Full site regression test

---

## Files That Need Updates

### High Priority (Core color usage)
1. ✅ `src/styles/base.css` - Define new system
2. `src/styles/components/buttons.css` - Accent alphas, gradients
3. `src/styles/components/content.css` - Surface colors, code blocks
4. `src/styles/components/modals.css` - Surface colors, inputs
5. `src/styles/components/tree.css` - Surface elevated, success color
6. `src/styles/components/variable-modal.css` - Red consolidation

### Medium Priority (Specific components)
7. `src/styles/components/utilities.css` - Overlay values
8. `src/styles/components/dropdown.css` - If exists
9. `src/styles/components/toast.css` - Background colors
10. `src/styles/pages/analytics.css` - Many hardcoded gradients

### Low Priority (Edge cases)
11. Any other component CSS files found during search
12. JavaScript files with inline styles (rare in this project)

---

## Testing Checklist

### Visual Regression
- [ ] Homepage renders without errors
- [ ] Sidebar tree hover states work
- [ ] All buttons have consistent hover effects
- [ ] Modals have proper background contrast
- [ ] Code blocks are readable
- [ ] Form inputs are visible and accessible
- [ ] Error/success/warning states are distinguishable
- [ ] Analytics page charts display correctly

### Browser DevTools Check
- [ ] No CSS errors in console
- [ ] Computed styles use CSS variables (not hardcoded)
- [ ] All `var(--color)` references resolve correctly
- [ ] Color contrast meets WCAG AA standards

### Cross-Browser Testing
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari (if available)
- [ ] Mobile responsive views

### Dark Mode Verification
- [ ] All surfaces have proper depth perception
- [ ] Text is readable on all backgrounds
- [ ] Accent colors pop without being harsh
- [ ] Subtle overlays are visible but not distracting

---

## Rollback Plan

If issues arise:
1. Git branch: Create `color-consolidation` branch before starting
2. Commit after each phase
3. If problems detected, revert last commit
4. Document any unexpected issues in this file

## Success Metrics

- **Reduce**: From 20+ unique colors to 12 CSS variables
- **Consistency**: All similar elements use same color values
- **Maintainability**: Color changes require updating 1 place (base.css)
- **No Visual Regression**: Site looks identical or better after changes
- **Better DX**: Developers know which variable to use for each context

---

## Notes & Discoveries

_(Add notes here during implementation)_

- 
