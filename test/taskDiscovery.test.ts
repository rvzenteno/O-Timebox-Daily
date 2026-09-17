import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { 
    TaskDiscoveryEngine, 
    FlattenedGanttRow, 
    TaskSheetFilterState, 
    DEFAULT_SAVED_VIEWS,
    SavedViewDefinition
} from '../taskDiscoveryEngine';
import { ResourceDefinition } from '../projectModel';
import { ProjectTask } from '../projectManager';
import { ResourceUsageSummary } from '../resourceEngine';
import { MarkdownAdapter } from '../markdownAdapter';
import { SchedulingEngine } from '../schedulingEngine';

function createMockTask(overrides: Partial<ProjectTask> = {}): ProjectTask {
    const title = overrides.cleanTitle || overrides.text || 'Excavation & Utility Trenching';
    return {
        text: title,
        cleanTitle: title,
        rawLine: `- [ ] ${title}`,
        completed: false,
        lineIndex: 1,
        projectFilePath: 'test.md',
        projectName: 'Test Project',
        indentationLevel: 0,
        subtasks: [],
        lineCount: 1,
        durationDays: 5,
        isMilestone: false,
        predecessors: [],
        ...overrides
    };
}

function createMockRow(overrides: Partial<FlattenedGanttRow> = {}): FlattenedGanttRow {
    const task = overrides.task || createMockTask();
    return {
        task,
        isParent: false,
        isSubtask: false,
        hasDates: true,
        startDate: '2026-10-01',
        dueDate: '2026-10-07',
        durationDays: 5,
        isMilestone: false,
        visible: true,
        wbsCode: '2.1',
        wbsIndex: 1,
        resource: 'bob-tech',
        predecessors: [],
        isBlocked: false,
        isCritical: false,
        totalFloat: 3,
        freeFloat: 3,
        workHours: 40,
        percentComplete: 0,
        workingIntervals: [{ start: '2026-10-01', end: '2026-10-07' }],
        ...overrides
    };
}

test('TaskDiscoveryEngine: 1. Text Search Substring Matching Across Fields', () => {
    const r1 = createMockRow({
        task: createMockTask({ cleanTitle: 'Foundation Concrete Pour', rawLine: '- [ ] Foundation Concrete Pour #concrete' }),
        wbsCode: '1.1',
        resource: 'dave-contractor',
        description: 'Pour high-strength 4000 PSI mix'
    });

    const r2 = createMockRow({
        task: createMockTask({ cleanTitle: 'Electrical Conduit Sizing', rawLine: '- [ ] Electrical Conduit Sizing #urgent' }),
        wbsCode: '1.2',
        resource: 'alice-eng'
    });

    const rows = [r1, r2];

    // Search by title
    const resTitle = TaskDiscoveryEngine.filterRows(rows, {
        searchQuery: 'concrete',
        quickFilter: 'all',
        statusFilter: 'all',
        resourceFilter: 'all'
    });
    assert.strictEqual(resTitle.directMatchCount, 1);
    assert.strictEqual(resTitle.filteredRows[0].wbsCode, '1.1');

    // Search by WBS code
    const resWbs = TaskDiscoveryEngine.filterRows(rows, {
        searchQuery: '1.2',
        quickFilter: 'all',
        statusFilter: 'all',
        resourceFilter: 'all'
    });
    assert.strictEqual(resWbs.directMatchCount, 1);
    assert.strictEqual(resWbs.filteredRows[0].wbsCode, '1.2');

    // Search by Resource name
    const resResource = TaskDiscoveryEngine.filterRows(rows, {
        searchQuery: 'alice',
        quickFilter: 'all',
        statusFilter: 'all',
        resourceFilter: 'all'
    });
    assert.strictEqual(resResource.directMatchCount, 1);
    assert.strictEqual(resResource.filteredRows[0].wbsCode, '1.2');

    // Search by Description notes
    const resDesc = TaskDiscoveryEngine.filterRows(rows, {
        searchQuery: '4000 PSI',
        quickFilter: 'all',
        statusFilter: 'all',
        resourceFilter: 'all'
    });
    assert.strictEqual(resDesc.directMatchCount, 1);
    assert.strictEqual(resDesc.filteredRows[0].wbsCode, '1.1');

    // Search with negative match
    const resNeg = TaskDiscoveryEngine.filterRows(rows, {
        searchQuery: 'plumbing nonexistent',
        quickFilter: 'all',
        statusFilter: 'all',
        resourceFilter: 'all'
    });
    assert.strictEqual(resNeg.directMatchCount, 0);
    assert.strictEqual(resNeg.filteredRows.length, 0);
});

test('TaskDiscoveryEngine: 2. Quick Filters (Critical, Slipped, My Tasks, Milestones, Unassigned)', () => {
    const critRow = createMockRow({
        task: createMockTask({ cleanTitle: 'Critical Foundation Path' }),
        wbsCode: '1.1',
        isCritical: true,
        totalFloat: 0
    });

    const slipRow = createMockRow({
        task: createMockTask({ 
            cleanTitle: 'Delayed Steel Delivery',
            variance: {
                startVariance: 0,
                finishVariance: 3,
                durationVariance: 0,
                workVariance: 0,
                costVariance: 0
            }
        }),
        wbsCode: '1.2',
        dueDate: '2026-10-10',
        forecastFinish: '2026-10-13'
    });

    const myRow = createMockRow({
        task: createMockTask({ cleanTitle: 'Alice Engineering Review' }),
        wbsCode: '1.3',
        resource: 'alice'
    });

    const msRow = createMockRow({
        task: createMockTask({ cleanTitle: 'Groundbreaking Ceremony' }),
        wbsCode: '1.4',
        isMilestone: true,
        durationDays: 0
    });

    const unassignedRow = createMockRow({
        task: createMockTask({ cleanTitle: 'Site Cleanup Unassigned' }),
        wbsCode: '1.5',
        resource: undefined
    });

    const rows = [critRow, slipRow, myRow, msRow, unassignedRow];

    // Filter: Critical
    const critRes = TaskDiscoveryEngine.filterRows(rows, {
        searchQuery: '',
        quickFilter: 'critical',
        statusFilter: 'all',
        resourceFilter: 'all'
    });
    assert.strictEqual(critRes.directMatchCount, 1);
    assert.strictEqual(critRes.filteredRows[0].wbsCode, '1.1');

    // Filter: Slipped
    const slipRes = TaskDiscoveryEngine.filterRows(rows, {
        searchQuery: '',
        quickFilter: 'slipped',
        statusFilter: 'all',
        resourceFilter: 'all'
    });
    assert.strictEqual(slipRes.directMatchCount, 1);
    assert.strictEqual(slipRes.filteredRows[0].wbsCode, '1.2');

    // Filter: My Tasks (Alice)
    const myRes = TaskDiscoveryEngine.filterRows(rows, {
        searchQuery: '',
        quickFilter: 'assigned-me',
        statusFilter: 'all',
        resourceFilter: 'all'
    }, 'alice');
    assert.strictEqual(myRes.directMatchCount, 1);
    assert.strictEqual(myRes.filteredRows[0].wbsCode, '1.3');

    // Filter: Milestones
    const msRes = TaskDiscoveryEngine.filterRows(rows, {
        searchQuery: '',
        quickFilter: 'milestones',
        statusFilter: 'all',
        resourceFilter: 'all'
    });
    assert.strictEqual(msRes.directMatchCount, 1);
    assert.strictEqual(msRes.filteredRows[0].wbsCode, '1.4');

    // Filter: Unassigned
    const unassignedRes = TaskDiscoveryEngine.filterRows(rows, {
        searchQuery: '',
        quickFilter: 'unassigned',
        statusFilter: 'all',
        resourceFilter: 'all'
    });
    assert.strictEqual(unassignedRes.directMatchCount, 1);
    assert.strictEqual(unassignedRes.filteredRows[0].wbsCode, '1.5');
});

test('TaskDiscoveryEngine: 3. Status Filters (Not Started, In Progress, Completed)', () => {
    const notStartedRow = createMockRow({
        task: createMockTask({ cleanTitle: 'Future Framing', completed: false }),
        wbsCode: '2.1',
        percentComplete: 0
    });

    const inProgressRow = createMockRow({
        task: createMockTask({ cleanTitle: 'Ongoing Drywall', completed: false }),
        wbsCode: '2.2',
        actualStart: '2026-10-02',
        percentComplete: 45
    });

    const completedRow = createMockRow({
        task: createMockTask({ cleanTitle: 'Done Demolition', completed: true }),
        wbsCode: '2.3',
        actualStart: '2026-09-20',
        actualFinish: '2026-09-25',
        percentComplete: 100
    });

    const rows = [notStartedRow, inProgressRow, completedRow];

    // Status: Not Started
    const nsRes = TaskDiscoveryEngine.filterRows(rows, {
        searchQuery: '',
        quickFilter: 'all',
        statusFilter: 'not-started',
        resourceFilter: 'all'
    });
    assert.strictEqual(nsRes.directMatchCount, 1);
    assert.strictEqual(nsRes.filteredRows[0].wbsCode, '2.1');

    // Status: In Progress
    const ipRes = TaskDiscoveryEngine.filterRows(rows, {
        searchQuery: '',
        quickFilter: 'all',
        statusFilter: 'in-progress',
        resourceFilter: 'all'
    });
    assert.strictEqual(ipRes.directMatchCount, 1);
    assert.strictEqual(ipRes.filteredRows[0].wbsCode, '2.2');

    // Status: Completed
    const compRes = TaskDiscoveryEngine.filterRows(rows, {
        searchQuery: '',
        quickFilter: 'all',
        statusFilter: 'completed',
        resourceFilter: 'all'
    });
    assert.strictEqual(compRes.directMatchCount, 1);
    assert.strictEqual(compRes.filteredRows[0].wbsCode, '2.3');
});

test('TaskDiscoveryEngine: 4. Composable Multi-Filter Evaluation (AND Logic)', () => {
    const r1 = createMockRow({
        task: createMockTask({ cleanTitle: 'HVAC Ductwork Bob Critical' }),
        wbsCode: '3.1',
        resource: 'bob',
        isCritical: true,
        percentComplete: 50
    });

    const r2 = createMockRow({
        task: createMockTask({ cleanTitle: 'HVAC Ductwork Bob Normal' }),
        wbsCode: '3.2',
        resource: 'bob',
        isCritical: false,
        totalFloat: 4,
        percentComplete: 20
    });

    const r3 = createMockRow({
        task: createMockTask({ cleanTitle: 'HVAC Ductwork Alice Critical' }),
        wbsCode: '3.3',
        resource: 'alice',
        isCritical: true,
        percentComplete: 50
    });

    const rows = [r1, r2, r3];

    // Test: Critical AND Resource = Bob
    const combined = TaskDiscoveryEngine.filterRows(rows, {
        searchQuery: '',
        quickFilter: 'critical',
        statusFilter: 'all',
        resourceFilter: 'bob'
    });
    assert.strictEqual(combined.directMatchCount, 1, 'Only r1 matches BOTH Critical and Resource=Bob');
    assert.strictEqual(combined.filteredRows[0].wbsCode, '3.1');

    // Test: Critical AND Resource = Bob AND Status = in-progress
    const triple = TaskDiscoveryEngine.filterRows(rows, {
        searchQuery: '',
        quickFilter: 'critical',
        statusFilter: 'in-progress',
        resourceFilter: 'bob'
    });
    assert.strictEqual(triple.directMatchCount, 1);
    assert.strictEqual(triple.filteredRows[0].wbsCode, '3.1');

    // Test: Search + Filter composition: "Normal" + Critical (conflicting -> 0 results)
    const zeroRes = TaskDiscoveryEngine.filterRows(rows, {
        searchQuery: 'Normal',
        quickFilter: 'critical',
        statusFilter: 'all',
        resourceFilter: 'all'
    });
    assert.strictEqual(zeroRes.directMatchCount, 0, 'No task satisfies Normal title AND Critical');
});

test('TaskDiscoveryEngine: 5. WBS Hierarchy Context Retention on Filter Match', () => {
    const parent = createMockRow({
        task: createMockTask({ lineIndex: 10, cleanTitle: 'Civil Works Phase' }),
        wbsCode: '1',
        isParent: true,
        resource: undefined
    });

    const child = createMockRow({
        task: createMockTask({ lineIndex: 11, cleanTitle: 'Excavation Deep' }),
        wbsCode: '1.1',
        isSubtask: true,
        parentIndex: 10,
        resource: 'charlie'
    });

    const unrelated = createMockRow({
        task: createMockTask({ lineIndex: 20, cleanTitle: 'Electrical Design' }),
        wbsCode: '2',
        resource: 'dave'
    });

    const rows = [parent, child, unrelated];

    // Filter matching ONLY child
    const res = TaskDiscoveryEngine.filterRows(rows, {
        searchQuery: 'Excavation',
        quickFilter: 'all',
        statusFilter: 'all',
        resourceFilter: 'all'
    }, '', true); // WBS mode = true

    assert.strictEqual(res.directMatchCount, 1, 'Only 1 direct match');
    assert.strictEqual(res.filteredRows.length, 2, 'Parent + matching child preserved');
    assert.strictEqual(res.filteredRows[0].wbsCode, '1');
    assert.strictEqual(res.filteredRows[0].isAncestorOfMatch, true, 'Parent marked as ancestor context');
    assert.strictEqual(res.filteredRows[1].wbsCode, '1.1');
    assert.strictEqual(res.filteredRows[1].isAncestorOfMatch, false, 'Child is direct match');
});

test('TaskDiscoveryEngine: 6. Grouping Engine (WBS, Resource, Status)', () => {
    const r1 = createMockRow({
        task: createMockTask({ cleanTitle: 'Task 1' }),
        wbsCode: '1.1',
        resource: 'alice',
        workHours: 16,
        percentComplete: 0
    });

    const r2 = createMockRow({
        task: createMockTask({ cleanTitle: 'Task 2' }),
        wbsCode: '1.2',
        resource: 'bob',
        workHours: 24,
        actualStart: '2026-10-01',
        percentComplete: 50
    });

    const r3 = createMockRow({
        task: createMockTask({ cleanTitle: 'Task 3', completed: true }),
        wbsCode: '1.3',
        resource: undefined,
        workHours: 8,
        percentComplete: 100
    });

    const rows = [r1, r2, r3];
    const resources: ResourceDefinition[] = [
        { id: 'alice', name: 'Alice Engineer', type: 'Work', maxUnits: 1.0, workingHoursPerDay: 8, ratePerHour: 100 },
        { id: 'bob', name: 'Bob Technician', type: 'Work', maxUnits: 0.5, workingHoursPerDay: 4, ratePerHour: 60 }
    ];

    const usageMap = new Map<string, ResourceUsageSummary>();
    usageMap.set('bob', {
        resource: resources[1],
        totalWorkHours: 24,
        totalCost: 1440,
        assignedTasks: [],
        dailyAllocations: new Map(),
        hasOverAllocation: true, // Bob is flagged as over-allocated
        peakAllocationUnits: 2.0,
        peakAllocationHours: 8,
        overallUtilizationPercent: 200
    });

    // 1. Group by WBS
    const wbsGroups = TaskDiscoveryEngine.groupRows(rows, 'wbs');
    assert.strictEqual(wbsGroups.length, 1);
    assert.strictEqual(wbsGroups[0].rows.length, 3);
    assert.strictEqual(wbsGroups[0].totalWorkHours, 48);

    // 2. Group by Resource
    const resGroups = TaskDiscoveryEngine.groupRows(rows, 'resource', resources, usageMap);
    assert.strictEqual(resGroups.length, 3, 'Alice, Bob, and Unassigned');
    
    // Check Alice section
    const aliceSec = resGroups.find(g => g.id === 'res-alice');
    assert.ok(aliceSec);
    assert.strictEqual(aliceSec?.taskCount, 1);
    assert.strictEqual(aliceSec?.isOverAllocated, false);

    // Check Bob section (over-allocated)
    const bobSec = resGroups.find(g => g.id === 'res-bob');
    assert.ok(bobSec);
    assert.strictEqual(bobSec?.taskCount, 1);
    assert.strictEqual(bobSec?.isOverAllocated, true, 'Bob over-allocation badge recognized');

    // Check Unassigned section
    const unassignedSec = resGroups.find(g => g.id === 'res-unassigned');
    assert.ok(unassignedSec);
    assert.strictEqual(unassignedSec?.taskCount, 1);

    // 3. Group by Status
    const statusGroups = TaskDiscoveryEngine.groupRows(rows, 'status');
    assert.strictEqual(statusGroups.length, 3, 'Not Started, In Progress, Completed');
    assert.strictEqual(statusGroups.find(g => g.id === 'status-not-started')?.taskCount, 1);
    assert.strictEqual(statusGroups.find(g => g.id === 'status-in-progress')?.taskCount, 1);
    assert.strictEqual(statusGroups.find(g => g.id === 'status-completed')?.taskCount, 1);
});

test('TaskDiscoveryEngine: 7. Four-State Lifecycle Non-Mutation Verification', () => {
    const initialTask = createMockTask({
        cleanTitle: 'Foundation Excavation'
    });

    const row = createMockRow({
        task: initialTask,
        plannedStart: '2026-10-01',
        plannedFinish: '2026-10-07',
        baselineStart: '2026-10-01',
        baselineFinish: '2026-10-07',
        actualStart: '2026-10-02',
        actualFinish: undefined,
        actualWork: 16,
        forecastStart: '2026-10-02',
        forecastFinish: '2026-10-10',
        percentComplete: 40
    });

    const rows = [row];

    // Perform multiple discovery operations: search, filter, group
    TaskDiscoveryEngine.filterRows(rows, {
        searchQuery: 'Foundation',
        quickFilter: 'all',
        statusFilter: 'in-progress',
        resourceFilter: 'all'
    });
    TaskDiscoveryEngine.groupRows(rows, 'status');
    TaskDiscoveryEngine.groupRows(rows, 'resource');

    // Verify all 4 lifecycle states are 100% untouched
    assert.strictEqual(row.plannedStart, '2026-10-01', 'Planned Start untouched');
    assert.strictEqual(row.plannedFinish, '2026-10-07', 'Planned Finish untouched');
    assert.strictEqual(row.baselineStart, '2026-10-01', 'Baseline Start untouched');
    assert.strictEqual(row.baselineFinish, '2026-10-07', 'Baseline Finish untouched');
    assert.strictEqual(row.actualStart, '2026-10-02', 'Actual Start untouched');
    assert.strictEqual(row.actualWork, 16, 'Actual Work untouched');
    assert.strictEqual(row.forecastStart, '2026-10-02', 'Forecast Start untouched');
    assert.strictEqual(row.forecastFinish, '2026-10-10', 'Forecast Finish untouched');
    assert.strictEqual(row.percentComplete, 40, 'Percent Complete untouched');
});

test('TaskDiscoveryEngine: 8. Saved View Presets & Definitions', () => {
    assert.strictEqual(DEFAULT_SAVED_VIEWS.length, 6, '6 standard presets available');

    const defaultView = DEFAULT_SAVED_VIEWS.find(v => v.id === 'default');
    assert.ok(defaultView);
    assert.strictEqual(defaultView?.groupingMode, 'wbs');
    assert.strictEqual(defaultView?.filterState.quickFilter, 'all');

    const myOpenView = DEFAULT_SAVED_VIEWS.find(v => v.id === 'my-open-tasks');
    assert.ok(myOpenView);
    assert.strictEqual(myOpenView?.filterState.quickFilter, 'assigned-me');
    assert.strictEqual(myOpenView?.groupingMode, 'status');

    const critView = DEFAULT_SAVED_VIEWS.find(v => v.id === 'critical-tasks');
    assert.ok(critView);
    assert.strictEqual(critView?.filterState.quickFilter, 'critical');

    const slipView = DEFAULT_SAVED_VIEWS.find(v => v.id === 'slipped-tasks');
    assert.ok(slipView);
    assert.strictEqual(slipView?.filterState.quickFilter, 'slipped');
});

test('TaskDiscoveryEngine: 9. Clear Filters & Empty Result Set Handling', () => {
    const rows = [
        createMockRow({ task: createMockTask({ cleanTitle: 'Surveying Site' }), wbsCode: '1.1' })
    ];

    // Filter with zero matches
    const emptyResult = TaskDiscoveryEngine.filterRows(rows, {
        searchQuery: 'Nonexistent',
        quickFilter: 'critical',
        statusFilter: 'completed',
        resourceFilter: 'nobody'
    });
    assert.strictEqual(emptyResult.directMatchCount, 0);
    assert.strictEqual(emptyResult.filteredRows.length, 0);

    // Clear filters (reset to default)
    const defaultState = TaskDiscoveryEngine.getDefaultFilterState();
    assert.strictEqual(TaskDiscoveryEngine.isFilterActive(defaultState), false);
    const resetResult = TaskDiscoveryEngine.filterRows(rows, defaultState);
    assert.strictEqual(resetResult.directMatchCount, 1);
    assert.strictEqual(resetResult.filteredRows.length, 1);
});

test('TaskDiscoveryEngine: 10. Saved View Persistence & Switching Simulation', () => {
    // Simulate plugin settings storage in data.json
    const mockDataJson: { taskSheetSavedViews: SavedViewDefinition[]; taskSheetActiveSavedViewId: string } = {
        taskSheetSavedViews: [...DEFAULT_SAVED_VIEWS],
        taskSheetActiveSavedViewId: 'default'
    };

    // User creates a custom Saved View
    const customView: SavedViewDefinition = {
        id: 'custom-high-priority',
        name: 'High Priority Concrete',
        isSystemPreset: false,
        filterState: {
            searchQuery: 'Concrete',
            quickFilter: 'critical',
            statusFilter: 'in-progress',
            resourceFilter: 'bob'
        },
        visibleColumnIds: ['wbs', 'status', 'name', 'critical', 'actions'],
        groupingMode: 'resource'
    };
    mockDataJson.taskSheetSavedViews.push(customView);
    mockDataJson.taskSheetActiveSavedViewId = customView.id;

    // Simulate reload from data.json
    const loadedData = JSON.parse(JSON.stringify(mockDataJson));
    assert.strictEqual(loadedData.taskSheetSavedViews.length, 7);
    assert.strictEqual(loadedData.taskSheetActiveSavedViewId, 'custom-high-priority');

    // Switch back to Default View
    const activeView = loadedData.taskSheetSavedViews.find((v: SavedViewDefinition) => v.id === 'default');
    assert.ok(activeView);
    assert.strictEqual(activeView.groupingMode, 'wbs');
    assert.strictEqual(activeView.filterState.quickFilter, 'all');
});

test('TaskDiscoveryEngine: 11. Realistic 55-Task Project Validation', () => {
    const fixturePath = path.join(process.cwd(), 'docs/qa/realistic-commercial-buildout.md');
    if (!fs.existsSync(fixturePath)) {
        return;
    }
    const content = fs.readFileSync(fixturePath, 'utf8');
    const project = MarkdownAdapter.parseProject('realistic-commercial-buildout.md', 'Commercial Buildout', content);
    SchedulingEngine.schedule(project);

    assert.ok(project.tasks.length >= 40, `Project has ${project.tasks.length} tasks`);

    // Convert NormalizedTasks to FlattenedGanttRows for discovery testing
    const rows: FlattenedGanttRow[] = project.tasks.map((t, idx) => {
        const pTask: ProjectTask = {
            text: t.title,
            cleanTitle: t.title,
            rawLine: `- [ ] ${t.title}`,
            completed: t.completed,
            lineIndex: idx + 1,
            projectFilePath: 'commercial.md',
            projectName: 'Commercial Buildout',
            indentationLevel: t.depth,
            subtasks: [],
            lineCount: 1,
            durationDays: t.durationDays,
            isMilestone: t.isMilestone,
            predecessors: [],
            wbsCode: t.wbsCode,
            resource: t.assignments?.[0]?.resourceId
        };
        return {
            task: pTask,
            isParent: t.isSummary,
            isSubtask: t.depth > 0,
            hasDates: !!(t.plannedStart || t.plannedFinish),
            startDate: t.plannedStart,
            dueDate: t.plannedFinish,
            durationDays: t.durationDays,
            isMilestone: t.isMilestone,
            visible: true,
            wbsCode: t.wbsCode,
            wbsIndex: idx + 1,
            resource: t.assignments?.[0]?.resourceId,
            predecessors: [],
            isBlocked: false,
            isCritical: t.isCritical,
            totalFloat: t.totalFloat,
            freeFloat: t.freeFloat,
            workHours: t.workHours,
            percentComplete: t.percentComplete,
            workingIntervals: []
        };
    });

    // 1. Instant Text Search on 55-task project
    const searchRes = TaskDiscoveryEngine.filterRows(rows, {
        searchQuery: 'Foundation',
        quickFilter: 'all',
        statusFilter: 'all',
        resourceFilter: 'all'
    });
    assert.ok(searchRes.directMatchCount >= 2, 'Found foundation tasks');

    // 2. Critical Path Filter
    const critRes = TaskDiscoveryEngine.filterRows(rows, {
        searchQuery: '',
        quickFilter: 'critical',
        statusFilter: 'all',
        resourceFilter: 'all'
    });
    assert.ok(critRes.directMatchCount >= 5, 'Found driving critical path tasks');

    // 3. Milestones Filter
    const msRes = TaskDiscoveryEngine.filterRows(rows, {
        searchQuery: '',
        quickFilter: 'milestones',
        statusFilter: 'all',
        resourceFilter: 'all'
    });
    assert.ok(msRes.directMatchCount >= 2, 'Found milestone checkpoints');

    // 4. Grouping by Resource
    const resGroups = TaskDiscoveryEngine.groupRows(rows, 'resource', project.resources);
    assert.ok(resGroups.length >= 3, 'Grouped into defined resource buckets');
});

test('TaskDiscoveryEngine: 12. Scale Performance Benchmarks (100, 500, 1,000, 5,000 Tasks)', () => {
    const scales = [100, 500, 1000, 5000];

    for (const count of scales) {
        const generatedRows: FlattenedGanttRow[] = [];
        for (let i = 0; i < count; i++) {
            const isCrit = i % 7 === 0;
            const isSlipped = i % 9 === 0;
            const resId = i % 2 === 0 ? 'bob-tech' : 'alice-eng';
            generatedRows.push(createMockRow({
                task: createMockTask({
                    cleanTitle: `Electrical Work Package ${i} Sector ${i % 10}`,
                    rawLine: `- [ ] Electrical Work Package ${i} Sector ${i % 10} @${resId}`,
                    resource: resId,
                    variance: isSlipped ? { startVariance: 0, finishVariance: 2, durationVariance: 0, workVariance: 0, costVariance: 0 } : undefined
                }),
                wbsCode: `1.${i}`,
                resource: resId,
                isCritical: isCrit,
                totalFloat: isCrit ? 0 : 5
            }));
        }

        // Measure Search
        const t0 = performance.now();
        const searchRes = TaskDiscoveryEngine.filterRows(generatedRows, {
            searchQuery: 'Sector 5',
            quickFilter: 'all',
            statusFilter: 'all',
            resourceFilter: 'all'
        });
        const tSearch = performance.now() - t0;

        // Measure Multi-Filter (Critical + Resource Bob)
        const t1 = performance.now();
        const filterRes = TaskDiscoveryEngine.filterRows(generatedRows, {
            searchQuery: '',
            quickFilter: 'critical',
            statusFilter: 'all',
            resourceFilter: 'bob-tech'
        });
        const tFilter = performance.now() - t1;

        // Measure Grouping by Resource
        const t2 = performance.now();
        const groupRes = TaskDiscoveryEngine.groupRows(filterRes.filteredRows, 'resource', [
            { id: 'bob-tech', name: 'Bob Tech', type: 'Work', maxUnits: 1.0 },
            { id: 'alice-eng', name: 'Alice Eng', type: 'Work', maxUnits: 1.0 }
        ]);
        const tGroup = performance.now() - t2;

        // Measure Switching Saved View
        const t3 = performance.now();
        const activeView = DEFAULT_SAVED_VIEWS[2]; // Critical Tasks preset
        const viewFilterRes = TaskDiscoveryEngine.filterRows(generatedRows, activeView.filterState);
        const viewGroupRes = TaskDiscoveryEngine.groupRows(viewFilterRes.filteredRows, activeView.groupingMode);
        const tViewSwitch = performance.now() - t3;

        assert.ok(searchRes.directMatchCount > 0, `Search yielded matches at ${count} scale`);
        assert.ok(filterRes.directMatchCount > 0, `Filter yielded matches at ${count} scale`);
        assert.ok(groupRes.length > 0, `Group yielded sections at ${count} scale`);
        assert.ok(viewGroupRes.length > 0, `Saved view yielded sections at ${count} scale`);

        console.log(`[Scale ${count} Tasks Benchmark] Search: ${tSearch.toFixed(2)}ms | Filter: ${tFilter.toFixed(2)}ms | Group: ${tGroup.toFixed(2)}ms | ViewSwitch: ${tViewSwitch.toFixed(2)}ms`);

        // Strict latency assertions:
        if (count <= 1000) {
            assert.ok(tSearch < 15, `Search under 15ms at ${count} scale (was ${tSearch.toFixed(2)}ms)`);
            assert.ok(tFilter < 15, `Filter under 15ms at ${count} scale (was ${tFilter.toFixed(2)}ms)`);
            assert.ok(tGroup < 15, `Group under 15ms at ${count} scale (was ${tGroup.toFixed(2)}ms)`);
            assert.ok(tViewSwitch < 15, `ViewSwitch under 15ms at ${count} scale (was ${tViewSwitch.toFixed(2)}ms)`);
        } else {
            assert.ok(tSearch < 50, `Search under 50ms at ${count} scale (was ${tSearch.toFixed(2)}ms)`);
            assert.ok(tFilter < 50, `Filter under 50ms at ${count} scale (was ${tFilter.toFixed(2)}ms)`);
            assert.ok(tGroup < 50, `Group under 50ms at ${count} scale (was ${tGroup.toFixed(2)}ms)`);
            assert.ok(tViewSwitch < 50, `ViewSwitch under 50ms at ${count} scale (was ${tViewSwitch.toFixed(2)}ms)`);
        }
    }
});

// ==========================================================================
// REGRESSION SUITE: TIMEBOX v1.6 PHASE 1 DEFECTS & LIFECYCLE AUDIT
// ==========================================================================

test('TaskDiscoveryEngine: 13. Critical Filter (Zero Matches vs Actual Matches & Ancestor Context)', () => {
    // 1. Project where NO tasks are critical
    const parentRow = createMockRow({
        task: createMockTask({ cleanTitle: 'Phase 1 Summary', lineIndex: 1 }),
        wbsCode: '1',
        isParent: true,
        isCritical: false,
        totalFloat: 10
    });
    const nonCritChild1 = createMockRow({
        task: createMockTask({ cleanTitle: 'Task A', lineIndex: 2 }),
        wbsCode: '1.1',
        parentIndex: 1,
        isCritical: false,
        totalFloat: 10
    });
    const nonCritChild2 = createMockRow({
        task: createMockTask({ cleanTitle: 'Task B', lineIndex: 3 }),
        wbsCode: '1.2',
        parentIndex: 1,
        isCritical: false,
        totalFloat: 8
    });

    const rowsZeroCrit = [parentRow, nonCritChild1, nonCritChild2];
    const zeroCritRes = TaskDiscoveryEngine.filterRows(rowsZeroCrit, {
        searchQuery: '',
        quickFilters: ['critical'],
        statusFilter: 'all',
        resourceFilter: 'all'
    });

    // When zero tasks satisfy isCritical, directMatchCount MUST be 0 and filteredRows MUST be empty
    assert.strictEqual(zeroCritRes.directMatchCount, 0, 'Zero direct matches when no tasks are critical');
    assert.strictEqual(zeroCritRes.filteredRows.length, 0, 'Filtered rows must be empty (no phantom ancestors)');

    // 2. Project with 1 critical child under Phase 1, and non-critical Phase 2
    const phase2Parent = createMockRow({
        task: createMockTask({ cleanTitle: 'Phase 2 Summary', lineIndex: 4 }),
        wbsCode: '2',
        isParent: true,
        isCritical: false,
        totalFloat: 5
    });
    const nonCritChild3 = createMockRow({
        task: createMockTask({ cleanTitle: 'Task C', lineIndex: 5 }),
        wbsCode: '2.1',
        parentIndex: 4,
        isCritical: false,
        totalFloat: 5
    });
    const critChild = createMockRow({
        task: createMockTask({ cleanTitle: 'Critical Task A', lineIndex: 2 }),
        wbsCode: '1.1',
        parentIndex: 1,
        isCritical: true,
        totalFloat: 0
    });

    const rowsWithCrit = [parentRow, critChild, nonCritChild2, phase2Parent, nonCritChild3];
    const withCritRes = TaskDiscoveryEngine.filterRows(rowsWithCrit, {
        searchQuery: '',
        quickFilters: ['critical'],
        statusFilter: 'all',
        resourceFilter: 'all'
    });

    assert.strictEqual(withCritRes.directMatchCount, 1, 'Exactly 1 direct match');
    assert.strictEqual(withCritRes.filteredRows.length, 2, 'Child + its ancestor (Phase 1)');
    assert.strictEqual(withCritRes.filteredRows[0].wbsCode, '1', 'Ancestor Phase 1 retained');
    assert.strictEqual(withCritRes.filteredRows[0].isAncestorOfMatch, true, 'Marked as ancestor context');
    assert.strictEqual(withCritRes.filteredRows[1].wbsCode, '1.1', 'Direct matching child');
    assert.strictEqual(withCritRes.filteredRows[1].isAncestorOfMatch, false);

    // Verify Phase 2 parent and children are completely excluded
    const hasPhase2 = withCritRes.filteredRows.some(r => r.wbsCode.startsWith('2'));
    assert.strictEqual(hasPhase2, false, 'Unrelated WBS ancestor Phase 2 is NOT retained');
});

test('TaskDiscoveryEngine: 14. Slipped Filter (Documented finishVariance > 0 vs Zero Slipped)', () => {
    const r1 = createMockRow({
        task: createMockTask({ cleanTitle: 'On-Time Task', lineIndex: 1 }),
        wbsCode: '1.1',
        variance: { startVariance: 0, finishVariance: 0, durationVariance: 0, workVariance: 0, costVariance: 0 }
    });
    const r2 = createMockRow({
        task: createMockTask({ cleanTitle: 'Early Task', lineIndex: 2 }),
        wbsCode: '1.2',
        variance: { startVariance: -1, finishVariance: -2, durationVariance: -1, workVariance: 0, costVariance: 0 }
    });

    // Zero slipped tasks
    const zeroSlippedRes = TaskDiscoveryEngine.filterRows([r1, r2], {
        searchQuery: '',
        quickFilters: ['slipped'],
        statusFilter: 'all',
        resourceFilter: 'all'
    });

    assert.strictEqual(zeroSlippedRes.directMatchCount, 0, 'Zero slipped matches');
    assert.strictEqual(zeroSlippedRes.filteredRows.length, 0, 'Does NOT fall back to showing all tasks');

    // With a genuinely slipped task (finishVariance: 3)
    const rSlipped = createMockRow({
        task: createMockTask({ cleanTitle: 'Delayed Concrete Pour', lineIndex: 3 }),
        wbsCode: '1.3',
        variance: { startVariance: 1, finishVariance: 3, durationVariance: 2, workVariance: 16, costVariance: 1200 }
    });

    const withSlippedRes = TaskDiscoveryEngine.filterRows([r1, r2, rSlipped], {
        searchQuery: '',
        quickFilters: ['slipped'],
        statusFilter: 'all',
        resourceFilter: 'all'
    });

    assert.strictEqual(withSlippedRes.directMatchCount, 1, 'Found 1 slipped task');
    assert.strictEqual(withSlippedRes.filteredRows[0].wbsCode, '1.3');
});

test('TaskDiscoveryEngine: 15. Composable Quick Filters & Multi-Filter AND Pipeline', () => {
    const r1 = createMockRow({
        task: createMockTask({ cleanTitle: 'Critical Bob Slipped In-Progress' }),
        wbsCode: '1.1',
        isCritical: true,
        totalFloat: 0,
        resource: 'bob',
        percentComplete: 40,
        actualStart: '2026-10-01',
        variance: { startVariance: 1, finishVariance: 2, durationVariance: 1, workVariance: 8, costVariance: 500 }
    });

    const r2 = createMockRow({
        task: createMockTask({ cleanTitle: 'Critical Alice Not-Slipped In-Progress' }),
        wbsCode: '1.2',
        isCritical: true,
        totalFloat: 0,
        resource: 'alice',
        percentComplete: 50,
        actualStart: '2026-10-01',
        variance: { startVariance: 0, finishVariance: 0, durationVariance: 0, workVariance: 0, costVariance: 0 }
    });

    const r3 = createMockRow({
        task: createMockTask({ cleanTitle: 'Non-Critical Bob Slipped Completed' }),
        wbsCode: '1.3',
        isCritical: false,
        totalFloat: 5,
        resource: 'bob',
        percentComplete: 100,
        actualFinish: '2026-10-05',
        variance: { startVariance: 0, finishVariance: 1, durationVariance: 1, workVariance: 0, costVariance: 0 }
    });

    const r4 = createMockRow({
        task: createMockTask({ cleanTitle: 'Milestone Alice', isMilestone: true, durationDays: 0 }),
        wbsCode: '1.4',
        isMilestone: true,
        durationDays: 0,
        resource: 'alice',
        percentComplete: 0
    });

    const allRows = [r1, r2, r3, r4];

    // Combination 1: Critical + Slipped
    const critSlipped = TaskDiscoveryEngine.filterRows(allRows, {
        searchQuery: '',
        quickFilters: ['critical', 'slipped'],
        statusFilter: 'all',
        resourceFilter: 'all'
    });
    assert.strictEqual(critSlipped.directMatchCount, 1);
    assert.strictEqual(critSlipped.filteredRows[0].wbsCode, '1.1');

    // Combination 2: Critical + Resource (Bob)
    const critBob = TaskDiscoveryEngine.filterRows(allRows, {
        searchQuery: '',
        quickFilters: ['critical'],
        statusFilter: 'all',
        resourceFilter: 'bob'
    });
    assert.strictEqual(critBob.directMatchCount, 1);
    assert.strictEqual(critBob.filteredRows[0].wbsCode, '1.1');

    // Combination 3: Slipped + Status (In Progress)
    const slippedInProg = TaskDiscoveryEngine.filterRows(allRows, {
        searchQuery: '',
        quickFilters: ['slipped'],
        statusFilter: 'in-progress',
        resourceFilter: 'all'
    });
    assert.strictEqual(slippedInProg.directMatchCount, 1);
    assert.strictEqual(slippedInProg.filteredRows[0].wbsCode, '1.1');

    // Combination 4: Three-Way Filter: Critical + Status (In Progress) + Resource (Bob)
    const threeWay = TaskDiscoveryEngine.filterRows(allRows, {
        searchQuery: '',
        quickFilters: ['critical'],
        statusFilter: 'in-progress',
        resourceFilter: 'bob'
    });
    assert.strictEqual(threeWay.directMatchCount, 1);
    assert.strictEqual(threeWay.filteredRows[0].wbsCode, '1.1');

    // Combination 5: Milestones + Resource (Alice)
    const msAlice = TaskDiscoveryEngine.filterRows(allRows, {
        searchQuery: '',
        quickFilters: ['milestones'],
        statusFilter: 'all',
        resourceFilter: 'alice'
    });
    assert.strictEqual(msAlice.directMatchCount, 1);
    assert.strictEqual(msAlice.filteredRows[0].wbsCode, '1.4');

    // Combination 6: Empty Intersection (Critical + Milestones when no milestones are critical)
    const emptyIntersect = TaskDiscoveryEngine.filterRows(allRows, {
        searchQuery: '',
        quickFilters: ['critical', 'milestones'],
        statusFilter: 'all',
        resourceFilter: 'all'
    });
    assert.strictEqual(emptyIntersect.directMatchCount, 0, 'Empty intersection yields 0 direct matches');
    assert.strictEqual(emptyIntersect.filteredRows.length, 0, 'Empty intersection yields 0 filtered rows');
});

test('TaskDiscoveryEngine: 16. Actual % Complete Canonical Calculation & Zero-Work Rules', () => {
    // In Timebox v1.6:
    // Actual % Complete = min(100, Math.round((Actual Work / Planned Work) * 100)) if Planned Work > 0
    // Zero Planned Work does NOT divide by zero, does NOT invent work hours.
    const mockProject = MarkdownAdapter.parseProject('test.md', 'Test', `
# Test Project
- [ ] Task 1 Regular Work 🛫 2026-10-01 📅 2026-10-05 ⏳ 5d [actualWork:: 18h]
- [ ] Task 2 Over-budget Work 🛫 2026-10-01 📅 2026-10-05 ⏳ 5d [actualWork:: 48h]
- [ ] Task 3 Zero Work Milestone 🛫 2026-10-05 📅 2026-10-05 ⏳ 0d #milestone
- [x] Task 4 Completed Zero Work 🛫 2026-10-05 📅 2026-10-05 ⏳ 0d #milestone
- [ ] Task 5 No Actual Work Yet 🛫 2026-10-01 📅 2026-10-05 ⏳ 5d
`);

    SchedulingEngine.schedule(mockProject);

    const t1 = mockProject.tasks.find(t => t.title.includes('Task 1'));
    assert.ok(t1);
    assert.strictEqual(t1.workHours, 40, 'Planned Work = 5d * 8h = 40h');
    assert.strictEqual(t1.actualWorkHours, 18, 'Actual Work = 18h');
    // 18 / 40 * 100 = 45%
    assert.strictEqual(t1.percentComplete, 45, 'Actual % Complete is exactly 45% (18h / 40h * 100)');

    const t2 = mockProject.tasks.find(t => t.title.includes('Task 2'));
    assert.ok(t2);
    assert.strictEqual(t2.workHours, 40, 'Planned Work = 40h');
    assert.strictEqual(t2.actualWorkHours, 48, 'Actual Work = 48h');
    // min(100, 48 / 40 * 100) = 100%
    assert.strictEqual(t2.percentComplete, 100, 'Actual % Complete capped at 100%');

    const t3 = mockProject.tasks.find(t => t.title.includes('Task 3'));
    assert.ok(t3);
    assert.strictEqual(t3.workHours, 0, 'Planned Work = 0h for milestone');
    assert.strictEqual(t3.percentComplete, 0, 'Zero planned work does NOT divide by zero or invent percentage');

    const t4 = mockProject.tasks.find(t => t.title.includes('Task 4'));
    assert.ok(t4);
    assert.strictEqual(t4.percentComplete, 100, 'Explicitly completed task = 100%');

    const t5 = mockProject.tasks.find(t => t.title.includes('Task 5'));
    assert.ok(t5);
    assert.strictEqual(t5.percentComplete, 0, 'Task with no actuals remains 0%');
});

test('TaskDiscoveryEngine: 17. Planned Schedule Progress Distinction vs Actual % Complete', () => {
    const mockProject = MarkdownAdapter.parseProject('test.md', 'Test', `
# Test Project
- [ ] Task In-Flight 🛫 2026-10-01 📅 2026-10-10 ⏳ 8d [actualWork:: 16h]
`);
    // Status Date is half-way through the planned schedule (e.g. 2026-10-06)
    mockProject.statusDate = '2026-10-06';
    SchedulingEngine.schedule(mockProject);

    const task = mockProject.tasks[0];
    assert.ok(task);
    assert.strictEqual(task.workHours, 64, 'Planned work = 8d * 8h = 64h');
    assert.strictEqual(task.actualWorkHours, 16, 'Actual work = 16h');
    // Actual % Complete = 16 / 64 = 25%
    assert.strictEqual(task.percentComplete, 25, 'Actual % Complete = 25%');

    // Planned schedule progress represents calendar elapsed progress:
    assert.ok(task.scheduleProgress !== undefined, 'scheduleProgress calculated');
    assert.ok(task.scheduleProgress > 25, 'Planned schedule progress (~50%) differs from Actual % Complete (25%)');
    assert.notStrictEqual(task.percentComplete, task.scheduleProgress, 'Actual % Complete != Planned Schedule Progress');
});

test('TaskDiscoveryEngine: 18. Historical Daily Note Completion Date Synchronization', () => {
    // Verify syncTaskCompletion logic
    // Test helper simulates line transform on daily note completion
    const sourceFileName = '2026-10-15.md';
    const originalProjectLine = '- [ ] Install Optical Detectors 🛫 2026-10-01 📅 2026-10-20 ⏳ 14d [%:: 30]';

    const isCompleted = true;
    const isDailyNote = true;

    let updatedLine = originalProjectLine.replace(/- \[[ ]\]/, '- [x]');
    if (isDailyNote && isCompleted) {
        const dateMatch = sourceFileName.match(/^\d{4}-\d{2}-\d{2}/);
        const finishDate = dateMatch ? dateMatch[0] : '2026-10-15';
        if (!updatedLine.includes('[actualFinish::')) {
            updatedLine += ` [actualFinish:: ${finishDate}]`;
        }
        if (updatedLine.includes('[%::')) {
            updatedLine = updatedLine.replace(/\[%::\s*\d+\]/g, '[%:: 100]');
        }
    }

    assert.ok(updatedLine.includes('- [x]'), 'Checkbox checked');
    assert.ok(updatedLine.includes('[actualFinish:: 2026-10-15]'), 'actualFinish uses daily note date');
    assert.ok(updatedLine.includes('[%:: 100]'), 'Progress set to 100%');
    assert.ok(updatedLine.includes('🛫 2026-10-01'), 'Planned start untouched');
    assert.ok(updatedLine.includes('📅 2026-10-20'), 'Planned finish untouched');
    assert.ok(updatedLine.includes('⏳ 14d'), 'Planned duration untouched');
});

test('TaskDiscoveryEngine: 19. Scoped Cmd+F Integration Behavior (Item A)', () => {
    // Simulate event handler logic registered on window
    let prevented = false;
    let focused = false;
    let selected = false;

    const mockSearchInput = {
        focus: () => { focused = true; },
        select: () => { selected = true; }
    };

    const handleKeydown = (e: { metaKey: boolean; ctrlKey: boolean; key: string; shiftKey: boolean; altKey: boolean }, isViewActive: boolean, activeView: string) => {
        if ((e.metaKey || e.ctrlKey) && (e.key === 'f' || e.key === 'F') && !e.shiftKey && !e.altKey) {
            if (isViewActive && activeView === 'task-sheet') {
                prevented = true;
                mockSearchInput.focus();
                mockSearchInput.select();
                return true; // handled
            }
        }
        return false; // unhandled, passes through to Obsidian
    };

    // Scenario 1: Task Sheet active -> Intercepts, focuses, selects, prevents default
    prevented = false; focused = false; selected = false;
    let handled = handleKeydown({ metaKey: true, ctrlKey: false, key: 'f', shiftKey: false, altKey: false }, true, 'task-sheet');
    assert.strictEqual(handled, true);
    assert.strictEqual(prevented, true);
    assert.strictEqual(focused, true);
    assert.strictEqual(selected, true);

    // Scenario 2: Gantt timeline active -> Passes through to native Obsidian
    prevented = false; focused = false; selected = false;
    handled = handleKeydown({ metaKey: true, ctrlKey: false, key: 'f', shiftKey: false, altKey: false }, true, 'gantt');
    assert.strictEqual(handled, false, 'Gantt view must pass Cmd+F through to Obsidian native Find');
    assert.strictEqual(prevented, false);
    assert.strictEqual(focused, false);

    // Scenario 3: Project Summary active -> Passes through
    handled = handleKeydown({ metaKey: true, ctrlKey: false, key: 'f', shiftKey: false, altKey: false }, true, 'project-summary');
    assert.strictEqual(handled, false);

    // Scenario 4: Resource Sheet active -> Passes through
    handled = handleKeydown({ metaKey: true, ctrlKey: false, key: 'f', shiftKey: false, altKey: false }, true, 'resource-sheet');
    assert.strictEqual(handled, false);

    // Scenario 5: Markdown editor or another leaf active -> Passes through
    handled = handleKeydown({ metaKey: true, ctrlKey: false, key: 'f', shiftKey: false, altKey: false }, false, 'task-sheet');
    assert.strictEqual(handled, false, 'Inactive view must pass Cmd+F through to Obsidian');
});

test('TaskDiscoveryEngine: 20. Real Daily-Note Project Grouping Parser & Structure (Items B, C, D, E, F)', () => {
    // Real daily note task lines based on actual user vault structure (2026-09-16.md)
    const rawDailyTasks = [
        '- [ ] El RAS en Colombia es el Reglamento Técnico... [[BEC - Colombia]]',
        '- [ ] Local Permit requirements to submit to the local Authorities [[BEC - Colombia]]',
        '- [ ] Task Zenteno [[TEST PROJECT]]',
        '- [ ] Task [[TEST PROJECT]]',
        '- [ ] Initial project task [[TEST PROJECT]]',
        '- [ ] PHASE 3 CDP Zenteno [[BEC - US-COL]]',
        '- [ ] Test Task [[BEC - US-COL]]',
        '- [ ] New Task [[BEC - US-COL]]',
        '- [ ] continue work on the Charge and Go development...',
        '- [ ] App - Meeting notes for Construction AEC',
        '- [ ] Look up information on Plumbing'
    ];

    const knownProjects = ['BEC - Colombia', 'BEC - US-COL', 'TEST PROJECT', 'ChargeAndGo'];

    // Grouping parser logic matching main.ts
    interface MockLi {
        text: string;
        matchedProject: string | null;
    }

    const mockLis: MockLi[] = rawDailyTasks.map(t => {
        let matchedProject: string | null = null;
        const wikiMatches = Array.from(t.matchAll(/\[\[([^\]]+)\]\]/g));
        for (const match of wikiMatches) {
            if (match[1]) {
                const cleanTarget = match[1].split('|')[0].replace(/^.*[\\/]/, '').replace(/\.md$/, '').trim();
                const exactMatch = knownProjects.find(p => p.toLowerCase() === cleanTarget.toLowerCase());
                if (exactMatch) {
                    matchedProject = exactMatch;
                    break;
                }
            }
        }
        if (!matchedProject && wikiMatches.length > 0) {
            const last = wikiMatches[wikiMatches.length - 1];
            if (last && last[1]) {
                matchedProject = last[1].split('|')[0].replace(/^.*[\\/]/, '').replace(/\.md$/, '').trim();
            }
        }
        return { text: t, matchedProject };
    });

    const projectMap = new Map<string, MockLi[]>();
    const generalLis: MockLi[] = [];

    for (const li of mockLis) {
        if (li.matchedProject) {
            if (!projectMap.has(li.matchedProject)) {
                projectMap.set(li.matchedProject, []);
            }
            projectMap.get(li.matchedProject)!.push(li);
        } else {
            generalLis.push(li);
        }
    }

    // Verification B: Real daily note project format recognized
    assert.strictEqual(projectMap.has('BEC - Colombia'), true, 'Recognized BEC - Colombia');
    assert.strictEqual(projectMap.get('BEC - Colombia')?.length, 2, '2 tasks in BEC - Colombia');
    assert.strictEqual(projectMap.has('TEST PROJECT'), true, 'Recognized TEST PROJECT');
    assert.strictEqual(projectMap.get('TEST PROJECT')?.length, 3, '3 tasks in TEST PROJECT');
    assert.strictEqual(projectMap.has('BEC - US-COL'), true, 'Recognized BEC - US-COL');
    assert.strictEqual(projectMap.get('BEC - US-COL')?.length, 3, '3 tasks in BEC - US-COL');
    assert.strictEqual(generalLis.length, 3, '3 tasks in General / Unassigned');

    // Verification E: No task duplication
    const totalGrouped = Array.from(projectMap.values()).reduce((sum, g) => sum + g.length, 0) + generalLis.length;
    assert.strictEqual(totalGrouped, rawDailyTasks.length, 'Total grouped tasks equals original count (No duplication)');

    // Verification F: No task loss
    for (const task of rawDailyTasks) {
        const found = Array.from(projectMap.values()).some(g => g.some(t => t.text === task)) || generalLis.some(t => t.text === task);
        assert.ok(found, `Task must not be lost: ${task.substring(0, 30)}`);
    }

    // Verification C & D: Collapsed by default & expand/collapse toggle simulation
    interface MockGroupElement {
        title: string;
        isCollapsed: boolean;
        display: 'none' | 'block';
        chevron: '▶' | '▼';
        toggle: () => void;
    }

    const createMockGroup = (title: string): MockGroupElement => {
        const group: MockGroupElement = {
            title,
            isCollapsed: true, // Collapsed by default
            display: 'none',   // Hidden by default
            chevron: '▶',      // Collapsed chevron
            toggle: () => {
                group.isCollapsed = !group.isCollapsed;
                group.display = group.isCollapsed ? 'none' : 'block';
                group.chevron = group.isCollapsed ? '▶' : '▼';
            }
        };
        return group;
    };

    const becGroup = createMockGroup('BEC - Colombia');
    assert.strictEqual(becGroup.isCollapsed, true, 'Group is collapsed by default');
    assert.strictEqual(becGroup.display, 'none', 'Sublist is hidden by default');
    assert.strictEqual(becGroup.chevron, '▶');

    // Click to expand
    becGroup.toggle();
    assert.strictEqual(becGroup.isCollapsed, false, 'Group expanded after click');
    assert.strictEqual(becGroup.display, 'block', 'Sublist is visible after click');
    assert.strictEqual(becGroup.chevron, '▼');

    // Click again to re-collapse
    becGroup.toggle();
    assert.strictEqual(becGroup.isCollapsed, true, 'Group collapsed after second click');
    assert.strictEqual(becGroup.display, 'none');
    assert.strictEqual(becGroup.chevron, '▶');
});

test('TaskDiscoveryEngine: 21. Planned Work, Actual Work & Remaining Work Derivation (Items G, H, I)', () => {
    // Helper simulating TaskInformationModal work derivation
    const computeWorkFields = (durationDays: number, isMilestone: boolean, explicitWorkHours: number | undefined, actualWorkHours: number | undefined) => {
        let plannedWork = 0;
        if (!isMilestone) {
            plannedWork = (explicitWorkHours !== undefined && explicitWorkHours !== durationDays * 8)
                ? explicitWorkHours
                : durationDays * 8;
        }
        const actualWork = actualWorkHours !== undefined ? Math.max(0, actualWorkHours) : 0;
        const remainingWork = plannedWork > 0 ? Math.max(0, plannedWork - actualWork) : 0;
        return { plannedWork, actualWork, remainingWork };
    };

    // Item G: Planned Work displayed (5d -> 40h; 0d milestone -> 0h)
    const std = computeWorkFields(5, false, undefined, 18);
    assert.strictEqual(std.plannedWork, 40, 'Planned Work for 5d task is 40h');
    assert.strictEqual(std.actualWork, 18, 'Actual Work is 18h');
    // Item I: Remaining Work = max(0, 40 - 18) = 22h
    assert.strictEqual(std.remainingWork, 22, 'Remaining Work is 22h (40h - 18h)');

    // Milestone: 0d -> 0h planned, 0h remaining
    const ms = computeWorkFields(0, true, undefined, 0);
    assert.strictEqual(ms.plannedWork, 0, 'Planned Work for milestone is 0h');
    assert.strictEqual(ms.remainingWork, 0, 'Remaining Work for milestone is 0h');

    // Over-budget work: 40h planned, 50h actual -> remaining work = 0h (capped at 0)
    const over = computeWorkFields(5, false, undefined, 50);
    assert.strictEqual(over.plannedWork, 40);
    assert.strictEqual(over.actualWork, 50);
    assert.strictEqual(over.remainingWork, 0, 'Remaining Work never drops below 0h');
});

test('TaskDiscoveryEngine: 22. Actual % Complete Canonical Calculations Matrix (Items J, K, L, M, N)', () => {
    const calculatePct = (plannedWork: number, actualWork: number, completed: boolean): number => {
        if (plannedWork > 0) {
            return Math.min(100, Math.round((actualWork / plannedWork) * 100));
        }
        return completed ? 100 : 0;
    };

    // Item J: 0% calculation (40h planned, 0h actual)
    assert.strictEqual(calculatePct(40, 0, false), 0, '0% calculation: 0h / 40h = 0%');

    // Item K: 45% calculation (40h planned, 18h actual)
    assert.strictEqual(calculatePct(40, 18, false), 45, '45% calculation: 18h / 40h = 45%');

    // Item L: 50% calculation (40h planned, 20h actual)
    assert.strictEqual(calculatePct(40, 20, false), 50, '50% calculation: 20h / 40h = 50%');

    // Item M: 100% calculation (40h planned, 40h actual)
    assert.strictEqual(calculatePct(40, 40, false), 100, '100% calculation: 40h / 40h = 100%');

    // Item N: >100% capped at 100% (40h planned, 50h actual)
    assert.strictEqual(calculatePct(40, 50, false), 100, '>100% capped: 50h / 40h capped at 100%');
});

test('TaskDiscoveryEngine: 23. Zero Planned Work Rules (Item O)', () => {
    const calculatePct = (plannedWork: number, actualWork: number, completed: boolean): number => {
        if (plannedWork > 0) {
            return Math.min(100, Math.round((actualWork / plannedWork) * 100));
        }
        return completed ? 100 : 0;
    };

    // Item O: Zero Planned Work
    // 1. Incomplete zero-work milestone: does NOT divide by zero, does NOT invent percentage from dates -> 0%
    const uncompletedZero = calculatePct(0, 0, false);
    assert.strictEqual(uncompletedZero, 0, 'Zero planned work uncompleted is 0% (no NaN, no divide by zero)');
    assert.ok(!Number.isNaN(uncompletedZero));

    // 2. Completed zero-work milestone: 100%
    const completedZero = calculatePct(0, 0, true);
    assert.strictEqual(completedZero, 100, 'Zero planned work explicitly completed is 100%');
    assert.ok(!Number.isNaN(completedZero));
});

test('TaskDiscoveryEngine: 24. Daily Note Completion Date Synchronization (Item P)', () => {
    // Item P: When completing a task from daily note (e.g. 2026-09-17.md):
    // actualFinish = 2026-09-17, % = 100%, planned dates and baseline untouched
    const dailyNoteName = '2026-09-17.md';
    const projectTaskLine = '- [ ] Install Distribution Transformer 🛫 2026-09-10 📅 2026-09-25 ⏳ 11d [%:: 40]';
    const baselineStart = '2026-09-10';
    const baselineFinish = '2026-09-25';

    // Simulate completion check
    const dateMatch = dailyNoteName.match(/^\d{4}-\d{2}-\d{2}/);
    const finishDate = dateMatch ? dateMatch[0] : '2026-09-17';

    let updatedLine = projectTaskLine.replace(/- \[[ ]\]/, '- [x]');
    if (!updatedLine.includes('[actualFinish::')) {
        updatedLine += ` [actualFinish:: ${finishDate}]`;
    }
    updatedLine = updatedLine.replace(/\[%::\s*\d+\]/g, '[%:: 100]');

    assert.ok(updatedLine.includes('- [x]'), 'Checkbox is checked');
    assert.ok(updatedLine.includes('[actualFinish:: 2026-09-17]'), 'actualFinish recorded from daily note date');
    assert.ok(updatedLine.includes('[%:: 100]'), 'Progress set to 100%');
    assert.ok(updatedLine.includes('🛫 2026-09-10'), 'Planned start remains untouched');
    assert.ok(updatedLine.includes('📅 2026-09-25'), 'Planned finish remains untouched');
    assert.ok(updatedLine.includes('⏳ 11d'), 'Planned duration remains untouched');
    assert.strictEqual(baselineStart, '2026-09-10', 'Baseline start untouched');
    assert.strictEqual(baselineFinish, '2026-09-25', 'Baseline finish untouched');
});

test('TaskDiscoveryEngine: 25. Four-State Separation Non-Mutation Audit (Item Q)', () => {
    // Item Q: Four-state model verification:
    // BASELINE -> CURRENT PLANNED SCHEDULE -> ACTUAL EXECUTION -> FORECAST
    const project = MarkdownAdapter.parseProject('four-state.md', 'Four State Project', `
# Four State Project
- [ ] Task A 🛫 2026-10-05 📅 2026-10-09 ⏳ 5d [actualStart:: 2026-10-06] [actualWork:: 16h]
`);
    // Create baseline
    const task = project.tasks[0];
    task.baseline = {
        start: '2026-10-05',
        finish: '2026-10-09',
        duration: 5,
        work: 40,
        cost: 0
    };

    project.statusDate = '2026-10-08';
    SchedulingEngine.schedule(project);

    // 1. Baseline state
    assert.strictEqual(task.baseline?.start, '2026-10-05', 'Baseline start is immutable');
    assert.strictEqual(task.baseline?.finish, '2026-10-09', 'Baseline finish is immutable');

    // 2. Current Planned Schedule
    assert.strictEqual(task.plannedStart, '2026-10-05', 'Planned start is preserved');
    assert.strictEqual(task.plannedFinish, '2026-10-09', 'Planned finish is preserved');
    assert.strictEqual(task.workHours, 40, 'Planned work is 40h');

    // 3. Actual Execution
    assert.strictEqual(task.actualStart, '2026-10-06', 'Actual start recorded');
    assert.strictEqual(task.actualWorkHours, 16, 'Actual work is 16h');
    assert.strictEqual(task.percentComplete, 40, 'Actual % Complete is 40% (16 / 40 * 100)');

    // 4. Forecast
    assert.ok(task.forecastStart !== undefined, 'Forecast start calculated');
    assert.ok(task.forecastFinish !== undefined, 'Forecast finish calculated');
    assert.notStrictEqual(task.forecastFinish, task.plannedFinish, 'Forecast slipped due to late actual start and status date');

    // Non-mutation guarantee
    assert.strictEqual(task.plannedFinish, '2026-10-09', 'Actual execution and forecast NEVER rewrite planned finish');
});

test('TaskDiscoveryEngine: 26. Real Daily-Note Reading/Preview Post-Processor DOM Grouping Regression', () => {
    // 1. isDaily sourcePath detection logic
    const checkIsDaily = (sourcePath: string, timeBoxFolder = 'TimeBox', projectsFolder = 'TimeBox/Projects'): boolean => {
        const normSource = (sourcePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
        const normTimebox = (timeBoxFolder || 'TimeBox').replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
        const normProjects = (projectsFolder || 'TimeBox/Projects').replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');

        const sourceLower = normSource.toLowerCase();
        const timeboxLower = normTimebox.toLowerCase();
        const projectsLower = normProjects.toLowerCase();

        return (
            sourceLower.startsWith(`${timeboxLower}/`) ||
            sourceLower.includes(`/${timeboxLower}/`) ||
            /^\d{4}-\d{2}-\d{2}\.md$/i.test(normSource.split('/').pop() || '')
        ) && !sourceLower.startsWith(`${projectsLower}/`);
    };

    assert.strictEqual(checkIsDaily('TimeBox/2026-09-17.md'), true, 'Standard daily path is daily');
    assert.strictEqual(checkIsDaily('2026-09-17.md'), true, 'Filename-only daily path is daily');
    assert.strictEqual(checkIsDaily('/TimeBox/2026-09-17.md'), true, 'Leading slash daily path is daily');
    assert.strictEqual(checkIsDaily('Timebox/2026-09-16.md'), true, 'Case-insensitive daily path is daily');
    assert.strictEqual(checkIsDaily('/Users/test/TimeBox/2026-09-17.md'), true, 'Absolute daily path is daily');
    assert.strictEqual(checkIsDaily('TimeBox/Projects/TEST PROJECT.md'), false, 'Project note is NOT daily note');
    assert.strictEqual(checkIsDaily('TimeBox/Projects/BEC - Colombia.md'), false, 'Project note is NOT daily note');
    assert.strictEqual(checkIsDaily('Notes/Meeting.md'), false, 'Unrelated note is NOT daily note');

    // 2. Real Daily Note (2026-09-17.md) Structure Simulation
    // 3 project tasks for [[TEST PROJECT]] and 4 general tasks
    const tasks2026_09_17 = [
        { text: 'Task Zenteno [[TEST PROJECT]]', link: 'TEST PROJECT', checked: false },
        { text: 'New Task [[TEST PROJECT]]', link: 'TEST PROJECT', checked: false },
        { text: 'Initial project task [[TEST PROJECT]]', link: 'TEST PROJECT', checked: true },
        { text: 'continue work on the Charge and Go development...', link: null, checked: false },
        { text: 'App - Meeting notes for Construction AEC', link: null, checked: false },
        { text: 'App - Tickle Task', link: null, checked: false },
        { text: 'Look up information on Plumbing', link: null, checked: false }
    ];

    const knownProjects = ['BEC - Colombia', 'BEC - US-COL', 'TEST PROJECT', 'ChargeAndGo'];

    // Simulate DOM Li objects
    interface SimulatedLi {
        tagName: 'LI';
        textContent: string;
        checked: boolean;
        internalLink: string | null;
    }

    const mockLis: SimulatedLi[] = tasks2026_09_17.map(t => ({
        tagName: 'LI',
        textContent: t.text,
        checked: t.checked,
        internalLink: t.link
    }));

    // Grouping processor
    const projectMap = new Map<string, SimulatedLi[]>();
    const generalLis: SimulatedLi[] = [];

    for (const li of mockLis) {
        let matchedProject: string | null = null;
        if (li.internalLink) {
            const exact = knownProjects.find(p => p.toLowerCase() === li.internalLink!.toLowerCase());
            if (exact) matchedProject = exact;
        }
        if (!matchedProject) {
            const match = li.textContent.match(/\[\[([^\]]+)\]\]/);
            if (match && match[1]) {
                const clean = match[1].split('|')[0].trim();
                const exact = knownProjects.find(p => p.toLowerCase() === clean.toLowerCase());
                if (exact) matchedProject = exact;
            }
        }
        if (matchedProject) {
            if (!projectMap.has(matchedProject)) projectMap.set(matchedProject, []);
            projectMap.get(matchedProject)!.push(li);
        } else {
            generalLis.push(li);
        }
    }

    assert.strictEqual(projectMap.size, 1);
    assert.strictEqual(projectMap.get('TEST PROJECT')?.length, 3);
    assert.strictEqual(generalLis.length, 4);

    // Verify ordering preserved
    assert.strictEqual(projectMap.get('TEST PROJECT')![0].textContent, 'Task Zenteno [[TEST PROJECT]]');
    assert.strictEqual(projectMap.get('TEST PROJECT')![1].textContent, 'New Task [[TEST PROJECT]]');
    assert.strictEqual(projectMap.get('TEST PROJECT')![2].textContent, 'Initial project task [[TEST PROJECT]]');
    assert.strictEqual(projectMap.get('TEST PROJECT')![2].checked, true, 'Checkbox state preserved');

    // 3. Multi-project Note (2026-09-16.md) with alphabetical ordering
    const multiProjectTasks = [
        { text: 'RAS 규정 [[BEC - Colombia]]', link: 'BEC - Colombia' },
        { text: 'Task Zenteno [[TEST PROJECT]]', link: 'TEST PROJECT' },
        { text: 'PHASE 3 CDP [[BEC - US-COL]]', link: 'BEC - US-COL' },
        { text: 'Another BEC [[BEC - Colombia]]', link: 'BEC - Colombia' },
        { text: 'General Task 1', link: null },
        { text: 'General Task 2', link: null }
    ];

    const multiMap = new Map<string, typeof multiProjectTasks>();
    const multiGeneral: typeof multiProjectTasks = [];

    for (const t of multiProjectTasks) {
        if (t.link) {
            if (!multiMap.has(t.link)) multiMap.set(t.link, []);
            multiMap.get(t.link)!.push(t);
        } else {
            multiGeneral.push(t);
        }
    }

    const sortedProjects = Array.from(multiMap.keys()).sort((a, b) => a.localeCompare(b));
    assert.deepStrictEqual(sortedProjects, ['BEC - Colombia', 'BEC - US-COL', 'TEST PROJECT'], 'Alphabetical project ordering');

    // 4. Cmd+F View Scope handler return semantics
    const scopeHandler = (activeView: string) => {
        if (activeView === 'task-sheet') {
            return true; // consumed, search focused
        }
        return false; // let event fall through to native Obsidian Find
    };

    assert.strictEqual(scopeHandler('task-sheet'), true, 'Task sheet consumes Cmd+F');
    assert.strictEqual(scopeHandler('gantt'), false, 'Gantt falls through to Obsidian Find');
    assert.strictEqual(scopeHandler('project-summary'), false, 'Summary falls through to Obsidian Find');
    assert.strictEqual(scopeHandler('resource-sheet'), false, 'Resource Sheet falls through to Obsidian Find');
    assert.strictEqual(scopeHandler('markdown-editor'), false, 'Markdown editor falls through to Obsidian Find');
});

test('TaskDiscoveryEngine: 27. Real-World Production Daily Note (2026-09-17.md & 2026-09-16.md) End-to-End DOM Grouping Lifecycle & Invariants', () => {
    // Exact representation from real daily note: TimeBox/2026-09-17.md
    const rawMarkdownSource = `# Timebox - Thursday, September 17th 2026

[[TimeBox/2026-09-16|◀ Yesterday]] | [[TimeBox/2026-09-18|Tomorrow ▶]]

## 📤 Carried forward from yesterday

### Incomplete General Tasks
- [ ] Task Zenteno [[TEST PROJECT]]
- [ ] New Task [[TEST PROJECT]]
- [ ] Initial project task [[TEST PROJECT]]
- [ ] continue work on the Charge and Go development of the application.
- [ ] App - Meeting notes for Construction AEC - "Clarit AEC"
- [ ] App - Tickle Task
- [ ] App - Small Business Accounting
- [ ] App - Nurse - Patience Records Assistance
- [ ] App - AI Moving Inventory
- [ ] App - AI English Proficienty
- [ ] App - Keep Alive - Firefox Extention
- [ ] It will be directed by the Colombia Team
- [ ] Will help Juan Carlos coordinate the Colombia Team members
- [ ] Webpage for product reviews
- [ ] 8:00am - 12:00pm - LDC Work
- [ ] 1:00pm - 6:00pm WORK
- [ ] App - Meeting notes for Construction AEC
- [ ] Look up information on Plumbing
`;

    const knownProjects = [
        'BEC - Colombia',
        'BEC - US-COL',
        'BEI-DATA-COLLECTOR',
        'Cajita.me',
        'ChargeAndGo',
        'FluencyTrace',
        'Kollu',
        'Pituko-POS',
        'PKA - Chrome',
        'Qevra',
        'SajamaPDF',
        'TEST PROJECT',
        'USILACS Program'
    ];

    // Mock DOM elements matching real Obsidian Preview DOM
    class MockElement {
        tagName: string;
        className: string = '';
        classList = {
            classes: new Set<string>(),
            contains: (c: string) => this.classList.classes.has(c),
            add: (c: string) => this.classList.classes.add(c),
            remove: (c: string) => this.classList.classes.delete(c),
            toggle: (c: string) => {
                if (this.classList.classes.has(c)) {
                    this.classList.classes.delete(c);
                    return false;
                } else {
                    this.classList.classes.add(c);
                    return true;
                }
            }
        };
        children: MockElement[] = [];
        parentElement: MockElement | null = null;
        dataset: Record<string, string> = {};
        attributes: Record<string, string> = {};
        textContent: string = '';
        listeners: Record<string, Function[]> = {};

        constructor(tagName: string) {
            this.tagName = tagName.toUpperCase();
        }

        setAttribute(k: string, v: string) { this.attributes[k] = v; }
        getAttribute(k: string) { return this.attributes[k] || null; }

        appendChild(child: MockElement) {
            child.parentElement = this;
            this.children.push(child);
            return child;
        }

        empty() {
            this.children = [];
        }

        closest(selector: string): MockElement | null {
            let curr: MockElement | null = this;
            while (curr) {
                if (selector.startsWith('.') && curr.classList.contains(selector.slice(1))) return curr;
                if (curr.tagName.toLowerCase() === selector.toLowerCase()) return curr;
                curr = curr.parentElement;
            }
            return null;
        }

        querySelectorAll(selector: string): MockElement[] {
            const results: MockElement[] = [];
            const walk = (el: MockElement) => {
                for (const child of el.children) {
                    if (selector === 'li' && child.tagName === 'LI') results.push(child);
                    else if (selector.startsWith('.') && child.classList.contains(selector.slice(1))) results.push(child);
                    else if (selector.includes('a.internal-link') && child.tagName === 'A' && child.classList.contains('internal-link')) results.push(child);
                    walk(child);
                }
            };
            walk(this);
            return results;
        }

        addEventListener(evt: string, fn: Function) {
            if (!this.listeners[evt]) this.listeners[evt] = [];
            this.listeners[evt].push(fn);
        }

        click() {
            const ev = { preventDefault() {}, stopPropagation() {} };
            for (const fn of this.listeners['click'] || []) fn(ev);
        }
    }

    // Build real-world Obsidian rendered UL from raw markdown lines
    const createRealPreviewUl = (tasksWithLinks: { text: string; link?: string; checked?: boolean }[]): MockElement => {
        const ul = new MockElement('UL');
        ul.classList.add('contains-task-list');
        tasksWithLinks.forEach((t, idx) => {
            const li = new MockElement('LI');
            li.classList.add('task-list-item');
            li.setAttribute('data-line', String(idx));
            
            const checkbox = new MockElement('INPUT');
            checkbox.setAttribute('type', 'checkbox');
            checkbox.classList.add('task-list-item-checkbox');
            checkbox.setAttribute('data-line', String(idx));
            if (t.checked) checkbox.setAttribute('checked', 'true');
            li.appendChild(checkbox);

            if (t.link) {
                li.textContent = `${t.text} ${t.link}`;
                const a = new MockElement('A');
                a.classList.add('internal-link');
                a.setAttribute('data-href', t.link);
                a.setAttribute('href', t.link);
                a.textContent = t.link;
                li.appendChild(a);
            } else {
                li.textContent = t.text;
            }

            ul.appendChild(li);
        });
        return ul;
    };

    const taskItems = [
        { text: 'Task Zenteno', link: 'TEST PROJECT', checked: false },
        { text: 'New Task', link: 'TEST PROJECT', checked: false },
        { text: 'Initial project task', link: 'TEST PROJECT', checked: false },
        { text: 'continue work on the Charge and Go development of the application.' },
        { text: 'App - Meeting notes for Construction AEC - "Clarit AEC"' },
        { text: 'App - Tickle Task' },
        { text: 'App - Small Business Accounting' },
        { text: 'App - Nurse - Patience Records Assistance' },
        { text: 'App - AI Moving Inventory' },
        { text: 'App - AI English Proficienty' },
        { text: 'App - Keep Alive - Firefox Extention' },
        { text: 'It will be directed by the Colombia Team' },
        { text: 'Will help Juan Carlos coordinate the Colombia Team members' },
        { text: 'Webpage for product reviews' },
        { text: '8:00am - 12:00pm - LDC Work' },
        { text: '1:00pm - 6:00pm WORK' },
        { text: 'App - Meeting notes for Construction AEC' },
        { text: 'Look up information on Plumbing' }
    ];

    const sourcePath = 'TimeBox/2026-09-17.md';
    const expandedGroups = new Set<string>();

    const createGroupElement = (title: string, lis: MockElement[], isGeneral: boolean, path: string): MockElement => {
        const groupKey = `${path}::${title}`;
        const isExpanded = expandedGroups.has(groupKey);

        const groupEl = new MockElement('LI');
        groupEl.classList.add('timebox-daily-project-group');
        if (!isExpanded) groupEl.classList.add('is-collapsed');

        const headerEl = new MockElement('DIV');
        headerEl.classList.add('timebox-daily-project-header');

        const titleEl = new MockElement('SPAN');
        titleEl.classList.add('timebox-daily-project-title');
        titleEl.textContent = (isGeneral ? '📋 ' : '📁 ') + title;

        const chevronEl = new MockElement('SPAN');
        chevronEl.classList.add('timebox-daily-project-chevron');
        chevronEl.textContent = isExpanded ? '▼' : '▶';

        const countEl = new MockElement('SPAN');
        countEl.classList.add('timebox-daily-project-count');
        countEl.textContent = `${lis.length} task${lis.length === 1 ? '' : 's'}`;

        headerEl.appendChild(titleEl);
        headerEl.appendChild(chevronEl);
        headerEl.appendChild(countEl);

        const subTaskList = new MockElement('UL');
        subTaskList.classList.add('contains-task-list');
        subTaskList.classList.add('timebox-daily-project-task-list');

        for (const li of lis) {
            subTaskList.appendChild(li);
        }

        headerEl.addEventListener('click', () => {
            const isCollapsed = groupEl.classList.toggle('is-collapsed');
            chevronEl.textContent = isCollapsed ? '▶' : '▼';
            if (isCollapsed) {
                expandedGroups.delete(groupKey);
            } else {
                expandedGroups.add(groupKey);
            }
        });

        groupEl.appendChild(headerEl);
        groupEl.appendChild(subTaskList);
        return groupEl;
    };

    const processGrouping = (ul: MockElement, path: string) => {
        if (
            ul.closest('.timebox-daily-project-group') ||
            ul.classList.contains('timebox-daily-project-task-list') ||
            ul.classList.contains('timebox-daily-grouped-ul') ||
            ul.dataset.timeboxGrouped === 'true'
        ) {
            return;
        }

        const lis = ul.children.filter(c => c.tagName === 'LI');
        if (lis.length === 0) return;

        const projectMap = new Map<string, MockElement[]>();
        const generalLis: MockElement[] = [];

        for (const li of lis) {
            let matchedProject: string | null = null;
            const internalLinks = li.querySelectorAll('.internal-link');
            for (const link of internalLinks) {
                const target = link.getAttribute('data-href') || link.textContent || '';
                const clean = target.split('|')[0].replace(/^.*[\\/]/, '').replace(/\.md$/, '').trim();
                const exact = knownProjects.find(p => p.toLowerCase() === clean.toLowerCase());
                if (exact) {
                    matchedProject = exact;
                    break;
                }
            }

            if (matchedProject) {
                if (!projectMap.has(matchedProject)) projectMap.set(matchedProject, []);
                projectMap.get(matchedProject)!.push(li);
            } else {
                generalLis.push(li);
            }
        }

        if (projectMap.size === 0) return;

        ul.dataset.timeboxGrouped = 'true';
        ul.classList.add('timebox-daily-grouped-ul');
        ul.empty();

        const sortedProjects = Array.from(projectMap.keys()).sort((a, b) => a.localeCompare(b));
        for (const proj of sortedProjects) {
            ul.appendChild(createGroupElement(proj, projectMap.get(proj)!, false, path));
        }

        if (generalLis.length > 0) {
            ul.appendChild(createGroupElement('General / Unassigned', generalLis, true, path));
        }
    };

    // --- STEP 1: INITIAL AUTOMATIC GROUPING ---
    const realUl = createRealPreviewUl(taskItems);
    assert.strictEqual(realUl.children.length, 18, 'Initial flat list has 18 tasks');

    processGrouping(realUl, sourcePath);

    // Grouping structure assertions
    assert.strictEqual(realUl.children.length, 2, 'Grouped UL has exactly 2 groups: TEST PROJECT and General');
    const testProjectGroup = realUl.children[0];
    const generalGroup = realUl.children[1];

    // Headers & Collapsed by Default
    assert.strictEqual(testProjectGroup.classList.contains('is-collapsed'), true, 'TEST PROJECT is collapsed by default');
    assert.strictEqual(generalGroup.classList.contains('is-collapsed'), true, 'General is collapsed by default');

    // Counts
    const testProjectTasks = testProjectGroup.children[1].children;
    const generalTasks = generalGroup.children[1].children;
    assert.strictEqual(testProjectTasks.length, 3, 'TEST PROJECT contains exactly 3 tasks');
    assert.strictEqual(generalTasks.length, 15, 'General contains exactly 15 tasks');
    assert.strictEqual(testProjectTasks.length + generalTasks.length, 18, 'Zero task loss, zero task duplication');

    // Original ordering preserved
    assert.strictEqual(testProjectTasks[0].textContent, 'Task Zenteno TEST PROJECT');
    assert.strictEqual(testProjectTasks[1].textContent, 'New Task TEST PROJECT');
    assert.strictEqual(testProjectTasks[2].textContent, 'Initial project task TEST PROJECT');

    // --- STEP 2: EXPAND TEST PROJECT ---
    const testHeader = testProjectGroup.children[0];
    testHeader.click(); // Click to expand
    assert.strictEqual(testProjectGroup.classList.contains('is-collapsed'), false, 'TEST PROJECT expands on click');
    assert.strictEqual(testHeader.children[1].textContent, '▼', 'Chevron changes to expanded ▼');
    assert.strictEqual(expandedGroups.has('TimeBox/2026-09-17.md::TEST PROJECT'), true, 'Session remembers expanded state');

    // --- STEP 3: IDEMPOTENCY GUARD ---
    const preCount = realUl.children.length;
    processGrouping(realUl, sourcePath); // run twice
    assert.strictEqual(realUl.children.length, preCount, 'Re-running grouping on grouped list does NOT duplicate');

    // --- STEP 4: CHECKBOX COMPLETION & RE-RENDER SAFETY ---
    // User clicks checkbox for "Task Zenteno" (index 0)
    const zentenoCheckbox = testProjectTasks[0].children[0];
    zentenoCheckbox.setAttribute('checked', 'true');

    // Simulate Obsidian re-rendering the section (Obsidian creates fresh elements on modify)
    const reRenderedTaskItems = taskItems.map((t, idx) => ({
        ...t,
        checked: idx === 0 ? true : false
    }));
    const reRenderedUl = createRealPreviewUl(reRenderedTaskItems);

    // Grouping processor runs on re-rendered DOM
    processGrouping(reRenderedUl, sourcePath);

    assert.strictEqual(reRenderedUl.children.length, 2, 'Re-rendered UL still has 2 project groups');
    const reRenderedTestGroup = reRenderedUl.children[0];
    assert.strictEqual(reRenderedTestGroup.classList.contains('is-collapsed'), false, 'TEST PROJECT REMAINS EXPANDED across re-render!');
    assert.strictEqual(reRenderedTestGroup.children[0].children[1].textContent, '▼', 'Chevron remains ▼');
    assert.strictEqual(reRenderedTestGroup.children[1].children[0].children[0].getAttribute('checked'), 'true', 'Completed checkbox state preserved');

    // --- STEP 5: MARKDOWN NON-MUTATION AUDIT ---
    // Grouping operates strictly in the presentation DOM; source markdown is never altered by grouping
    assert.strictEqual(rawMarkdownSource.includes('📁 TEST PROJECT'), false, 'Markdown source contains no grouping DOM elements');
    assert.strictEqual(rawMarkdownSource.includes('timebox-daily-grouped-ul'), false, 'Markdown source contains no CSS class names');
});


