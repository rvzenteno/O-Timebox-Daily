/**
 * Normalized Project Management Data Model
 * 
 * Separates core scheduling concepts from Markdown syntax and UI layers.
 * Designed to support Microsoft Project / ProjectLibre level rigor.
 */

export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';

export type ConstraintType = 
    | 'asap' // As Soon As Possible (default forward)
    | 'alap' // As Late As Possible (backward)
    | 'snet' // Start No Earlier Than
    | 'snlt' // Start No Later Than
    | 'fnet' // Finish No Earlier Than
    | 'fnlt' // Finish No Later Than
    | 'mso'  // Must Start On
    | 'mfo'; // Must Finish On

export type TaskType = 'fixed-duration' | 'fixed-work' | 'fixed-units';

export type SchedulingMode = 'auto' | 'manual';

export type ProjectSchedulingDirection = 'forward' | 'backward';

export interface TaskDependency {
    id: string;
    fromTaskId: string; // Predecessor ID or WBS
    toTaskId: string;   // Successor ID or WBS
    type: DependencyType;
    lag: number;        // In working days (positive for lag, negative for lead)
    rawExpression?: string; // e.g. "2.1FS+2d"
}

export interface ResourceAssignment {
    resourceId: string;
    units: number;      // 1.0 = 100%, 0.5 = 50%
    workHours?: number; // Work = Duration * Units * HoursPerDay
}

export type ResourceType = 'Work' | 'Material' | 'Cost';

export interface ResourceDefinition {
    id: string;
    name: string;
    type?: ResourceType;        // 'Work' | 'Material' | 'Cost' (default: 'Work')
    maxUnits: number;           // e.g. 1.0 (100%), 0.5 (50% part-time)
    workingHoursPerDay?: number;// Resource daily working hours (e.g. 8h, or 4h for part-time)
    ratePerHour?: number;       // Cost rate per hour
    costPerUse?: number;        // One-time or material unit cost
    calendarId?: string;        // Resource-specific calendar override
    notes?: string;
}

export interface TaskBaseline {
    start: string;
    finish: string;
    duration: number;
    durationDays?: number;
    work: number;
    workHours?: number;
    cost: number;
}

export interface ProjectBaseline {
    id: string;          // e.g. "baseline0", "baseline1"
    name: string;        // e.g. "Baseline 0 - Project Approval"
    savedAt: string;     // ISO timestamp
    tasks: Record<string, TaskBaseline>; // Keyed by taskId or wbsCode
}

export interface CalendarException {
    date: string;        // YYYY-MM-DD
    isWorking: boolean;
    name?: string;       // e.g. "Company Retreat", "Christmas Day"
}

export interface CalendarDefinition {
    id: string;
    name: string;
    workingDays: number[]; // 0 = Sun, 1 = Mon, ..., 6 = Sat (Default: [1, 2, 3, 4, 5])
    hoursPerDay: number;   // Default: 8
    holidays: string[];    // Array of YYYY-MM-DD
    exceptions?: CalendarException[];
}

export interface TaskVariance {
    startVariance: number;    // Days: calculatedStart - baselineStart
    finishVariance: number;   // Days: calculatedFinish - baselineFinish
    durationVariance: number; // Days: duration - baselineDuration
    workVariance: number;     // Hours: work - baselineWork
    costVariance: number;     // Cost: cost - baselineCost
}

export interface ValidationIssue {
    severity: 'error' | 'warning' | 'info';
    code: string;
    message: string;
    taskId?: string;
    dependencyId?: string;
}

export interface NormalizedTask {
    // 1. Core Hierarchy & Identity
    id: string;                // Stable task identifier (or lineIndex/UID)
    wbsCode: string;           // Formatted WBS number (e.g. "1.2.3")
    wbsIndex: number;          // Sequential display counter
    title: string;             // Human-readable task name (sanitized)
    description?: string;      // Notes / multiline details
    lineIndex: number;         // Originating source line in Markdown
    depth: number;             // Indentation / hierarchy depth (0 = top-level)
    parentId?: string;         // Parent task ID (if subtask)
    childIds: string[];        // Array of direct child task IDs
    isSummary: boolean;        // True if task has children (summary / phase)
    isMilestone: boolean;      // True if milestone (0 working days duration)

    // 2. Status & Progress
    completed: boolean;
    percentComplete: number;   // 0 - 100%
    percentWorkComplete: number;

    // 3. User-Entered Dates & Intent (Preserved from Markdown)
    userStart?: string;        // Explicit user start date (YYYY-MM-DD)
    userFinish?: string;       // Explicit user finish date (YYYY-MM-DD)
    durationDays: number;      // Duration in working days (>= 1, or 0 if milestone)
    workHours: number;         // Total work in hours (Work = Duration * Units * 8)
    taskType: TaskType;
    schedulingMode: SchedulingMode;
    constraintType: ConstraintType;
    constraintDate?: string;   // Date for SNET, MSO, etc.
    deadline?: string;         // Hard project deadline date
    priority: number;          // Priority 100-1000 (default 500)
    calendarId?: string;       // Task-specific calendar override

    // 4. Engine-Calculated Dates (CPM Outputs / Planned Intent)
    calculatedStart: string;   // Active scheduled start (YYYY-MM-DD)
    calculatedFinish: string;  // Active scheduled finish (YYYY-MM-DD)
    plannedStart?: string;     // Planned CPM start without actuals
    plannedFinish?: string;    // Planned CPM finish without actuals
    plannedDurationDays?: number;
    plannedWorkHours?: number;
    earlyStart: string;
    earlyFinish: string;
    lateStart: string;
    lateFinish: string;
    totalFloat: number;        // Slack in working days (lateFinish - earlyFinish)
    freeFloat: number;         // Slack before delaying any immediate successor
    isCritical: boolean;       // True if totalFloat <= 0 on critical path
    isBlocked: boolean;        // True if predecessors are incomplete

    // 5. Actuals (Tracking Execution - What Actually Happened)
    actualStart?: string;
    actualFinish?: string;
    actualDuration?: number;
    actualDurationDays?: number;
    actualWork?: number;
    actualWorkHours?: number;
    actualCost?: number;

    // 6. Forecast (Projected Outcome from Status Date & Execution State)
    forecastStart?: string;
    forecastFinish?: string;
    remainingDurationDays?: number;
    remainingWorkHours?: number;

    // 7. Resources & Costing
    assignments: ResourceAssignment[];
    cost: number;
    isOverAllocated?: boolean;

    // 8. Baselines & Variance
    baseline?: TaskBaseline;
    variance?: TaskVariance;

    // 9. Markdown Preservation
    customTokens?: string[];   // Any unknown tags/tokens to survive roundtrip
    rawLine?: string;          // Original line text for lossless editing
    lineCount: number;         // Number of source lines occupied (including notes)
    workingIntervals?: Array<{ start: string; end: string }>;
}

export interface NormalizedProject {
    id: string;
    name: string;
    filePath: string;
    tasks: NormalizedTask[];
    taskMap: Map<string, NormalizedTask>;
    dependencies: TaskDependency[];
    resources: ResourceDefinition[];
    calendars: CalendarDefinition[];
    activeCalendarId: string;
    baselines: Record<string, ProjectBaseline>;
    activeBaselineId?: string;
    schedulingDirection: ProjectSchedulingDirection;
    projectStartDate: string;
    projectFinishDate: string;
    projectDeadline?: string;
    statusDate?: string;       // Configurable Project Status Date (independent of "Today")
    forecastFinishDate?: string; // Projected project finish date based on execution actuals
    startTaskNumber: number; // 1 = standard, 2 = Task 1 is Title (WBS 0)
    totalWorkHours: number;
    totalCost: number;
    overallProgressPercent: number;
    criticalPath: string[]; // Task IDs on critical path
    validationIssues: ValidationIssue[];
}
