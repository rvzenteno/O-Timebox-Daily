# Timebox v1.6 — UI Modernization Audit
**Date:** 2026-09-17  
**Status:** Audit Completed — Pre-Implementation Baseline  
**Reference Documents:** `DESIGN.md`, Stitch Design Assets (`obsidian_gantt_desktop_linear_pro_suite`, `obsidian_gantt_desktop_obsidian_native_dark`)

---

## 1. Executive Summary

This audit establishes the pre-implementation assessment for the **Timebox v1.6 UI Modernization Pass**. In Phase 1, functional integrity (including the four-state lifecycle: Baseline → Current Planned Schedule → Actual Execution → Forecast, the normalized project model, work-progress derivation, and automatic daily note grouping) was stabilized and accepted. 

The goal of this modernization pass is **Functional Modernism + Information-Dense Minimalism** as defined in `DESIGN.md`. It elevates Timebox into a modern, executive 2026 project management suite while strictly protecting the underlying scheduling engines, Markdown frontmatter synchronization, and daily timeboxing workflows.

---

## 2. Current UI Assessment

### 2.1 Visual Atmosphere & Style
- **Current State:** The interface resembles a transitional hybrid between classic desktop project management software (dense but visually unpolished, utilizing raw borders and standard operating system control styles) and basic Obsidian plugin styles.
- **Visual Friction Points:**
  - **Flat vs. Elevated Surfaces:** Lack of clear surface tiering (Level 0 Canvas Base vs. Level 1 Sunken vs. Level 2 Pure Surface). Backgrounds alternate arbitrarily between `--background-primary` and `--background-secondary`.
  - **Heavy Drop Shadows & Outlines:** Task bars employ heavy drop shadows (`box-shadow: 0 2px 6px rgba(0,0,0,0.25)`) and aggressive text shadows (`text-shadow: 0 1px 2px rgba(0,0,0,0.8)`), contrasting with modern flat structural elevation.
  - **Inconsistent Control Hierarchy:** The toolbar places numerous actions side-by-side (`+ Task`, `+ Milestone`, `Critical Path`, `Baseline`, `Status Date`, `Zoom`, `Today`) with competing visual weight, resulting in an "Office ribbon" feel rather than a minimalist contextual toolbar.
  - **Badge & Status Clutter:** Status badges across Task Sheet, Resource Sheet, and Gantt use hardcoded, highly saturated colors (`#ef4444`, `#10b981`, `#f59e0b`, `#3b82f6`) with varying radii and padding rather than a standardized semantic badge system.

### 2.2 Reusable Components Already Present
1. **Multi-View Switcher Bar (`.timebox-view-switcher-bar`):** Clean tab navigation between Gantt, Task Sheet, Resource Sheet, Resource Usage, and Project Summary.
2. **Task Sheet Discovery Deck (`.timebox-discovery-deck`):** Includes search input with clear button, saved views selector, quick filter chips, and grouping segmented control.
3. **Splitter & Panes (`.timebox-gantt-wbs-pane`, `.timebox-gantt-splitter`, `.timebox-gantt-timeline-pane`):** Reliable split-ratio layout for data grid and timeline.
4. **Task Information Modal (`.timebox-task-info-modal`):** Well-structured 2-column form grid dividing Planned Schedule from Execution Tracking & Actuals.
5. **Project Validation Banner (`.timebox-validation-banner`):** Collapsible alert banner for circular dependencies and scheduling warnings.
6. **Time-Phased Resource Grid (`.timebox-usage-table`):** Matrix of resource allocations across days.
7. **Daily Note Project Grouping (`.timebox-daily-project-group`):** Collapsible project groups in Obsidian daily notes.

### 2.3 Styling Inconsistencies & Duplication
- **Font Sizes:** Scattered arbitrary font sizes throughout `styles.css` (`0.75em`, `0.78em`, `0.8em`, `0.82em`, `0.85em`, `10px`, `11px`, `12px`, `13px`, `14px`, `1.05em`, `1.5em`).
- **Spacing & Padding:** Header padding varies between views (`6px 14px`, `8px 14px`, `12px 14px`, `16px`, `20px 24px`) rather than adhering to a 4px/8px/12px/16px scale.
- **Hardcoded Colors:** 58+ hardcoded hex colors and 42+ `rgba()` declarations exist in `styles.css` rather than referencing semantic design tokens.
- **Read-Only Field Treatment:** Derived read-only fields (`Planned Work`, `Remaining Work`, `% Complete`, `Variances`) in tables and modals are styled inconsistently (some use dashed borders, some standard text, some opacity).

---

## 3. Components to Retain vs. Modernize

| Component | Retention Decision | Modernization Focus |
| :--- | :--- | :--- |
| **Data Models & Scheduling Engine** | **RETAIN 100%** | Zero logic changes. Four-state lifecycle, CPM, baselines, and actuals remain untouched. |
| **Markdown Adapter & Schema** | **RETAIN 100%** | Zero schema or frontmatter serialization changes. |
| **Daily Note Project Grouping** | **RETAIN 100%** | Protect `.timebox-daily-project-group` and `.timebox-daily-grouped-ul`. |
| **Design Tokens & Theme System** | **MODERNIZE** | Create unified `--tb-*` tokens for Light and Dark themes per `DESIGN.md`. |
| **Project Shell & Navigation** | **MODERNIZE** | Refine view tabs, project title, and toolbar into a clean, minimalist header. |
| **Task Sheet Data Grid** | **MODERNIZE** | Header hierarchy, 36px dense rows, tabular numerals for dates/work/%, distinct read-only cells. |
| **Gantt Chart Bars & Milestones** | **MODERNIZE** | Flat structural bars, crisp milestone diamonds, orthogonal SVG connectors, clean today marker. |
| **Resource Sheet & Usage** | **MODERNIZE** | Standardize capacity/workload visualization, over-allocation alerts, and time-phased cells. |
| **Project Summary Dashboard** | **MODERNIZE** | Clean Level 2 KPI cards, streamlined progress bar, high-contrast typography. |
| **Modals & Dialogs** | **MODERNIZE** | Unified header, surface radius, input styling, button hierarchy across all modals. |

---

## 4. CSS Architecture Issues

1. **Absence of a Central Token System:**
   `styles.css` lacks `:root` or scoped theme classes for Timebox tokens. It mixes raw Obsidian variables (`--background-modifier-border`, `--interactive-accent`) with hardcoded hex colors.
2. **No Dedicated Light / Dark System:**
   The project management UI contains zero `.theme-light` or `.theme-dark` rules. As a result, elements look washed out in light mode and lack subtle tonal depth in dark mode.
3. **Typography Engine Disconnect:**
   `DESIGN.md` mandates a twin-engine pairing: **Inter** for narrative/UI and **JetBrains Mono** with `font-variant-numeric: tabular-nums` for dates, WBS, duration, work hours, and percentages. Currently, font families are inconsistently applied via `var(--font-text)` and `var(--font-monospace)`.
4. **Border & Surface Geometry:**
   Currently uses arbitrary border radii (`2px`, `3px`, `4px`, `5px`, `6px`, `8px`, `10px`, `12px`, `14px`). Must standardize on `DESIGN.md`:
   - Micro: 2px (milestone diamonds, indicator dots)
   - Standard: 4px (task duration bars, inputs, buttons, chips)
   - Surface: 6px / 8px (modals, cards, panels)
   - Pill: 9999px (status chips and avatars)

---

## 5. Theme Issues (Light vs. Dark)

### 5.1 Light Theme Issues
- **Over-exposure & Glare:** Without subtle canvas stepping (`#F8FAFC` base vs `#F1F5F9` sunken headers vs `#FFFFFF` data cells), tables look like harsh monochromatic white blocks.
- **Harsh Accent Colors:** Saturated error reds (`#ef4444`) and greens (`#10b981`) lack soft tinted backgrounds (e.g., `#FEF3C7` Amber, `#D1FAE5` Emerald, `#FFE4E6` Rose).
- **Border Fatigue:** Heavy borders around every cell and card create visual noise. Hairline borders (`#E2E8F0` soft, `#CBD5E1` strong) must be used.

### 5.2 Dark Theme Issues
- **Deep Contrast Clashes:** High-contrast text on dark backgrounds causes visual fatigue when paired with raw accent colors.
- **Flatness:** Dark mode needs tonal depth: Level 0 base (`#090D16` / `#0F0F12`), Level 1 sunken (`#141C2E` / `#16161A`), Level 2 cards (`#1E293B` / `#1E1E24`).
- **Badge Readability:** Dark theme status chips need softened text tones (e.g. Amber text `#FCD34D` on `#451A03` background; Emerald text `#6EE7B7` on `#064E3B` background).

---

## 6. Accessibility & Ergonomics Issues

1. **Keyboard Focus States:** Several buttons and inputs have `outline: none` without a custom focus ring (`1.5px solid var(--tb-primary)` with subtle offset).
2. **Color Alone for Status:** Some states (e.g., variance slippage or critical tasks) rely solely on text color. Badges must pair clear semantic icons or text labels with colors.
3. **Touch Targets & Clickable Areas:** Several table action buttons and clear icons have small 12–14px hitboxes. Minimum interactive hitbox should be 28–32px.
4. **Cmd+F Search:** Explicitly **PARKED** per user directive; no keyboard interceptor modifications will be made.

---

## 7. Responsive & Mobile Issues

1. **Gantt Toolbar Wrapping:** The toolbar wraps awkwardly into multiple vertical lines on viewports under 900px width. Needs responsive grouping and horizontal scroll or collapse.
2. **Modal Viewport Overflow:** Modals with fixed widths (`min-width: 440px`, `max-width: 720px`) overflow on mobile devices. Requires `max-width: min(720px, 92vw)` and fluid grid columns.
3. **Data Grid Scroll Retention:** Mobile viewports must allow smooth horizontal scrolling of data tables without truncating action buttons.

---

## 8. Recommended Implementation Order

1. **Step 1: CSS Design Tokens & Theme Foundations**
   Define `--tb-*` variables for Light and Dark themes adhering to `DESIGN.md` (surfaces, hairlines, primary violet, semantic spectrum, fonts, radii, spacing).
2. **Step 2: Project Management Shell & Navigation**
   Modernize view switcher tabs, project breadcrumb/title, and toolbar actions into a disciplined primary/secondary hierarchy.
3. **Step 3: Task Sheet Grid & Discovery Deck**
   Modernize table headers, 36px row rhythm, WBS indentation, tabular mono alignment, read-only field styling, and status chips.
4. **Step 4: Gantt Chart Timeline Modernization**
   Modernize task bars, milestone diamonds, orthogonal SVG dependency paths, status date line, and baseline/forecast visualization.
5. **Step 5: Resource Sheet & Resource Usage**
   Modernize workload progress bars, time-phased grid cells, and over-allocation warning badges.
6. **Step 6: Project Summary Dashboard**
   Modernize Level 2 metric cards, overall completion bar, and critical path list.
7. **Step 7: Modals & Dialogs**
   Unify Task Information dialog, Settings, Baselines, Calendars, Saved Views, and Column Visibility modals.
8. **Step 8: Daily Note Protection & Verification**
   Verify zero regressions in daily note project grouping, checklist synchronization, and clean Markdown output.
9. **Step 9: Testing, Build & Vault Deployment**
   Run automated test suite, compile production bundle, deploy to Obsidian vault, and create `docs/qa/timebox-ui-modernization-review.md`.
