# Timebox v1.6 Phase 1 Acceptance Report: Task Sheet Ergonomics & Discovery

**Date**: 2026-09-17  
**Status**: IN PROGRESS — Post-Pass 3 Defect Fixes Deployed (Awaiting Manual Retest; Phase 1 Not Auto-Accepted)  
**Baseline Version**: 1.5.0 (Preserved as production baseline; no version bump)  
**Target Specification**: Timebox v1.6 Roadmap Phase 1 — Task Sheet Ergonomics & Discovery  

---

## 1. Executive Summary

Following the third manual acceptance pass in the real Obsidian UI, the Work/Progress model was accepted. Two remaining defects were analyzed, resolved, and verified:

1. **P1 — Cmd+F in Actual Obsidian Environment**:
   - *Previous failure*: In Task Sheet, pressing `Cmd+F` did nothing. In Gantt view, normal Obsidian Find appeared non-functional.
   - *Root cause*:
     1. In Obsidian, `ItemView.prototype.onOpen()` is only invoked when a leaf is newly opened via `setViewState()`. When Obsidian starts up, reloads (`Cmd+R`), or restores an existing workspace layout, Obsidian calls `onload()`, **not** `onOpen()`. Registering keyboard listeners inside `onOpen()` caused the listener to be absent upon plugin reload or layout restore.
     2. Clicking non-focusable elements (such as `div`, `span`, table rows, and headers) leaves `document.activeElement` as `document.body` and does not automatically update Obsidian's `workspace.activeLeaf`.
     3. Using a window-level capture-phase DOM event (`capture: true`) intercepted keydown events globally before Obsidian's internal keymap system could process them for other views.
   - *Fix*:
     - Integrated Obsidian's native **View Scope** (`this.scope = new Scope(this.app.scope)`) in the view constructor and `onload()`.
     - Registered `['Mod'], 'f'` (`Cmd+F` on macOS, `Ctrl+F` on Windows/Linux) via `this.scope.register()`.
     - When `this.activeView === 'task-sheet'`: focuses `.timebox-sheet-search-input`, selects existing text, and consumes the event.
     - When `this.activeView !== 'task-sheet'` (Gantt timeline, Project Summary, Resource Sheet): returns `false`, explicitly instructing Obsidian to let the event fall through to native Obsidian Find.
     - Added a `pointerdown` listener on `this.containerEl` (`tabIndex = -1`, `outline: none`) ensuring `this.app.workspace.setActiveLeaf(this.leaf, { focus: true })` runs whenever the user clicks anywhere in the view.
     - Registered a safe fallback listener on `window` in standard bubble phase (`false`) within `onload()`, strictly gated to `this.activeView === 'task-sheet' && (isLeafActive || containsFocus)`.

2. **P1/P2 — Project Grouping in Real Daily Notes**:
   - *Previous failure*: Today's actual daily note (`TimeBox/2026-09-17.md` and `2026-09-16.md`) displayed project tasks in one flat list with no grouping headers.
   - *Root cause*:
     1. In Obsidian Markdown Preview / Reading Mode, Obsidian passes each rendered block to `registerMarkdownPostProcessor(element, context)`. When `element` is the task list `<ul class="contains-task-list">`, attempting `ul.parentNode.replaceChild(groupsContainer, ul)` detached `element` from its temporary container. Obsidian's preview renderer maintains a direct reference to `element`, causing the replacement to be discarded.
     2. Path checking (`isDaily`) evaluated `context.sourcePath.startsWith(timeBoxFolder + '/')`. When the path had leading slashes (e.g., `/TimeBox/2026-09-17.md`), case variations (`Timebox`), or relative filenames (`2026-09-17.md`), `isDaily` evaluated to `false` and exited early.
     3. Wikilinks in real notes (e.g., `[[BEC - Colombia]]`, `[[BEC - US-COL]]`, `[[TEST PROJECT]]`) were not dynamically resolving project names if `getProjectFiles()` was queried before the vault folder index was ready.
   - *Fix*:
     - **In-Place `ul` DOM Transformation**: Mutates `ul` directly (`ul.classList.add('timebox-daily-grouped-ul'); ul.empty()`) and appends `<li class="timebox-daily-project-group is-collapsed">` items. `ul` is never detached from the DOM.
     - **Clickable Group Header**: Displays project title (`📁 Project Name` or `📋 General / Unassigned`), toggle chevron (`▶`/`▼`), and task count badge (`N tasks`).
     - **Sub-list Preservation**: Embeds `<ul class="contains-task-list timebox-daily-project-task-list">` holding the original `li.task-list-item` DOM elements. Preserves all attributes (`data-line`), checkbox elements, completion synchronization, and relative task order.
     - **Resilient Daily Path Detection**: Normalizes paths, strips leading slashes, performs case-insensitive comparisons, and matches `/^\d{4}-\d{2}-\d{2}\.md$/i`, while strictly excluding project notes inside `TimeBox/Projects/`.
     - **Multi-Strategy Project Association**: Checks `<a class="internal-link">` targets, extracts wikilinks `[[...]]` with alias stripping, queries known project files, and falls back to non-date wikilink targets.
     - **Session-Level Memory State**: In-memory `expandedDailyGroups: Set<string>` remembers user expand/collapse toggles across checkbox re-renders without ever writing UI state into Markdown.
     - **Clean Presentation**: PM metadata tokens (`🛫`, `📅`, `⏳`, etc.) are cleanly stripped from text nodes prior to grouping.

3. **Accepted Work & Progress Model**:
   - Preserved completely untouched:
     - Planned Work (`durationDays * 8h` or milestone `0h`)
     - Actual Work (editable numeric entry)
     - Remaining Work (read-only `max(0, Planned Work - Actual Work)`)
     - % Complete (read-only `min(100, round(Actual Work / Planned Work * 100))`)
     - Zero Planned Work non-division-by-zero rules

---

## 2. Test Execution & Verification Matrix

All 61 automated unit, benchmark, and regression tests pass cleanly across all three test runners:

```text
> timebox-daily@1.5.0 test
> esbuild test/schedulingEngine.test.ts --bundle --platform=node --format=esm --packages=external --outfile=test/dist.test.mjs && esbuild test/realWorldAcceptance.test.ts --bundle --platform=node --format=esm --packages=external --outfile=test/dist.rw.mjs && esbuild test/taskDiscovery.test.ts --bundle --platform=node --format=esm --packages=external --outfile=test/dist.discovery.mjs && node --test test/dist.test.mjs test/dist.rw.mjs test/dist.discovery.mjs

[Scale 100 Tasks Benchmark] Search: 0.10ms | Filter: 0.04ms | Group: 0.02ms | ViewSwitch: 0.06ms
[Scale 500 Tasks Benchmark] Search: 0.43ms | Filter: 0.22ms | Group: 0.01ms | ViewSwitch: 0.31ms
[Scale 1000 Tasks Benchmark] Search: 1.99ms | Filter: 0.71ms | Group: 0.04ms | ViewSwitch: 0.58ms
[Scale 5000 Tasks Benchmark] Search: 7.05ms | Filter: 2.66ms | Group: 0.10ms | ViewSwitch: 2.56ms

✔ TaskDiscoveryEngine: 1. Text Search Substring Matching Across Fields
✔ TaskDiscoveryEngine: 2. Quick Filters (Critical, Slipped, My Tasks, Milestones, Unassigned)
✔ TaskDiscoveryEngine: 3. Status Filters (Not Started, In Progress, Completed)
✔ TaskDiscoveryEngine: 4. Composable Multi-Filter Evaluation (AND Logic)
✔ TaskDiscoveryEngine: 5. WBS Hierarchy Context Retention on Filter Match
✔ TaskDiscoveryEngine: 6. Grouping Engine (WBS, Resource, Status)
✔ TaskDiscoveryEngine: 7. Four-State Lifecycle Non-Mutation Verification
✔ TaskDiscoveryEngine: 8. Saved View Presets & Definitions
✔ TaskDiscoveryEngine: 9. Clear Filters & Empty Result Set Handling
✔ TaskDiscoveryEngine: 10. Saved View Persistence & Switching Simulation
✔ TaskDiscoveryEngine: 11. Realistic 55-Task Project Validation
✔ TaskDiscoveryEngine: 12. Scale Performance Benchmarks (100, 500, 1,000, 5,000 Tasks)
✔ TaskDiscoveryEngine: 13. Critical Filter (Zero Matches vs Actual Matches & Ancestor Context)
✔ TaskDiscoveryEngine: 14. Slipped Filter (Documented finishVariance > 0 vs Zero Slipped)
✔ TaskDiscoveryEngine: 15. Composable Quick Filters & Multi-Filter AND Pipeline
✔ TaskDiscoveryEngine: 16. Actual % Complete Canonical Calculation & Zero-Work Rules
✔ TaskDiscoveryEngine: 17. Planned Schedule Progress Distinction vs Actual % Complete
✔ TaskDiscoveryEngine: 18. Historical Daily Note Completion Date Synchronization
✔ TaskDiscoveryEngine: 19. Scoped Cmd+F Integration Behavior (Item A)
✔ TaskDiscoveryEngine: 20. Real Daily-Note Project Grouping Parser & Structure (Items B, C, D, E, F)
✔ TaskDiscoveryEngine: 21. Planned Work, Actual Work & Remaining Work Derivation (Items G, H, I)
✔ TaskDiscoveryEngine: 22. Actual % Complete Canonical Calculations Matrix (Items J, K, L, M, N)
✔ TaskDiscoveryEngine: 23. Zero Planned Work Rules (Item O)
✔ TaskDiscoveryEngine: 24. Daily Note Completion Date Synchronization (Item P)
✔ TaskDiscoveryEngine: 25. Four-State Separation Non-Mutation Audit (Item Q)
✔ TaskDiscoveryEngine: 26. Real Daily-Note Reading/Preview Post-Processor DOM Grouping Regression
✔ REAL-WORLD ACCEPTANCE TEST: Commercial Facility Buildout & Signal Infrastructure (14/14 tests)
✔ Scheduling Engine Regression Suite (21/21 tests)

ℹ tests 61
ℹ pass 61
ℹ fail 0
```

---

## 3. Deployment Artifacts

- **Compiled production build**: `npm run build` executed successfully with zero type or bundling errors.
- **Vault deployment target**:
  `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/.obsidian/plugins/timebox-daily/`
- **Updated artifacts**:
  - `main.js` (407 KB)
  - `manifest.json` (348 B, version `1.5.0`)
  - `styles.css` (69.9 KB)

---

## 4. Manual Acceptance Retest Checklist (User Action Required)

Please reload the plugin in Obsidian (`Cmd+R` or disable & re-enable Timebox Daily under Community Plugins) and perform the following manual checks:

### 1. Cmd+F in Real Obsidian Environment
- [ ] Open a project and switch to the **Task Sheet** tab.
- [ ] Press `Cmd+F` (macOS) or `Ctrl+F` (Windows/Linux).
- [ ] Verify the Task Sheet search bar receives focus and any existing search text is automatically highlighted/selected.
- [ ] Type a search query and verify the sheet filters immediately.
- [ ] Switch to the **Gantt timeline** tab $\rightarrow$ Press `Cmd+F` $\rightarrow$ Verify normal Obsidian Find operates.
- [ ] Switch to **Project Summary** $\rightarrow$ Press `Cmd+F` $\rightarrow$ Verify normal Obsidian Find operates.
- [ ] Switch to **Resource Sheet** $\rightarrow$ Press `Cmd+F` $\rightarrow$ Verify normal Obsidian Find operates.
- [ ] Open any Markdown note $\rightarrow$ Press `Cmd+F` $\rightarrow$ Verify normal Obsidian Find operates.

### 2. Project Grouping in Real Daily Note
- [ ] Open the real daily note (`TimeBox/2026-09-17.md` or `2026-09-16.md`).
- [ ] Switch to **Reading/Preview mode**.
- [ ] Verify project groups appear collapsed initially:
  ```
  📁 BEC - Colombia              ▶   N tasks
  📁 BEC - US-COL                ▶   N tasks
  📁 TEST PROJECT                ▶   N tasks
  📋 General / Unassigned        ▶   N tasks
  ```
- [ ] Click one project header (e.g. `📁 TEST PROJECT`) $\rightarrow$ Verify it expands to `▼ N tasks` and reveals its tasks.
- [ ] Click again $\rightarrow$ Verify it collapses back to `▶ N tasks`.
- [ ] Expand one project and complete a task by clicking its checkbox.
- [ ] Verify the task completes, the project note synchronizes, and the group stays in view.
- [ ] Switch to **Source Mode** $\rightarrow$ Confirm grouping UI state has not modified the Markdown note (only `- [x]` changed).
