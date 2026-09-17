---
name: Precision Obsidian Workspace
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#4a4455'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#7b7487'
  outline-variant: '#ccc3d8'
  surface-tint: '#732ee4'
  primary: '#630ed4'
  on-primary: '#ffffff'
  primary-container: '#7c3aed'
  on-primary-container: '#ede0ff'
  inverse-primary: '#d2bbff'
  secondary: '#006398'
  on-secondary: '#ffffff'
  secondary-container: '#5bb8fe'
  on-secondary-container: '#00476e'
  tertiary: '#7a4000'
  on-tertiary: '#ffffff'
  tertiary-container: '#9d5400'
  on-tertiary-container: '#ffe1cb'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#eaddff'
  primary-fixed-dim: '#d2bbff'
  on-primary-fixed: '#25005a'
  on-primary-fixed-variant: '#5a00c6'
  secondary-fixed: '#cce5ff'
  secondary-fixed-dim: '#93ccff'
  on-secondary-fixed: '#001d31'
  on-secondary-fixed-variant: '#004b73'
  tertiary-fixed: '#ffdcc3'
  tertiary-fixed-dim: '#ffb77d'
  on-tertiary-fixed: '#2f1500'
  on-tertiary-fixed-variant: '#6e3900'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.005em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.02em
  code-md:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: -0.01em
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 14px
    letterSpacing: -0.01em
  code-xs:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '500'
    lineHeight: 12px
    letterSpacing: 0em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 0.75rem
  gutter-dense: 0.375rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

This design system establishes a high-density, analytical workspace optimized for Obsidian desktop environments focused on technical project management, Gantt scheduling, and relational data modeling.

The design movement merges **Functional Modernism** with **Information-Dense Minimalism**:
- **Utilitarian Precision:** High contrast, strictly structured spatial planes, hairline dividers, and minimal ambient decoration to prioritize timeline comprehension and cognitive ergonomics.
- **Atmosphere:** Rigorous, executive, and frictionless. Surfaces remain pure and crystalline, eliminating visual sludge while honoring Obsidian's signature brand lineage through refined violet anchors.
- **Target Audience:** Systems thinkers, technical directors, engineering leads, and PKM power users executing complex multi-track project roadmaps directly from Markdown frontmatter.

## Colors

The palette leverages a pristine canvas foundation, deep slate typography, authoritative violet accents, and semantic indicators for milestone and state verification.

### Base Canvases & Structurals
- **Canvas Base:** `#F8FAFC` (App workspace background, panel backdrops)
- **Canvas Sunken:** `#F1F5F9` (Gantt header rulers, inspector panels, timeline tracks)
- **Surface Pure:** `#FFFFFF` (Data grid cells, modal dialogs, popovers, timeline task rows)
- **Hairline Border Soft:** `#E2E8F0` (Default gridlines, column dividers, card edges)
- **Hairline Border Strong:** `#CBD5E1` (Active drag lines, frozen column separators, pane borders)

### Primary & Accent Spectrum
- **Obsidian Accent (Primary):** `#7C3AED` (Active timeline selections, primary action triggers, focused controls)
- **Obsidian Accent Dark:** `#6D28D9` (Button hover, active milestone diamond outlines)
- **Obsidian Accent Subtle:** `#F5F3FF` (Selection states, active row highlight, focus rings)

### Semantic & Gantt Status Roles
- **Critical Path / Warning (Amber):** Base `#D97706`, Background `#FEF3C7`, Text `#92400E`
- **Progress / Complete (Emerald):** Base `#059669`, Background `#D1FAE5`, Text `#065F46`
- **Milestone / Active Task (Sky):** Base `#0284C7`, Background `#E0F2FE`, Text `#075985`
- **Assignee / Resource (Indigo):** Base `#4F46E5`, Background `#EEF2FF`, Text `#3730A3`
- **Blocked / Destructive (Rose):** Base `#E11D48`, Background `#FFE4E6`, Text `#9F1239`

### Monochromatic Text Stack
- **Text High-Contrast:** `#0F172A` (Headlines, row headers, task titles)
- **Text Medium-Contrast:** `#475569` (Metadata, dates, frontmatter keys, column headers)
- **Text Muted:** `#94A3B8` (Placeholders, grid line coordinates, breadcrumb dividers)

## Typography

The typography architecture uses a twin-engine pairing: **Inter** handles narrative clarity, navigation, and tabular legibility, while **JetBrains Mono** governs frontmatter key-value pairs, duration values, schedule dates, dependencies, and machine metadata.

### Typographic Hierarchy Rules
- **Inter (Primary UI):** Renders all workspace headings, task titles, button triggers, and dialogs. Font smoothing (`antialiased`) is mandatory to preserve hairline stroke precision on high-DPI displays.
- **JetBrains Mono (Technical Accents):** Reserved for timeline scales (e.g., `2024-W14`, `04/12`), progress metrics (`84%`), duration tallies (`14d`), YAML inspector values, and dependency tokens (`FS-102`).
- **Tabular Numerals:** All numeric readouts in data grids must enable `font-variant-numeric: tabular-nums` to eliminate column jitter during real-time frontmatter sync.

## Layout & Spacing

The layout is built upon a **Fluid Paned Splitter System** engineered for Obsidian desktop panels, sidebars, and main markdown views.

### Structure & Panes
- **Workbench Canvas:** Three-pane split consisting of an optional File Tree/Outline (Obsidian native), the Split Data Table / Gantt View, and the Collapsible Frontmatter Inspector.
- **Gantt Split-Ratio:** 40% Frozen Data Grid (Left), 60% Timeline View (Right), divided by a draggable 1px separator with a 4px hover hitbox (`#CBD5E1`).
- **Row Heights:** Strict vertical rhythm calibrated at `36px` for dense views, `44px` for standard views, and `28px` for subtasks.

### Breakpoints & Adaptive Rules
- **Desktop Wide (>1440px):** Simultaneous side-by-side data grid, wide Gantt calendar, and pinned frontmatter inspector.
- **Desktop Compact (1024px – 1439px):** Inspector defaults to collapsible right drawer overlay; data grid retains primary visibility with horizontal scroll on timeline.
- **Panel / Sidebar View (<1024px):** Switches to single-column tabbed view (Toggle between Task List and Timeline Mode).

## Elevation & Depth

This system intentionally eliminates blurred drop shadows in favor of **low-contrast outlines, micro-borders, and tonal surface stepping**. Depth is defined by physical separation lines rather than artificial elevation.

### Surface Hierarchy
1. **Level 0 (App Base):** `#F8FAFC` – Root Obsidian canvas background.
2. **Level 1 (Sub-Panels & Inspectors):** `#F1F5F9` – Frontmatter sync inspector, calendar scale headers, and filter bars. Outlined by `1px solid #E2E8F0`.
3. **Level 2 (Data Planes & Row Canvas):** `#FFFFFF` – Active Gantt row items, interactive table cells, context menus, and popovers. Bound by `1px solid #CBD5E1`.
4. **Level 3 (Interactive Gantt Bars):** Foreground visual elements that sit strictly flat on Level 2 with crisp `1px` perimeter borders matching their respective semantic stroke colors.

### Floating Elements
Contextual overlays (date pickers, tag selector popovers, dependency connection nodes) use a 1px border (`#CBD5E1`) paired with an ultra-subtle ambient shadow:
`box-shadow: 0 1px 3px 0 rgba(15, 23, 42, 0.05), 0 1px 2px -1px rgba(15, 23, 42, 0.05)`.

## Shapes

The design system enforces a **Soft Structural (0.25rem / 4px)** geometry to emphasize structural precision, data compactness, and clean alignment with Obsidian's core interface.

### Radius Assignments
- **Micro Radius (2px):** Gantt milestone diamonds, timeline progress fill indicators, dependency arrow badges, and status indicator dots.
- **Standard Soft (4px):** Gantt task duration bars, input boxes, icon buttons, dropdown menus, and frontmatter code chips.
- **Surface Radius (6px / 8px):** Modal dialog windows, pinned inspector sheets, and context flyout cards.
- **Pill (9999px):** Restricted exclusively to Assignee Avatars and high-visibility status chips (e.g., `CRITICAL`, `DONE`).

## Components

### Buttons & Action Triggers
- **Primary Action (Obsidian Violet):** Background `#7C3AED`, color `#FFFFFF`, border `none`, radius `4px`, padding `6px 12px`. Hover state `#6D28D9`. Active state scale `0.99`.
- **Secondary / Neutral:** Background `#FFFFFF`, color `#0F172A`, border `1px solid #E2E8F0`, radius `4px`. Hover background `#F8FAFC`, border `#CBD5E1`.
- **Ghost Utility:** Background `transparent`, color `#475569`, radius `4px`. Hover background `#F1F5F9`, color `#0F172A`.

### Status Pills & Metadata Chips
- **Geometry:** Height `20px`, padding `0 6px`, radius `9999px`, font `JetBrains Mono` at `10px` / `500` weight, text-transform `uppercase`.
- **Critical Path Pill:** Background `#FEF3C7`, text `#92400E`, border `1px solid #FDE68A`.
- **In Progress Pill:** Background `#D1FAE5`, text `#065F46`, border `1px solid #A7F3D0`.
- **Planned / Queue Pill:** Background `#E0F2FE`, text `#075985`, border `1px solid #BAE6FD`.
- **Resource / Assignee Chip:** Rounded-full avatar dot (14px) paired with name in `Inter` 11px / 500 weight, background `#EEF2FF`, text `#3730A3`, border `1px solid #C7D2FE`.

### Gantt Timeline Bars
- **Standard Task Bar:** Height `22px`, radius `4px`, background `#0284C7`, with an internal progress fill of `#0369A1`. Right/left drag handles reveal on hover as `2px` white vertical bars.
- **Critical Task Bar:** Height `22px`, radius `4px`, background `#D97706`, progress fill `#B45309`.
- **Milestone Marker:** Rotated 45-degree diamond (`14px x 14px`), background `#7C3AED`, border `2px solid #FFFFFF`.
- **Dependency Connectors:** Orthogonal SVG path with `1.5px` stroke `#94A3B8`. Active or hovered paths transition to `2px` stroke `#7C3AED` with animated dash-array.

### Data Grid (Left Split Pane)
- **Header Row:** Height `32px`, background `#F1F5F9`, text `#475569`, border-bottom `1px solid #CBD5E1`, font `Inter` 11px / 600 weight, uppercase tracking `0.05em`.
- **Grid Cells:** Background `#FFFFFF`, border-bottom `1px solid #E2E8F0`, border-right `1px solid #E2E8F0`, padding `0 8px`, vertical text alignment center.
- **Active Row State:** Background `#F5F3FF`, left edge border highlight `2px solid #7C3AED`.

### Frontmatter Sync Inspector (Right Split Pane)
- **Panel Header:** Clean title bar with a direct two-way status light (`#059669` sync active), bordered bottom by `#E2E8F0`.
- **Key-Value Pairs:** Key rendered in `Inter` 11px / 500 weight (`#64748B`), Value rendered in editable `JetBrains Mono` 11px container with `#F8FAFC` background and `1px solid #E2E8F0` border.
- **Markdown Raw Preview:** Monospaced code block with `#0F172A` syntax accents, `#F8FAFC` background, and one-click copy/commit buttons.

### Form Inputs & Checkboxes
- **Input Fields:** Pure white background, `1px solid #CBD5E1`, text `#0F172A`, focus border `1.5px solid #7C3AED`, focus ring `2px solid #F5F3FF`.
- **Checkboxes:** Size `14px x 14px`, border `1.5px solid #94A3B8`, radius `2px`. Checked state background `#7C3AED`, border-color `#7C3AED`, with a crisp white hairline check icon.