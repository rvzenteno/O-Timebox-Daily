# Microsoft Project / ProjectLibre Capability Audit & Parity Matrix

**Date**: 2026-09-15  
**Product**: Timebox Obsidian Plugin (`timebox-daily`)  
**Version**: 1.4.0  
**Status**: Production Hardened Baseline  

---

## 1. Architectural Philosophy & Scope Definition

Timebox 1.4.0 provides a **professional project-management foundation** directly embedded within Obsidian's local-first Markdown knowledge base. 

To maintain system stability, performance, and user ergonomics, a clear architectural boundary exists between **Project Management** and **Daily Timeboxing**:
- **Project Management (CPM Layer)**: Operates at the **calendar and working day level** (durations $\ge 1$ working day; milestones $= 0$ days). This layer models work breakdown structures, multi-predecessor dependencies, forward and backward CPM passes, slack/floats, critical paths, and resource capacity.
- **Timebox (Intraday Execution Layer)**: Operates at the **clock and hourly level** (e.g. 09:00 - 10:30). This layer manages daily timeboxing, pomodoro timers, meeting blocks, and daily note rollovers.
- **Architectural Separation**: Sub-day hourly CPM scheduling (e.g. fractional minutes in network dependencies) is intentionally avoided in the project management engine. This prevents calendar explosion and scheduling race conditions while ensuring that daily timeboxing remains intuitive and uncluttered.

---

## 2. Capability Audit Matrix

### Evaluation Categories
- **Implemented**: Fully functional, tested, and persisted in Markdown/YAML.
- **Partially implemented**: Functional in engine/model, but with partial UI or manual workflow.
- **Not implemented**: Not present in v1.4.0.
- **Not applicable**: Outside the architectural scope of an Obsidian Markdown-first tool.
- **Planned**: Targeted for future version release (v1.5+).

---

### 1. Scheduling Engine

| Feature | MS Project / ProjectLibre Equivalent | Timebox 1.4.0 Status | Technical Implementation & Notes |
| :--- | :--- | :---: | :--- |
| **Finish-to-Start (FS)** | Standard default dependency | **Implemented** | Successor earlyStart snaps to 1 working day after predecessor finish. |
| **Start-to-Start (SS)** | Parallel start dependency | **Implemented** | Successor earlyStart aligns with predecessor start + lag. |
| **Finish-to-Finish (FF)** | Synchronized completion dependency | **Implemented** | Successor earlyFinish aligns with predecessor finish + lag. |
| **Start-to-Finish (SF)** | Just-in-time predecessor dependency | **Implemented** | Successor earlyFinish aligns with predecessor start + lag. |
| **Lead and Lag** | Positive/negative lag offsets | **Implemented** | Supports `+Nd` and `-Nd` (e.g., `2.1FS+3d`, `3.1SS-1d`). |
| **Project Calendars** | Standard 5-day / 7-day calendars | **Implemented** | Configurable weekly working days (0-6), hours/day, and holidays array. |
| **Calendar Exceptions** | Non-working days / specific overrides | **Implemented** | Explicit holiday dates and working exceptions supported in calendar definitions. |
| **Task Constraints** | ASAP, ALAP, SNET, SNLT, FNET, FNLT, MSO, MFO | **Implemented** | Supported via `[constraint:: type YYYY-MM-DD]`; checked during forward pass. |
| **Project & Task Deadlines**| Contractual target deadlines | **Implemented** | Task `⏰ YYYY-MM-DD` and project `deadline` frontmatter property. |
| **Automatic Scheduling** | Topological sort + 2-pass CPM | **Implemented** | Forward pass (Early Dates), backward pass (Late Dates), and summary rollup. |
| **Manual Scheduling** | Manually scheduled task mode | **Implemented** | `schedulingMode: 'manual'` prevents auto-shifting of user-entered dates. |
| **Forward Scheduling** | Schedule from Project Start Date | **Implemented** | Default CPM engine mode; terminal tasks anchor project completion date. |
| **Backward Scheduling** | Schedule from Project Target Deadline | **Implemented** | `scheduleMode: 'backward'` aligns terminal activities from target deadline. |
| **Critical Path Analysis** | Longest path determination | **Implemented** | Compiles critical task IDs where `totalFloat <= 0`; highlighted in red. |
| **Total Float (Slack)** | Late Finish minus Early Finish | **Implemented** | Exact working days calculated via calendar math; supports negative float. |
| **Free Float** | Delay allowed without impacting successor | **Implemented** | Calculated against earliest successor `earlyStart`. |
| **Intraday / Hourly CPM** | Minute-by-minute CPM scheduling | **Not applicable** | Intentionally bounded to working days; intraday handled by Timebox daily planner. |

---

### 2. Task Management & Work Breakdown Structure (WBS)

| Feature | MS Project / ProjectLibre Equivalent | Timebox 1.4.0 Status | Technical Implementation & Notes |
| :--- | :--- | :---: | :--- |
| **WBS Hierarchy** | Outlined hierarchical tree | **Implemented** | N-level nested Markdown checklists (`1.1.1.1.1`); dynamic WBS numbering. |
| **Summary Tasks** | Phase rollups / parent tasks | **Implemented** | Dates, durations, work hours, and progress rollup bottom-up from children. |
| **Milestones** | Zero-duration checkpoints | **Implemented** | `0d` duration, `#milestone` tag, rendered as SVG diamonds. |
| **Recurring Tasks** | Periodic scheduled tasks | **Planned** | Daily Timebox rollovers supported; formal recurring project tasks planned for v1.5. |
| **Task Notes / Description**| Detailed documentation per task | **Implemented** | Multiline indented notes under task and `[desc:: ...]` token supported. |
| **Task Priorities** | Priority weighting (100–1000) | **Implemented** | Supported via `[priority:: 500]`; preserved across edits. |
| **Task Status** | Not Started, In Progress, Complete, Blocked | **Implemented** | Blocked status determined when predecessors are incomplete. |
| **Percent Complete (% Complete)**| Progress tracking | **Implemented** | `[%:: N]` token; rollups compute weighted progress to parent summaries. |
| **Actual Start / Finish** | Tracking execution dates | **Implemented (v1.5)**| Dedicated tokens `[actualStart::]`/`[actualFinish::]`; strictly isolated from planned schedule and baseline. |
| **Actual Work** | Actual hours expended | **Implemented (v1.5)**| Dedicated token `[actualWork:: Nh]`; tracks actual expended work and remaining work from status date forward. |

---

### 3. Resource Management

| Feature | MS Project / ProjectLibre Equivalent | Timebox Status | Technical Implementation & Notes |
| :--- | :--- | :---: | :--- |
| **Work Resources** | People / labor resources | **Implemented** | Full support with hourly rates, working hours per day, and capacity units. |
| **Material Resources** | Consumable materials | **Implemented** | Type `Material` with unit cost per use; 0 work hours. |
| **Cost Resources** | Fixed financial expenses | **Implemented** | Type `Cost` with fixed cost per use. |
| **Assignment Units** | Resource percentage / unit load | **Implemented** | Syntax `@resource:units%` (e.g. `@bob-tech:50%` or `@alice-eng`). |
| **Resource Capacity** | Daily availability calculation | **Implemented** | `workingHoursPerDay * maxUnits` calculated against applicable calendar. |
| **Resource Calendars** | Resource-specific calendar overrides | **Implemented** | `calendarId` per resource; evaluated for resource availability and usage. |
| **Standard Hourly Rates** | Cost computation per hour | **Implemented** | `ratePerHour` multiplied by assigned task work hours. |
| **Cost Per Use** | One-time task assignment cost | **Implemented** | `costPerUse` added to total assignment cost. |
| **Resource Assignments** | Assigning resources to tasks | **Implemented** | Managed via UI modal, task sheet, or inline Markdown syntax. |
| **Over-Allocation Detection**| Identifying resource over-scheduling | **Implemented** | Daily allocation aggregation flags any day exceeding resource capacity. |
| **Resource Usage Grid** | Time-phased work/capacity matrix | **Implemented** | Interactive time-phased grid with date navigation, expandable task sub-rows. |
| **Resource Leveling** | Automated conflict resolution | **Planned** | Manual date adjustments supported; automated heuristic leveling planned for v1.6. |

---

### 4. Tracking & Baselines

| Feature | MS Project / ProjectLibre Equivalent | Timebox Status | Technical Implementation & Notes |
| :--- | :--- | :---: | :--- |
| **Baseline Snapshot** | Saving frozen project schedule | **Implemented** | Captures snapshot of start, finish, duration, work, and cost into frontmatter. |
| **Multiple Baselines** | Versioned baselines (Baseline 0–10) | **Implemented (v1.5)**| Multi-baseline manager (Baseline 0..10) with selector dropdown, immutability, and YAML persistence. |
| **Variance Calculation** | Current vs baseline differences | **Implemented (v1.5)**| Signed variance math for start, finish, duration, work, and cost variances. |
| **Status Date Tracking** | Progress evaluation as of date | **Implemented (v1.5)**| Configurable status date in frontmatter; dedicated Gantt marker; forecast projections anchored from status date. |
| **Actual vs Planned Display**| Baseline comparison bars | **Implemented** | Renders secondary hatched baseline bars directly below active Gantt bars. |
| **Progress Tracking** | Progress fill overlays | **Implemented** | Visual progress fills on task bars and summary progress bars in summary dashboard. |

---

### 5. Views & Interface

| Feature | MS Project / ProjectLibre Equivalent | Timebox Status | Technical Implementation & Notes |
| :--- | :--- | :---: | :--- |
| **Gantt Chart** | Interactive timeline with bars | **Implemented** | SVG canvas, drag-to-move, drag-to-resize, zoom levels (Day/Week/Month), status date line, baseline comparison. |
| **Task Sheet** | Tabular task grid with columns | **Implemented (v1.5)**| Dynamic column visibility modal with 18 configurable columns across 4 categories and separate preference persistence. |
| **Resource Sheet** | Resource directory and metrics | **Implemented** | CRUD management, capacity, rates, total work, peak utilization, conflict badges. |
| **Resource Usage View** | Time-phased resource workload | **Implemented** | Grid view with daily hours, utilization percentages, and task allocation breakdowns. |
| **Project Summary** | Executive project dashboard | **Implemented** | Dynamic KPI cards (Dates, Duration, Work, Cost, Critical Path, Milestones, Float). |
| **Network / PERT Diagram** | Node-link relationship diagram | **Partially implemented**| Relationship arrows rendered in Gantt; dedicated PERT network planned for v1.6. |

---

### 6. Obsidian & Local-First Integration

| Feature | Description | Timebox 1.4.0 Status | Technical Implementation & Notes |
| :--- | :--- | :---: | :--- |
| **Markdown Persistence** | Pure plain text storage | **Implemented** | All entities serialized to standard Markdown checklists and YAML frontmatter. |
| **Lossless Round-Trip** | Preserves unrelated note text | **Implemented** | Prose, headers, bullets, callouts, and comments preserved without mutation. |
| **Obsidian Wikilinks** | Internal link support (`[[Note]]`) | **Implemented** | Preserved verbatim in task descriptions and project documentation. |
| **Obsidian Tags** | Tag indexing (`#project`, `#milestone`)| **Implemented** | Preserved and integrated into task identification. |
| **Timebox Daily Sync** | Interoperability with daily notes | **Implemented** | Bidirectional checkbox sync; PM metadata stripped from daily note presentation. |
| **Universal Undo / Redo**| Full reversibility of mutations | **Implemented** | Command pattern manager supports multi-level undo/redo across all actions. |
| **Mobile Responsiveness**| Touch-friendly narrow screen UX | **Implemented** | Media queries ($\le 768\text{px}$), horizontal touch-scrolling, adaptive modals. |

---

## 3. Parity Conclusion & Roadmap

Timebox 1.4.0 achieves **full functional capability as a professional project-management foundation**:
- **Critical Path Method (CPM)**: Complete parity for standard forward/backward passes, floats, and four dependency types.
- **Resource Management**: Complete parity for labor and cost resource tracking, part-time schedules, and over-allocation detection.
- **Baselines**: Complete parity for versioned snapshot creation and variance reporting.
- **Obsidian Native**: Unrivaled local-first Markdown integration with presentation isolation for clean daily timeboxing.

### Planned Capabilities for Subsequent Releases (v1.5 / v1.6)
1. **Automated Resource Leveling (v1.5)**: Heuristic algorithms to resolve over-allocations by shifting non-critical tasks within available total float.
2. **Recurring Tasks (v1.5)**: Native recurring project cadence definitions.
3. **Dedicated PERT Network Diagram (v1.6)**: Pure node-and-connector network view for CPM logic exploration.
4. **Earned Value Management (EVM) Metrics (v1.6)**: PV, EV, AC, CPI, and SPI calculations.
