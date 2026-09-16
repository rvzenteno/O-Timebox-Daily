# Timebox 1.5.0 Execution Tracking & Project Controls Acceptance Report

**Date**: 2026-09-16  
**Version**: 1.5.0  
**Target**: Timebox Obsidian Plugin (`timebox-daily`)  
**Specification**: Timebox 1.5 — Execution Tracking & Project Controls

---

## 1. Executive Summary

Timebox 1.5.0 has successfully passed all automated unit, regression, integration, and real-world acceptance test suites. 

### Core Architectural Principle: Strict 4-State Separation
The system maintains strict semantic and architectural separation across the execution lifecycle:
$$\text{Baseline} \longrightarrow \text{Current Planned Schedule} \longrightarrow \text{Actual Execution} \longrightarrow \text{Forecast}$$

- **Baseline**: Frozen snapshot of planned schedule intent (`start`, `finish`, `duration`, `work`, `cost`). Immutable once saved.
- **Current Planned Schedule**: Active CPM forward/backward passes (`plannedStart`, `plannedFinish`, `earlyStart`, `lateFinish`, `totalFloat`). Never silently overwritten by actual execution.
- **Actuals**: Empirical historical truth of what actually occurred (`actualStart`, `actualFinish`, `actualWork`, `actualDuration`).
- **Forecast**: Engine projection of future outcomes anchored from the project `statusDate` forward, honoring topological predecessor dependencies.

---

## 2. Phase-by-Phase Verification Matrix

| Phase | Core Deliverables | Validation Result | Automated Coverage |
| :--- | :--- | :---: | :--- |
| **Phase 1: Project Settings & Calendar UI** | Project start date, deadline, forward/backward scheduling, calendar manager modal, 4-day working weeks, custom daily hours, holidays, and working calendar exceptions. | **PASS** | Unit tests #15, #16. Frontmatter parsing & roundtrip serialization. |
| **Phase 2: Baseline Management & Variance** | Multi-baseline manager (Baseline 0..10), immutable snapshot persistence in YAML, signed variance math (`startVariance`, `finishVariance`, `durationVariance`, `workVariance`, `costVariance`). | **PASS** | Unit test #17, Acceptance tests #7, #13. Immutability verified. |
| **Phase 3: Status Date & Actuals** | Frontmatter `statusDate`, independent Gantt status date marker, `[actualStart::]`, `[actualFinish::]`, `[actualWork::]`, 6 forecast execution scenarios, remaining duration & work calculation. | **PASS** | Unit test #18, Acceptance test #13. Forecast vs plan separation verified. |
| **Phase 4: Task Sheet Customization** | Dynamic column visibility modal, 18 columns across 4 categories (Core, Baseline & Variance, Execution & Actuals, Advanced Scheduling), preset buttons, and UI preference isolation in separate plugin settings. | **PASS** | Unit test #19, headless DOM test, and browser visual inspection. |
| **Phase 5: Integration Testing & Lifecycle Parity** | 55-task realistic commercial buildout fixture testing the full project controls lifecycle: `Plan → Baseline → Execute → Enter Actuals → Change Status Date → Forecast → Review Variance → Replan`. | **PASS** | Real-world acceptance test #13. CPM floats, immutability, roundtrip lossless serialization, and presentation isolation verified. |

---

## 3. Test Results Summary

### Automated Unit & Regression Tests (`test/schedulingEngine.test.ts`)
- **Total Tests**: 19
- **Passed**: 19 (100%)
- **Failed**: 0
- **Duration**: ~80ms

### Automated Real-World Acceptance Tests (`test/realWorldAcceptance.test.ts`)
- **Total Tests**: 14 (13 numbered steps + suite wrapper)
- **Passed**: 14 (100%)
- **Failed**: 0
- **Scale Benchmark**: 5,000 tasks scheduled and analyzed in <150ms
- **Duration**: ~210ms

### Production Compilation
- `npm run build`: Exit code 0 cleanly bundling `main.js` with TypeScript type-checking (`tsc -noEmit -skipLibCheck`) and ESBuild minify/production pipeline.

---

## 4. Parity and Architectural Compliance

1. **Zero UI Imports in Engines**: Core engines (`SchedulingEngine`, `ResourceEngine`, `ProjectCalendar`, `ProjectValidator`, `MarkdownAdapter`, `ProjectCommandManager`, `TaskSheetModel`) maintain 0 imports from Obsidian or DOM APIs.
2. **Dual Presentation Boundary**: `MarkdownAdapter.stripProjectMetadata` cleans daily note views while preserving all PM tokens (`🛫`, `📅`, `⏳`, `dependsOn`, `@resource`, `[%::]`, `[actualStart::]`, `[actualFinish::]`, `[actualWork::]`).
3. **Lossless Roundtrip Serialization**: Non-destructive line replacement preserves all user prose, wikilinks, callouts, and comments untouched.
4. **Universal Undo/Redo**: All model operations support multi-level undo and redo via the Command Pattern.
