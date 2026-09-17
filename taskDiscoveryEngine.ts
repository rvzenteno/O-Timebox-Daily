import { ResourceDefinition, TaskVariance } from './projectModel';
import { ProjectTask } from './projectManager';
import { ResourceUsageSummary } from './resourceEngine';
import { 
    DEFAULT_TASKSHEET_COLUMNS, 
    PRESET_FLOAT_COLUMNS, 
    PRESET_VARIANCE_COLUMNS 
} from './taskSheetModel';

export interface FlattenedGanttRow {
    task: ProjectTask;
    isParent: boolean;
    isSubtask: boolean;
    hasDates: boolean;
    startDate?: string;
    dueDate?: string;
    durationDays: number;
    isMilestone: boolean;
    visible: boolean;
    parentIndex?: number;
    wbsCode: string;
    wbsIndex: number;
    resource?: string;
    predecessors: string[];
    isBlocked: boolean;
    isCritical: boolean;
    totalFloat: number;
    freeFloat: number;
    workHours: number;
    percentComplete: number;
    constraintType?: string;
    constraintDate?: string;
    baselineStart?: string;
    baselineFinish?: string;
    plannedStart?: string;
    plannedFinish?: string;
    actualStart?: string;
    actualFinish?: string;
    actualWork?: number;
    forecastStart?: string;
    forecastFinish?: string;
    description?: string;
    workingIntervals: Array<{ start: string; end: string }>;
    variance?: TaskVariance;
    isAncestorOfMatch?: boolean; // Set when displayed to preserve WBS hierarchy context
}

export type QuickFilterType = 
    | 'critical' 
    | 'slipped' 
    | 'assigned-me' 
    | 'unassigned' 
    | 'milestones';

// Legacy single-id type for backwards compatibility
export type QuickFilterId = 'all' | QuickFilterType;

export type TaskStatusFilter = 
    | 'all' 
    | 'not-started' 
    | 'in-progress' 
    | 'completed';

export type TaskGroupingMode = 
    | 'wbs' 
    | 'resource' 
    | 'status';

export interface TaskSheetFilterState {
    searchQuery: string;
    quickFilters?: QuickFilterType[]; // Composable array of independent active quick filters
    statusFilter: TaskStatusFilter;
    resourceFilter: string; // 'all' | 'unassigned' | resourceId
    quickFilter?: QuickFilterId; // Backwards compatibility for legacy saved views
}

export interface SavedViewDefinition {
    id: string;
    name: string;
    isSystemPreset: boolean;
    filterState: TaskSheetFilterState;
    visibleColumnIds: string[];
    groupingMode: TaskGroupingMode;
}

export interface GroupedTaskSection {
    id: string;
    title: string;
    badgeText?: string;
    isOverAllocated?: boolean;
    taskCount: number;
    totalWorkHours: number;
    rows: FlattenedGanttRow[];
}

export const DEFAULT_SAVED_VIEWS: SavedViewDefinition[] = [
    {
        id: 'default',
        name: 'All Tasks (Default)',
        isSystemPreset: true,
        filterState: {
            searchQuery: '',
            quickFilters: [],
            quickFilter: 'all',
            statusFilter: 'all',
            resourceFilter: 'all'
        },
        visibleColumnIds: DEFAULT_TASKSHEET_COLUMNS,
        groupingMode: 'wbs'
    },
    {
        id: 'my-open-tasks',
        name: 'My Open Tasks',
        isSystemPreset: true,
        filterState: {
            searchQuery: '',
            quickFilters: ['assigned-me'],
            quickFilter: 'assigned-me',
            statusFilter: 'in-progress',
            resourceFilter: 'all'
        },
        visibleColumnIds: DEFAULT_TASKSHEET_COLUMNS,
        groupingMode: 'status'
    },
    {
        id: 'critical-tasks',
        name: 'Critical Tasks',
        isSystemPreset: true,
        filterState: {
            searchQuery: '',
            quickFilters: ['critical'],
            quickFilter: 'critical',
            statusFilter: 'all',
            resourceFilter: 'all'
        },
        visibleColumnIds: PRESET_FLOAT_COLUMNS,
        groupingMode: 'wbs'
    },
    {
        id: 'slipped-tasks',
        name: 'Slipped Tasks',
        isSystemPreset: true,
        filterState: {
            searchQuery: '',
            quickFilters: ['slipped'],
            quickFilter: 'slipped',
            statusFilter: 'all',
            resourceFilter: 'all'
        },
        visibleColumnIds: PRESET_VARIANCE_COLUMNS,
        groupingMode: 'wbs'
    },
    {
        id: 'milestones',
        name: 'Milestones',
        isSystemPreset: true,
        filterState: {
            searchQuery: '',
            quickFilters: ['milestones'],
            quickFilter: 'milestones',
            statusFilter: 'all',
            resourceFilter: 'all'
        },
        visibleColumnIds: ['wbs', 'status', 'name', 'startDate', 'dueDate', 'predecessors', 'percentComplete', 'actions'],
        groupingMode: 'wbs'
    },
    {
        id: 'tracking-variance',
        name: 'Tracking & Variance',
        isSystemPreset: true,
        filterState: {
            searchQuery: '',
            quickFilters: [],
            quickFilter: 'all',
            statusFilter: 'all',
            resourceFilter: 'all'
        },
        visibleColumnIds: PRESET_VARIANCE_COLUMNS,
        groupingMode: 'wbs'
    }
];

export class TaskDiscoveryEngine {
    /**
     * Resolves an array of active quick filters, handling legacy filterState shapes.
     */
    static getActiveQuickFilters(filters: TaskSheetFilterState): QuickFilterType[] {
        if (Array.isArray(filters.quickFilters)) {
            return filters.quickFilters;
        }
        if (typeof filters.quickFilter === 'string' && filters.quickFilter !== 'all') {
            return [filters.quickFilter as QuickFilterType];
        }
        return [];
    }

    /**
     * Creates an empty, default filter state.
     */
    static getDefaultFilterState(): TaskSheetFilterState {
        return {
            searchQuery: '',
            quickFilters: [],
            quickFilter: 'all',
            statusFilter: 'all',
            resourceFilter: 'all'
        };
    }

    /**
     * Checks whether any non-default filter is currently active.
     */
    static isFilterActive(filters: TaskSheetFilterState): boolean {
        const qf = this.getActiveQuickFilters(filters);
        return (
            (filters.searchQuery !== undefined && filters.searchQuery.trim().length > 0) ||
            qf.length > 0 ||
            (filters.statusFilter !== undefined && filters.statusFilter !== 'all') ||
            (filters.resourceFilter !== undefined && filters.resourceFilter !== 'all')
        );
    }

    /**
     * Evaluates whether a single row directly satisfies all active filter criteria.
     * All criteria are combined using Boolean AND logic.
     */
    static matchesRow(
        row: FlattenedGanttRow,
        filters: TaskSheetFilterState,
        currentUserId: string
    ): boolean {
        // 1. Text Search Substring Match
        if (filters.searchQuery && filters.searchQuery.trim().length > 0) {
            const q = filters.searchQuery.trim().toLowerCase();
            const titleMatch = (row.task.cleanTitle || '').toLowerCase().includes(q) || (row.task.text || '').toLowerCase().includes(q);
            const wbsMatch = (row.wbsCode || '').toLowerCase().includes(q);
            const resMatch = (row.resource || row.task.resource || '').toLowerCase().includes(q);
            const descMatch = (row.description || row.task.description || '').toLowerCase().includes(q);
            const rawLineMatch = (row.task.rawLine || '').toLowerCase().includes(q);
            
            // Status text representation match (e.g. searching "complete" or "in progress")
            const isCompleted = row.task.completed || row.percentComplete === 100 || row.actualFinish !== undefined;
            const isInProgress = !isCompleted && ((row.percentComplete > 0 && row.percentComplete < 100) || !!row.actualStart);
            const isNotStarted = !isCompleted && !isInProgress;
            
            let statusTextMatch = false;
            if (isCompleted && 'completed'.includes(q)) statusTextMatch = true;
            if (isInProgress && 'in progress'.includes(q)) statusTextMatch = true;
            if (isNotStarted && 'not started'.includes(q)) statusTextMatch = true;

            if (!titleMatch && !wbsMatch && !resMatch && !descMatch && !rawLineMatch && !statusTextMatch) {
                return false;
            }
        }

        // 2. Composable Quick Filters (AND Logic across all active filters)
        const qfList = this.getActiveQuickFilters(filters);

        // Summary tasks (parents) are NEVER direct matches for operational filters like critical, slipped, unassigned, etc.
        // They are preserved exclusively as hierarchical context when their children match.
        if (qfList.length > 0 && row.isParent) {
            return false;
        }

        for (const qf of qfList) {
            switch (qf) {
                case 'critical': {
                    // Critical = driving critical path, incomplete tasks
                    if (!row.isCritical || row.task.completed) {
                        return false;
                    }
                    break;
                }
                case 'slipped': {
                    // Slipped = documented finish variance > 0
                    const finishVar = row.variance?.finishVariance ?? row.task.variance?.finishVariance;
                    const isSlipped = finishVar !== undefined && finishVar > 0;
                    if (!isSlipped) {
                        return false;
                    }
                    break;
                }
                case 'assigned-me': {
                    const target = currentUserId.trim().toLowerCase();
                    if (!target) return false;
                    const res = (row.resource || row.task.resource || '').toLowerCase();
                    const isAssigned = res === target || res.includes(target);
                    if (!isAssigned) return false;
                    break;
                }
                case 'unassigned': {
                    const res = (row.resource || row.task.resource || '').trim();
                    if (res.length > 0) return false;
                    break;
                }
                case 'milestones': {
                    if (!row.isMilestone && row.durationDays !== 0) {
                        return false;
                    }
                    break;
                }
            }
        }

        // 3. Status Filter Match
        if (filters.statusFilter === 'not-started') {
            if (row.percentComplete > 0 || row.actualStart || row.task.completed) {
                return false;
            }
        } else if (filters.statusFilter === 'in-progress') {
            const isInProgress = (row.percentComplete > 0 && row.percentComplete < 100) ||
                (row.actualStart && !row.actualFinish && !row.task.completed);
            if (!isInProgress) {
                return false;
            }
        } else if (filters.statusFilter === 'completed') {
            const isCompleted = row.percentComplete === 100 || row.actualFinish !== undefined || row.task.completed;
            if (!isCompleted) {
                return false;
            }
        }

        // 4. Resource Filter Match
        if (filters.resourceFilter && filters.resourceFilter !== 'all') {
            const res = (row.resource || row.task.resource || '').trim();
            if (filters.resourceFilter === 'unassigned') {
                if (row.isParent) return false;
                if (res.length > 0) return false;
            } else {
                const targetRes = filters.resourceFilter.toLowerCase();
                const matchesRes = res.toLowerCase() === targetRes || res.toLowerCase().includes(targetRes);
                if (!matchesRes) return false;
            }
        }

        return true;
    }

    /**
     * Filters a flattened list of rows. In WBS mode, if a child task matches,
     * its ancestor chain is also retained with isAncestorOfMatch=true.
     */
    static filterRows(
        rows: FlattenedGanttRow[],
        filters: TaskSheetFilterState,
        currentUserId: string = '',
        isWbsMode: boolean = true
    ): { filteredRows: FlattenedGanttRow[]; directMatchCount: number } {
        if (!this.isFilterActive(filters)) {
            return {
                filteredRows: rows.map(r => ({ ...r, isAncestorOfMatch: false })),
                directMatchCount: rows.length
            };
        }

        // Step 1: Identify direct matching rows
        const directMatchIndices = new Set<number>();
        for (let i = 0; i < rows.length; i++) {
            if (this.matchesRow(rows[i], filters, currentUserId)) {
                directMatchIndices.add(i);
            }
        }

        const directMatchCount = directMatchIndices.size;

        if (directMatchCount === 0) {
            return { filteredRows: [], directMatchCount: 0 };
        }

        // In non-WBS grouping modes (Resource, Status), return only direct matches
        if (!isWbsMode) {
            const filtered = rows
                .filter((_, idx) => directMatchIndices.has(idx))
                .map(r => ({ ...r, isAncestorOfMatch: false }));
            return { filteredRows: filtered, directMatchCount };
        }

        // In WBS mode, walk up the ancestor chain for each direct match
        const lineIndexToRowIdx = new Map<number, number>();
        const wbsToRowIdx = new Map<string, number>();
        for (let i = 0; i < rows.length; i++) {
            if (rows[i].task?.lineIndex !== undefined) {
                lineIndexToRowIdx.set(rows[i].task.lineIndex, i);
            }
            if (rows[i].wbsCode) {
                wbsToRowIdx.set(rows[i].wbsCode, i);
            }
        }

        const visibleIndices = new Set<number>(directMatchIndices);
        for (const matchIdx of directMatchIndices) {
            let current = rows[matchIdx];
            const visited = new Set<number>();
            while (current) {
                let parentRowIdx: number | undefined;
                if (current.parentIndex !== undefined) {
                    if (lineIndexToRowIdx.has(current.parentIndex)) {
                        parentRowIdx = lineIndexToRowIdx.get(current.parentIndex);
                    } else if (current.parentIndex >= 0 && current.parentIndex < rows.length) {
                        parentRowIdx = current.parentIndex;
                    }
                }
                if (parentRowIdx === undefined && current.wbsCode && current.wbsCode.includes('.')) {
                    const parentWbs = current.wbsCode.substring(0, current.wbsCode.lastIndexOf('.'));
                    if (wbsToRowIdx.has(parentWbs)) {
                        parentRowIdx = wbsToRowIdx.get(parentWbs);
                    }
                }
                if (parentRowIdx !== undefined && !visited.has(parentRowIdx)) {
                    visited.add(parentRowIdx);
                    visibleIndices.add(parentRowIdx);
                    current = rows[parentRowIdx];
                } else {
                    break;
                }
            }
        }

        const filteredRows: FlattenedGanttRow[] = [];
        for (let i = 0; i < rows.length; i++) {
            if (visibleIndices.has(i)) {
                const isDirect = directMatchIndices.has(i);
                filteredRows.push({
                    ...rows[i],
                    isAncestorOfMatch: !isDirect
                });
            }
        }

        return { filteredRows, directMatchCount };
    }

    /**
     * Groups filtered rows into presentation sections based on the selected mode.
     */
    static groupRows(
        rows: FlattenedGanttRow[],
        mode: TaskGroupingMode,
        projectResources: ResourceDefinition[] = [],
        resourceUsageMap?: Map<string, ResourceUsageSummary>
    ): GroupedTaskSection[] {
        if (mode === 'wbs') {
            const totalWork = rows.reduce((sum, r) => sum + (r.isParent ? 0 : r.workHours || 0), 0);
            return [
                {
                    id: 'wbs-all',
                    title: 'Work Breakdown Structure',
                    taskCount: rows.length,
                    totalWorkHours: totalWork,
                    rows
                }
            ];
        }

        if (mode === 'resource') {
            const sections: GroupedTaskSection[] = [];
            const assignedTaskIdsByRes = new Map<string, FlattenedGanttRow[]>();

            for (const res of projectResources) {
                assignedTaskIdsByRes.set(res.id.toLowerCase(), []);
            }

            const unassignedRows: FlattenedGanttRow[] = [];

            for (const row of rows) {
                const res = (row.resource || row.task.resource || '').trim();
                if (res.length > 0) {
                    const rId = res.toLowerCase();
                    let bucket = assignedTaskIdsByRes.get(rId);
                    if (!bucket) {
                        bucket = [];
                        assignedTaskIdsByRes.set(rId, bucket);
                    }
                    bucket.push(row);
                } else if (!row.isParent) {
                    unassignedRows.push(row);
                }
            }

            // Create sections for defined resources that have tasks
            for (const res of projectResources) {
                const rId = res.id.toLowerCase();
                const bucket = assignedTaskIdsByRes.get(rId) || [];
                if (bucket.length > 0) {
                    const totalWork = bucket.reduce((sum, r) => sum + (r.workHours || 0), 0);
                    const usageSummary = resourceUsageMap?.get(rId);
                    const isOverAllocated = usageSummary?.hasOverAllocation || false;

                    sections.push({
                        id: `res-${res.id}`,
                        title: `@${res.name || res.id}`,
                        badgeText: `${res.type || 'Work'} (${res.workingHoursPerDay || 8}h/day)`,
                        isOverAllocated,
                        taskCount: bucket.length,
                        totalWorkHours: totalWork,
                        rows: bucket
                    });
                }
            }

            // Create sections for ad-hoc resources not defined in projectResources
            const definedResIds = new Set(projectResources.map(r => r.id.toLowerCase()));
            for (const [rId, bucket] of assignedTaskIdsByRes.entries()) {
                if (!definedResIds.has(rId) && bucket.length > 0) {
                    const totalWork = bucket.reduce((sum, r) => sum + (r.workHours || 0), 0);
                    sections.push({
                        id: `res-${rId}`,
                        title: `@${rId}`,
                        badgeText: 'Assigned',
                        isOverAllocated: false,
                        taskCount: bucket.length,
                        totalWorkHours: totalWork,
                        rows: bucket
                    });
                }
            }
            // Add unassigned tasks section if present
            if (unassignedRows.length > 0) {
                const totalWork = unassignedRows.reduce((sum, r) => sum + (r.workHours || 0), 0);
                sections.push({
                    id: 'res-unassigned',
                    title: '⚠️ Unassigned Tasks',
                    badgeText: 'Staffing Needed',
                    isOverAllocated: false,
                    taskCount: unassignedRows.length,
                    totalWorkHours: totalWork,
                    rows: unassignedRows
                });
            }

            return sections;
        }

        if (mode === 'status') {
            const notStarted: FlattenedGanttRow[] = [];
            const inProgress: FlattenedGanttRow[] = [];
            const completed: FlattenedGanttRow[] = [];

            for (const row of rows) {
                const isComp = row.task.completed || row.percentComplete === 100 || row.actualFinish !== undefined;
                if (isComp) {
                    completed.push(row);
                } else if (row.percentComplete > 0 || row.actualStart) {
                    inProgress.push(row);
                } else {
                    notStarted.push(row);
                }
            }

            const sections: GroupedTaskSection[] = [];

            if (notStarted.length > 0) {
                const work = notStarted.reduce((sum, r) => sum + (r.isParent ? 0 : r.workHours || 0), 0);
                sections.push({
                    id: 'status-not-started',
                    title: '📋 Not Started',
                    taskCount: notStarted.length,
                    totalWorkHours: work,
                    rows: notStarted
                });
            }

            if (inProgress.length > 0) {
                const work = inProgress.reduce((sum, r) => sum + (r.isParent ? 0 : r.workHours || 0), 0);
                sections.push({
                    id: 'status-in-progress',
                    title: '⏳ In Progress',
                    taskCount: inProgress.length,
                    totalWorkHours: work,
                    rows: inProgress
                });
            }

            if (completed.length > 0) {
                const work = completed.reduce((sum, r) => sum + (r.isParent ? 0 : r.workHours || 0), 0);
                sections.push({
                    id: 'status-completed',
                    title: '✅ Completed',
                    taskCount: completed.length,
                    totalWorkHours: work,
                    rows: completed
                });
            }

            return sections;
        }

        return [];
    }
}
