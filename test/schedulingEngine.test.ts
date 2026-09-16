import test from 'node:test';
import assert from 'node:assert/strict';

import { ProjectCalendar } from '../projectCalendar';
import { ProjectValidator } from '../projectValidator';
import { SchedulingEngine } from '../schedulingEngine';
import { ResourceEngine } from '../resourceEngine';
import { MarkdownAdapter } from '../markdownAdapter';
import {
    ProjectCommandManager,
    MoveTaskCommand,
    ResizeTaskDurationCommand,
    AddDependencyCommand,
    IndentTaskCommand
} from '../projectCommandManager';
import {
    NormalizedProject,
    NormalizedTask,
    TaskDependency,
    CalendarDefinition,
    ResourceDefinition
} from '../projectModel';
import {
    ALL_TASKSHEET_COLUMNS,
    DEFAULT_TASKSHEET_COLUMNS,
    PRESET_EXECUTION_COLUMNS,
    PRESET_VARIANCE_COLUMNS,
    PRESET_FLOAT_COLUMNS
} from '../taskSheetModel';

function createMockTask(partial: Partial<NormalizedTask> & { id: string; title: string }): NormalizedTask {
    const durationDays = partial.durationDays !== undefined ? partial.durationDays : (partial.isMilestone ? 0 : 1);
    return {
        id: partial.id,
        wbsCode: partial.wbsCode || partial.id,
        wbsIndex: 1,
        title: partial.title,
        description: partial.description,
        lineIndex: 0,
        depth: partial.depth || 0,
        parentId: partial.parentId,
        childIds: partial.childIds || [],
        isSummary: !!partial.isSummary,
        isMilestone: !!partial.isMilestone || durationDays === 0,
        completed: !!partial.completed,
        percentComplete: partial.percentComplete || 0,
        percentWorkComplete: partial.percentWorkComplete || 0,
        userStart: partial.userStart,
        userFinish: partial.userFinish,
        durationDays,
        workHours: partial.workHours || durationDays * 8,
        taskType: 'fixed-duration',
        schedulingMode: 'auto',
        constraintType: partial.constraintType || 'asap',
        constraintDate: partial.constraintDate,
        priority: 500,
        calculatedStart: '',
        calculatedFinish: '',
        earlyStart: '',
        earlyFinish: '',
        lateStart: '',
        lateFinish: '',
        totalFloat: 0,
        freeFloat: 0,
        isCritical: false,
        isBlocked: false,
        assignments: partial.assignments || [],
        cost: 0,
        lineCount: 1,
        customTokens: partial.customTokens || []
    };
}

function createMockProject(
    tasks: NormalizedTask[],
    dependencies: TaskDependency[] = [],
    calendar?: CalendarDefinition,
    resources: ResourceDefinition[] = [],
    startDate = '2026-09-14'
): NormalizedProject {
    const cal = calendar || {
        id: 'standard',
        name: 'Standard 5-day',
        workingDays: [1, 2, 3, 4, 5],
        hoursPerDay: 8,
        holidays: [],
        exceptions: []
    };

    const taskMap = new Map<string, NormalizedTask>();
    for (const t of tasks) {
        taskMap.set(t.id, t);
    }

    return {
        id: 'test-project',
        name: 'Test Project',
        filePath: 'test.md',
        tasks,
        taskMap,
        dependencies,
        resources,
        calendars: [cal],
        activeCalendarId: cal.id,
        baselines: {},
        schedulingDirection: 'forward',
        projectStartDate: startDate,
        projectFinishDate: startDate,
        startTaskNumber: 1,
        totalWorkHours: 0,
        totalCost: 0,
        overallProgressPercent: 0,
        criticalPath: [],
        validationIssues: []
    };
}

test('1. Calendar Engine: Working Days, Weekend Snapping & Holiday Handling', () => {
    const calendar: CalendarDefinition = {
        id: 'standard',
        name: 'Standard 5-day',
        workingDays: [1, 2, 3, 4, 5], // Mon-Fri
        hoursPerDay: 8,
        holidays: ['2026-09-21'], // Monday holiday
        exceptions: []
    };
    const engine = new ProjectCalendar(calendar);

    // 2026-09-18 is a Friday
    assert.strictEqual(engine.isWorkingDay('2026-09-18'), true);
    // 2026-09-19 is a Saturday
    assert.strictEqual(engine.isWorkingDay('2026-09-19'), false);
    // 2026-09-20 is a Sunday
    assert.strictEqual(engine.isWorkingDay('2026-09-20'), false);
    // 2026-09-21 is Monday, but listed in holidays
    assert.strictEqual(engine.isWorkingDay('2026-09-21'), false);
    // 2026-09-22 is Tuesday
    assert.strictEqual(engine.isWorkingDay('2026-09-22'), true);

    // Snap Saturday to next working day -> Tuesday (since Monday is holiday)
    assert.strictEqual(engine.snapToWorkingDay('2026-09-19', 'forward'), '2026-09-22');
    // Snap Sunday backward -> Friday
    assert.strictEqual(engine.snapToWorkingDay('2026-09-20', 'backward'), '2026-09-18');

    // Add 1 working day from Friday 2026-09-18 -> same day Friday
    assert.strictEqual(engine.addWorkingDays('2026-09-18', 1), '2026-09-18');

    // Add 2 working days from Friday 2026-09-18 -> skips Sat, Sun, Mon(Holiday) -> Tue 2026-09-22
    assert.strictEqual(engine.addWorkingDays('2026-09-18', 2), '2026-09-22');

    // Add 3 working days from Friday 2026-09-18 -> Wed 2026-09-23
    assert.strictEqual(engine.addWorkingDays('2026-09-18', 3), '2026-09-23');

    // Interval split across weekend & holiday
    const intervals = engine.getWorkingIntervals('2026-09-18', '2026-09-22');
    assert.strictEqual(intervals.length, 2);
    assert.strictEqual(intervals[0].start, '2026-09-18');
    assert.strictEqual(intervals[0].end, '2026-09-18');
    assert.strictEqual(intervals[1].start, '2026-09-22');
    assert.strictEqual(intervals[1].end, '2026-09-22');
});

test('2. Validator: Kahn cycle detection & validation issues', () => {
    const tasks = [
        createMockTask({ id: '1', title: 'Task A', durationDays: 2 }),
        createMockTask({ id: '2', title: 'Task B', durationDays: 2 }),
        createMockTask({ id: '3', title: 'Task C', durationDays: 2 })
    ];

    const dependencies: TaskDependency[] = [
        { id: 'dep-1', fromTaskId: '1', toTaskId: '2', type: 'FS', lag: 0 },
        { id: 'dep-2', fromTaskId: '2', toTaskId: '3', type: 'FS', lag: 0 },
        { id: 'dep-3', fromTaskId: '3', toTaskId: '1', type: 'FS', lag: 0 } // cycle!
    ];

    const cyclicProject = createMockProject(tasks, dependencies);
    const issues = ProjectValidator.validate(cyclicProject);
    const cycleIssue = issues.find(i => i.code === 'CIRCULAR_DEPENDENCY');
    assert.ok(cycleIssue, 'Must report circular dependency');
    assert.strictEqual(cycleIssue.severity, 'error');

});

test('3. Scheduling Engine: 20-Task Project with Multi-level WBS, Mixed Dependencies (FS, SS, FF, SF), Lag/Lead & Float', () => {
    const tasks: NormalizedTask[] = [
        // Phase 1: Planning (Summary)
        createMockTask({ id: '1', wbsCode: '1', title: 'Phase 1: Planning', isSummary: true, childIds: ['1.1', '1.2', '1.3'] }),
        createMockTask({ id: '1.1', wbsCode: '1.1', parentId: '1', depth: 1, title: 'Requirements Gathering', durationDays: 3, percentComplete: 100 }),
        createMockTask({ id: '1.2', wbsCode: '1.2', parentId: '1', depth: 1, title: 'Architectural Specs', durationDays: 4, percentComplete: 50 }),
        createMockTask({ id: '1.3', wbsCode: '1.3', parentId: '1', depth: 1, title: 'Planning Sign-off', durationDays: 0, isMilestone: true }),

        // Phase 2: Execution (Summary)
        createMockTask({ id: '2', wbsCode: '2', title: 'Phase 2: Execution', isSummary: true, childIds: ['2.1', '2.2', '2.3', '2.4', '2.5', '2.6', '2.7', '2.8', '2.9', '2.10'] }),
        createMockTask({ id: '2.1', wbsCode: '2.1', parentId: '2', depth: 1, title: 'Site Excavation', durationDays: 5 }),
        createMockTask({ id: '2.2', wbsCode: '2.2', parentId: '2', depth: 1, title: 'Pour Concrete Foundation', durationDays: 4 }),
        createMockTask({ id: '2.3', wbsCode: '2.3', parentId: '2', depth: 1, title: 'Plumbing Rough-in', durationDays: 3 }),
        createMockTask({ id: '2.4', wbsCode: '2.4', parentId: '2', depth: 1, title: 'Framing Walls', durationDays: 6 }),
        createMockTask({ id: '2.5', wbsCode: '2.5', parentId: '2', depth: 1, title: 'Roof Installation', durationDays: 4 }),
        createMockTask({ id: '2.6', wbsCode: '2.6', parentId: '2', depth: 1, title: 'Electrical Rough-in', durationDays: 4 }),
        createMockTask({ id: '2.7', wbsCode: '2.7', parentId: '2', depth: 1, title: 'Insulation & Drywall', durationDays: 5 }),
        createMockTask({ id: '2.8', wbsCode: '2.8', parentId: '2', depth: 1, title: 'Interior Finishing', durationDays: 5 }),
        createMockTask({ id: '2.9', wbsCode: '2.9', parentId: '2', depth: 1, title: 'Exterior Painting', durationDays: 3 }),
        createMockTask({ id: '2.10', wbsCode: '2.10', parentId: '2', depth: 1, title: 'Flooring & Trim', durationDays: 4 }),

        // Phase 3: Closeout (Summary)
        createMockTask({ id: '3', wbsCode: '3', title: 'Phase 3: Closeout', isSummary: true, childIds: ['3.1', '3.2', '3.3', '3.4'] }),
        createMockTask({ id: '3.1', wbsCode: '3.1', parentId: '3', depth: 1, title: 'Final Code Inspection', durationDays: 1 }),
        createMockTask({ id: '3.2', wbsCode: '3.2', parentId: '3', depth: 1, title: 'Punch List Rectification', durationDays: 3 }),
        createMockTask({ id: '3.3', wbsCode: '3.3', parentId: '3', depth: 1, title: 'Client Walkthrough', durationDays: 1 }),
        createMockTask({ id: '3.4', wbsCode: '3.4', parentId: '3', depth: 1, title: 'Project Handover', durationDays: 0, isMilestone: true })
    ];

    const dependencies: TaskDependency[] = [
        { id: 'd1', fromTaskId: '1.1', toTaskId: '1.2', type: 'FS', lag: 0 },
        { id: 'd2', fromTaskId: '1.2', toTaskId: '1.3', type: 'FS', lag: 0 },
        { id: 'd3', fromTaskId: '1.3', toTaskId: '2.1', type: 'FS', lag: 0 },
        { id: 'd4', fromTaskId: '2.1', toTaskId: '2.2', type: 'FS', lag: 1 }, // 1 day cure lag
        { id: 'd5', fromTaskId: '2.2', toTaskId: '2.3', type: 'SS', lag: 2 }, // SS with 2 day lag
        { id: 'd6', fromTaskId: '2.2', toTaskId: '2.4', type: 'FS', lag: 0 },
        { id: 'd7', fromTaskId: '2.4', toTaskId: '2.5', type: 'FS', lag: 0 },
        { id: 'd8', fromTaskId: '2.4', toTaskId: '2.6', type: 'SS', lag: 1 },
        { id: 'd9', fromTaskId: '2.5', toTaskId: '2.7', type: 'FS', lag: 0 },
        { id: 'd10', fromTaskId: '2.6', toTaskId: '2.7', type: 'FS', lag: 0 },
        { id: 'd11', fromTaskId: '2.7', toTaskId: '2.8', type: 'FS', lag: 0 },
        { id: 'd12', fromTaskId: '2.5', toTaskId: '2.9', type: 'FS', lag: 2 },
        { id: 'd13', fromTaskId: '2.8', toTaskId: '2.10', type: 'FF', lag: 1 },
        { id: 'd14', fromTaskId: '2.10', toTaskId: '3.1', type: 'FS', lag: 0 },
        { id: 'd15', fromTaskId: '2.9', toTaskId: '3.1', type: 'FS', lag: 0 },
        { id: 'd16', fromTaskId: '2.3', toTaskId: '3.1', type: 'FS', lag: 0 },
        { id: 'd17', fromTaskId: '3.1', toTaskId: '3.2', type: 'FS', lag: 0 },
        { id: 'd18', fromTaskId: '3.2', toTaskId: '3.3', type: 'FS', lag: 0 },
        { id: 'd19', fromTaskId: '3.3', toTaskId: '3.4', type: 'FS', lag: 0 }
    ];

    const project = createMockProject(tasks, dependencies);
    const scheduled = SchedulingEngine.schedule(project);

    // Verify Task 1.1: Starts 2026-09-14 (Mon), 3 days duration -> finishes 2026-09-16 (Wed)
    const t11 = scheduled.taskMap.get('1.1')!;
    assert.strictEqual(t11.calculatedStart, '2026-09-14');
    assert.strictEqual(t11.calculatedFinish, '2026-09-16');

    // Verify Task 1.2: FS after 1.1 -> starts 2026-09-17 (Thu), 4 days -> finishes 2026-09-22 (Tue)
    const t12 = scheduled.taskMap.get('1.2')!;
    assert.strictEqual(t12.calculatedStart, '2026-09-17');
    assert.strictEqual(t12.calculatedFinish, '2026-09-22');

    // Verify Milestone 1.3: FS after 1.2 -> 2026-09-23 (Wed)
    const t13 = scheduled.taskMap.get('1.3')!;
    assert.strictEqual(t13.calculatedStart, '2026-09-23');
    assert.strictEqual(t13.calculatedFinish, '2026-09-23');

    // Verify Summary Task 1 rolled up correctly
    const t1 = scheduled.taskMap.get('1')!;
    assert.strictEqual(t1.calculatedStart, '2026-09-14');
    assert.strictEqual(t1.calculatedFinish, '2026-09-23');
    assert.ok(t1.durationDays >= 7);

    // Verify Critical Path items have totalFloat === 0 and isCritical === true
    const criticalTasks = scheduled.tasks.filter(t => t.isCritical);
    assert.ok(criticalTasks.length > 5, 'Critical path must be identified across the primary sequence');

    // Project Handover (milestone 3.4) should be critical
    const t34 = scheduled.taskMap.get('3.4')!;
    assert.strictEqual(t34.isCritical, true);
    assert.strictEqual(t34.totalFloat, 0);

    // Plumbing rough-in (2.3) starts early and finishes well before 3.1, so it must have positive float
    const t23 = scheduled.taskMap.get('2.3')!;
    assert.strictEqual(t23.isCritical, false);
    assert.ok(t23.totalFloat > 0);
});

test('4. Resource Engine: Over-allocation matrix & conflict detection', () => {
    const resources: ResourceDefinition[] = [
        { id: 'alice', name: 'Alice', maxUnits: 1.0, ratePerHour: 80 }
    ];

    const tasks: NormalizedTask[] = [
        createMockTask({
            id: '1',
            title: 'Task Alpha',
            durationDays: 5,
            assignments: [{ resourceId: 'alice', units: 1.0 }]
        }),
        createMockTask({
            id: '2',
            title: 'Task Beta (Concurrent)',
            durationDays: 3,
            assignments: [{ resourceId: 'alice', units: 1.0 }] // Parallel conflict!
        })
    ];

    const project = createMockProject(tasks, [], undefined, resources);
    const scheduled = SchedulingEngine.schedule(project);
    const conflicts = ResourceEngine.detectOverAllocations(scheduled);

    assert.ok(conflicts.length > 0, 'Must detect Alice over-allocation');
    assert.strictEqual(conflicts[0].resourceId, 'alice');
    assert.strictEqual(conflicts[0].peakUnits, 2.0);
    assert.strictEqual(conflicts[0].maxUnits, 1.0);
});

test('5. Baselines: Snapshot creation, versioning & variance calculation', () => {
    const tasks: NormalizedTask[] = [
        createMockTask({ id: '1', title: 'Task 1', durationDays: 3 })
    ];

    let project = createMockProject(tasks);
    project = SchedulingEngine.schedule(project);

    // Save Baseline 0
    project = SchedulingEngine.saveBaseline(project, 'baseline0', 'Baseline 0');

    assert.ok(project.baselines && project.baselines['baseline0']);
    assert.strictEqual(project.baselines['baseline0'].tasks['1'].start, '2026-09-14');
    assert.strictEqual(project.baselines['baseline0'].tasks['1'].finish, '2026-09-16');
    assert.strictEqual(project.baselines['baseline0'].tasks['1'].duration, 3);

    // Now modify task 1: user delays start to 2026-09-21 and increases duration to 5
    project.tasks[0].userStart = '2026-09-21';
    project.tasks[0].durationDays = 5;
    project.tasks[0].workHours = 40;

    // Reschedule
    project = SchedulingEngine.schedule(project);

    // Verify variance calculation
    const task = project.tasks[0];
    assert.ok(task.variance);
    assert.strictEqual(task.variance.startVariance, 5); // 5 working days slippage
    assert.strictEqual(task.variance.durationVariance, 2); // 5 - 3 = 2 days
});

test('6. Command Manager: Undo and Redo execution', () => {
    const tasks: NormalizedTask[] = [
        createMockTask({ id: '1', title: 'Parent', durationDays: 2 }),
        createMockTask({ id: '2', title: 'Child candidate', durationDays: 2 })
    ];

    let project = createMockProject(tasks);
    const cmdManager = new ProjectCommandManager();

    // 1. Move Task 1
    const moveCmd = new MoveTaskCommand('1', undefined, '2026-09-18');
    project = cmdManager.execute(moveCmd, project);
    assert.strictEqual(project.tasks[0].userStart, '2026-09-18');
    assert.strictEqual(cmdManager.canUndo(), true);

    // Undo Move
    project = cmdManager.undo(project)!;
    assert.strictEqual(project.tasks[0].userStart, undefined);
    assert.strictEqual(cmdManager.canRedo(), true);

    // Redo Move
    project = cmdManager.redo(project)!;
    assert.strictEqual(project.tasks[0].userStart, '2026-09-18');

    // 2. Indent Task 2
    const indentCmd = new IndentTaskCommand('2');
    project = cmdManager.execute(indentCmd, project);
    assert.strictEqual(project.tasks[1].parentId, '1');
    assert.strictEqual(project.tasks[1].depth, 1);
    assert.strictEqual(project.tasks[0].isSummary, true);

    // Undo Indent
    project = cmdManager.undo(project)!;
    assert.strictEqual(project.tasks[1].parentId, undefined);
    assert.strictEqual(project.tasks[1].depth, 0);
    assert.strictEqual(project.tasks[0].isSummary, false);
});

test('7. MarkdownAdapter: Lossless Round-trip Serialization & Custom Token Preservation', () => {
    const rawMarkdown = `---
title: Project Alpha
projectStartDate: 2026-09-14
calendars:
  - id: standard
    name: Mon-Fri
    workingDays: [1, 2, 3, 4, 5]
    hoursPerDay: 8
    holidays: ["2026-09-21"]
resources:
  - id: alice
    name: Alice Designer
    maxUnits: 1.0
    ratePerHour: 75
---
# Project Alpha Plan

Some introduction paragraph with custom [[Wikilinks]] and #tags.

- [ ] Task 1: Research 🛫 2026-09-14 ⏳ 3d @alice:1.0 #research <!-- custom comment -->
    - [ ] Task 1.1: Surveys ⏳ 2d dependsOn::1 [priority::high] [costCode::ENG-102]
- [x] Task 2: Review & Signoff 📅 2026-09-25 ⏰ 2026-09-25 #milestone dependsOn::1.1 [desc::Final approval by steering committee]

Trailing notes that must NEVER be modified or lost.
`;

    const project = MarkdownAdapter.parseProject('alpha.md', 'Project Alpha', rawMarkdown);
    assert.strictEqual(project.tasks.length, 3);

    // Check Task 1
    const t1 = project.tasks[0];
    assert.strictEqual(t1.title, 'Task 1: Research');
    assert.strictEqual(t1.userStart, '2026-09-14');
    assert.strictEqual(t1.durationDays, 3);
    assert.strictEqual(t1.assignments?.length, 1);
    assert.strictEqual(t1.assignments[0].resourceId, 'alice');
    assert.ok(t1.customTokens?.some(tok => tok.includes('#research')));
    assert.ok(t1.customTokens?.some(tok => tok.includes('<!-- custom comment -->')));

    // Check Task 1.1 (child)
    const t11 = project.tasks[1];
    assert.strictEqual(t11.parentId, t1.id);
    assert.strictEqual(t11.depth, 1);
    assert.strictEqual(t11.priority, 750);
    assert.ok(t11.customTokens?.some(tok => tok.includes('[costCode::ENG-102]')));
    assert.strictEqual(project.dependencies.length >= 1, true);
    const dep1 = project.dependencies.find(d => d.toTaskId === t11.id);
    assert.ok(dep1);
    assert.strictEqual(dep1.fromTaskId, t1.id);

    // Check Task 2 (milestone, checked)
    const t2 = project.tasks[2];
    assert.strictEqual(t2.completed, true);
    assert.strictEqual(t2.isMilestone, true);
    assert.strictEqual(t2.description, 'Final approval by steering committee');

    // Re-serialize to markdown
    const serialized = MarkdownAdapter.serializeProject(project);

    // Verify non-task content survived
    assert.ok(serialized.includes('# Project Alpha Plan'));
    assert.ok(serialized.includes('Some introduction paragraph with custom [[Wikilinks]] and #tags.'));
    assert.ok(serialized.includes('Trailing notes that must NEVER be modified or lost.'));
    assert.ok(serialized.includes('<!-- custom comment -->'));
    assert.ok(serialized.includes('[priority:: 750]'));
    assert.ok(serialized.includes('[costCode::ENG-102]'));
    assert.ok(serialized.includes('[desc:: Final approval by steering committee]'));

});

test('8. Performance Benchmark: 1,000 tasks schedule in < 100ms', () => {
    const tasks: NormalizedTask[] = [];
    const dependencies: TaskDependency[] = [];
    const taskCount = 1000;

    for (let i = 1; i <= taskCount; i++) {
        tasks.push(createMockTask({
            id: String(i),
            title: `Task #${i}`,
            durationDays: (i % 5) + 1
        }));
        if (i > 1) {
            dependencies.push({
                id: `dep-${i}`,
                fromTaskId: String(i - 1),
                toTaskId: String(i),
                type: 'FS',
                lag: 0
            });
        }
    }

    const largeProject = createMockProject(tasks, dependencies);

    const start = performance.now();
    const scheduled = SchedulingEngine.schedule(largeProject);
    const duration = performance.now() - start;

    assert.strictEqual(scheduled.tasks.length, 1000);
    assert.ok(scheduled.tasks[999].calculatedFinish !== undefined);
    assert.ok(duration < 200, `1,000 tasks scheduled in ${duration.toFixed(2)}ms (must be < 200ms)`);
});

test('9. Presentation Isolation: stripTaskCheckbox & stripProjectMetadata prevents duplicate checkboxes and cleans Timebox view', () => {
    // 1. Single and duplicate checkboxes
    assert.strictEqual(MarkdownAdapter.stripTaskCheckbox('- [ ] Concept Design'), 'Concept Design');
    assert.strictEqual(MarkdownAdapter.stripTaskCheckbox('- [ ] - [ ] Concept Design'), 'Concept Design');
    assert.strictEqual(MarkdownAdapter.stripTaskCheckbox('- [x] - [ ] > - [ ] Concept Design'), 'Concept Design');
    assert.strictEqual(MarkdownAdapter.stripTaskCheckbox('   - [ ]   Indented Task'), 'Indented Task');

    // 2. Full PM metadata task string
    const rawPMTask = '- [ ] - [ ] Concept Design 🛫 2026-09-15 📅 2026-09-28 ⏳ 10d dependsOn:: 2 @John(100%) [costCode::ENG-101] [desc:: Initial wireframes] #milestone';
    const cleanTimeboxTask = MarkdownAdapter.stripProjectMetadata(rawPMTask);

    assert.strictEqual(cleanTimeboxTask, 'Concept Design');
    assert.ok(!cleanTimeboxTask.includes('🛫'));
    assert.ok(!cleanTimeboxTask.includes('📅'));
    assert.ok(!cleanTimeboxTask.includes('⏳'));
    assert.ok(!cleanTimeboxTask.includes('dependsOn::'));
    assert.ok(!cleanTimeboxTask.includes('@John'));
    assert.ok(!cleanTimeboxTask.includes('[costCode::'));
    assert.ok(!cleanTimeboxTask.includes('#milestone'));

    // 3. Timebox wikilink preservation
    const taskWithLink = '- [ ] Review [[Project Alpha]] specification 🛫 2026-09-15 📅 2026-09-18';
    assert.strictEqual(MarkdownAdapter.stripProjectMetadata(taskWithLink), 'Review [[Project Alpha]] specification');
});

test('10. Resource CRUD & Frontmatter Persistence: Parsing and serialization of resource definitions', () => {
    const rawMarkdown = `---
title: Resource Test Project
resources:
  - id: dev-alice
    name: Alice Designer
    type: Work
    maxUnits: 100%
    workingHoursPerDay: 8
    ratePerHour: 75
    costPerUse: 50
    notes: Lead UI Designer
  - id: dev-bob
    name: Bob Part-Time
    type: Work
    maxUnits: 50%
    workingHoursPerDay: 4
    ratePerHour: 60
  - id: server-license
    name: Cloud Server License
    type: Cost
    maxUnits: 1.0
    costPerUse: 500
---

# Resource Test Project

- [ ] Task 1 @dev-alice 🛫 2026-09-14 📅 2026-09-16
- [ ] Task 2 @dev-bob 🛫 2026-09-14 📅 2026-09-15
`;

    const project = MarkdownAdapter.parseProject('res-test.md', 'Resource Test Project', rawMarkdown);

    assert.strictEqual(project.resources.length, 3);

    const alice = project.resources.find(r => r.id === 'dev-alice');
    assert.ok(alice);
    assert.strictEqual(alice.name, 'Alice Designer');
    assert.strictEqual(alice.type, 'Work');
    assert.strictEqual(alice.maxUnits, 1.0);
    assert.strictEqual(alice.workingHoursPerDay, 8);
    assert.strictEqual(alice.ratePerHour, 75);
    assert.strictEqual(alice.costPerUse, 50);
    assert.strictEqual(alice.notes, 'Lead UI Designer');

    const bob = project.resources.find(r => r.id === 'dev-bob');
    assert.ok(bob);
    assert.strictEqual(bob.name, 'Bob Part-Time');
    assert.strictEqual(bob.maxUnits, 0.5);
    assert.strictEqual(bob.workingHoursPerDay, 4);
    assert.strictEqual(bob.ratePerHour, 60);

    const license = project.resources.find(r => r.id === 'server-license');
    assert.ok(license);
    assert.strictEqual(license.type, 'Cost');
    assert.strictEqual(license.costPerUse, 500);
});

test('11. Resource Engine: Non-8-hour resource calculations & part-time 4h calendar capacity', () => {
    // Bob works 4 hours per day
    const bobResource: ResourceDefinition = {
        id: 'bob',
        name: 'Bob (Part-Time)',
        type: 'Work',
        maxUnits: 1.0,
        workingHoursPerDay: 4,
        ratePerHour: 50
    };

    // Two concurrent tasks scheduled on Monday, each assigned to Bob (4h + 4h = 8h work)
    const task1: NormalizedTask = createMockTask({
        id: 'task-1',
        title: 'Morning Part-Time Task',
        durationDays: 1,
        assignments: [{ resourceId: 'bob', units: 1.0 }]
    });

    const task2: NormalizedTask = createMockTask({
        id: 'task-2',
        title: 'Afternoon Part-Time Task',
        durationDays: 1,
        assignments: [{ resourceId: 'bob', units: 1.0 }]
    });

    const project = createMockProject([task1, task2], [], undefined, [bobResource], '2026-09-14');
    const scheduled = SchedulingEngine.schedule(project);

    // Calculate daily allocations
    const allocations = ResourceEngine.calculateDailyAllocations(
        scheduled,
        'bob',
        '2026-09-14',
        '2026-09-18'
    );

    assert.strictEqual(allocations.length, 5); // Mon-Fri
    const mondayAlloc = allocations.find(a => a.date === '2026-09-14');
    assert.ok(mondayAlloc);
    // Capacity must reflect 4 hours, NOT 8 hours
    assert.strictEqual(mondayAlloc.capacityHours, 4, 'Daily capacity must reflect Bob 4h working day');
    assert.strictEqual(mondayAlloc.assignedHours, 8, 'Assigned 8h on Monday');
    assert.strictEqual(mondayAlloc.utilizationPercent, 200, 'Utilization must be 200%');
    assert.strictEqual(mondayAlloc.isOverAllocated, true, 'Must flag over-allocation');

    // Tuesday should be 0h work, 4h capacity, 0% utilization
    const tuesdayAlloc = allocations.find(a => a.date === '2026-09-15');
    assert.ok(tuesdayAlloc);
    assert.strictEqual(tuesdayAlloc.capacityHours, 4);
    assert.strictEqual(tuesdayAlloc.assignedHours, 0);
    assert.strictEqual(tuesdayAlloc.utilizationPercent, 0);
    assert.strictEqual(tuesdayAlloc.isOverAllocated, false);
});

test('12. Resource Usage: Time-phased daily allocation with task-level breakdown', () => {
    const alice: ResourceDefinition = {
        id: 'alice',
        name: 'Alice',
        type: 'Work',
        maxUnits: 1.0,
        workingHoursPerDay: 8
    };

    const taskA = createMockTask({
        id: 'task-a',
        title: 'Task Alpha',
        durationDays: 2,
        assignments: [{ resourceId: 'alice', units: 1.0 }]
    });

    const taskB = createMockTask({
        id: 'task-b',
        title: 'Task Beta',
        durationDays: 1,
        assignments: [{ resourceId: 'alice', units: 1.0 }]
    });

    const project = createMockProject([taskA, taskB], [], undefined, [alice], '2026-09-14');
    const scheduled = SchedulingEngine.schedule(project);

    const allocations = ResourceEngine.calculateDailyAllocations(
        scheduled,
        'alice',
        '2026-09-14',
        '2026-09-18'
    );

    const mon = allocations.find(a => a.date === '2026-09-14');
    assert.ok(mon);
    assert.ok(mon.taskWork);
    assert.strictEqual(mon.taskWork.length, 2, 'Both Task Alpha and Beta on Monday');

    const taskAWork = mon.taskWork.find(tw => tw.taskId === 'task-a');
    assert.ok(taskAWork);
    assert.strictEqual(taskAWork.taskTitle, 'Task Alpha');
    assert.strictEqual(taskAWork.hours, 8);

    const taskBWork = mon.taskWork.find(tw => tw.taskId === 'task-b');
    assert.ok(taskBWork);
    assert.strictEqual(taskBWork.taskTitle, 'Task Beta');
    assert.strictEqual(taskBWork.hours, 8);

    assert.strictEqual(mon.assignedHours, 16);
    assert.strictEqual(mon.capacityHours, 8);
    assert.strictEqual(mon.isOverAllocated, true);
});

test('13. Bidirectional Synchronization: Markdown task completion update preserves all PM metadata', () => {
    const rawTaskLine = '- [ ] Concept Design 🛫 2026-09-15 📅 2026-09-28 ⏳ 10d dependsOn:: 2 @John [costCode::ENG-101]';
    
    // Check clean title matches daily note task
    const cleanDailyNoteTitle = 'Concept Design';
    const parsedCleanTitle = MarkdownAdapter.stripProjectMetadata(rawTaskLine);
    assert.strictEqual(parsedCleanTitle, cleanDailyNoteTitle);

    // Toggle completion to checked: - [ ] -> - [x]
    const updatedLine = rawTaskLine.replace(/^(\s*[-*]\s*\[)[ xX](\])/, '$1x$2');
    
    // Verify checked state
    assert.ok(updatedLine.startsWith('- [x] Concept Design'));
    
    // Verify ALL original metadata tokens were completely preserved
    assert.ok(updatedLine.includes('🛫 2026-09-15'));
    assert.ok(updatedLine.includes('📅 2026-09-28'));
    assert.ok(updatedLine.includes('⏳ 10d'));
    assert.ok(updatedLine.includes('dependsOn:: 2'));
    assert.ok(updatedLine.includes('@John'));
    assert.ok(updatedLine.includes('[costCode::ENG-101]'));
});

test('14. Scale Benchmark: 1,000 tasks with realistic resource assignments schedule and detect conflicts in < 250ms', () => {
    const resources: ResourceDefinition[] = [];
    for (let r = 1; r <= 20; r++) {
        resources.push({
            id: `res-${r}`,
            name: `Resource #${r}`,
            type: 'Work',
            maxUnits: 1.0,
            workingHoursPerDay: 8,
            ratePerHour: 50 + r * 5
        });
    }

    const tasks: NormalizedTask[] = [];
    const dependencies: TaskDependency[] = [];

    for (let i = 1; i <= 1000; i++) {
        const assignedResId = `res-${(i % 20) + 1}`;
        tasks.push(createMockTask({
            id: String(i),
            title: `Enterprise Task #${i}`,
            durationDays: (i % 3) + 1,
            assignments: [{ resourceId: assignedResId, units: 1.0 }]
        }));

        if (i > 1 && i % 4 !== 0) {
            dependencies.push({
                id: `dep-${i}`,
                fromTaskId: String(i - 1),
                toTaskId: String(i),
                type: 'FS',
                lag: 0
            });
        }
    }

    const project = createMockProject(tasks, dependencies, undefined, resources);

    const start = performance.now();
    const scheduled = SchedulingEngine.schedule(project);
    const conflicts = ResourceEngine.detectOverAllocations(scheduled);
    const duration = performance.now() - start;

    assert.strictEqual(scheduled.tasks.length, 1000);
    assert.ok(Array.isArray(conflicts));
    assert.ok(duration < 250, `1,000 tasks with 20 resources scheduled and analyzed in ${duration.toFixed(2)}ms (target < 250ms)`);
});

test('15. Project Settings: Frontmatter parsing and lossless round-trip serialization', () => {
    const rawMarkdown = `---
title: "Civic Transit Extension"
projectStartDate: "2026-10-01"
deadline: "2026-12-31"
scheduleMode: "backward"
startTaskNumber: 2
activeCalendarId: "transit-calendar"
calendars:
  - id: "transit-calendar"
    name: "Transit 4-Day"
    workingDays: [1, 2, 3, 4]
    hoursPerDay: 10
    holidays: ["2026-10-12"]
---

# Civic Transit Extension

- [ ] Route Surveying 🛫 2026-10-01 ⏳ 3d
`;

    const project = MarkdownAdapter.parseProject('Transit.md', 'Transit', rawMarkdown);
    assert.strictEqual(project.name, 'Civic Transit Extension');
    assert.strictEqual(project.projectStartDate, '2026-10-01');
    assert.strictEqual(project.projectDeadline, '2026-12-31');
    assert.strictEqual(project.schedulingDirection, 'backward');
    assert.strictEqual(project.startTaskNumber, 2);
    assert.strictEqual(project.activeCalendarId, 'transit-calendar');
    assert.strictEqual(project.calendars.length, 1);
    assert.deepStrictEqual(project.calendars[0].workingDays, [1, 2, 3, 4]);
    assert.strictEqual(project.calendars[0].hoursPerDay, 10);
    assert.deepStrictEqual(project.calendars[0].holidays, ['2026-10-12']);

    // Round-trip serialization
    const serialized = MarkdownAdapter.serializeProject(project, rawMarkdown);
    assert.ok(serialized.includes('Civic Transit Extension'));
    assert.ok(serialized.includes('projectStartDate: 2026-10-01') || serialized.includes('projectStartDate: "2026-10-01"'));
    assert.ok(serialized.includes('activeCalendarId: transit-calendar') || serialized.includes('activeCalendarId: "transit-calendar"'));

    // Re-parse
    const reloaded = MarkdownAdapter.parseProject('Transit.md', 'Transit', serialized);
    assert.strictEqual(reloaded.name, 'Civic Transit Extension');
    assert.strictEqual(reloaded.activeCalendarId, 'transit-calendar');
    assert.strictEqual(reloaded.calendars[0].hoursPerDay, 10);
});

test('16. Calendar Engine: 4-day working week, custom hours, holidays, and working exception calculations', () => {
    const rawMarkdown = `---
title: "Four Day Project"
projectStartDate: "2026-10-01"
activeCalendarId: "four-day"
calendars:
  - id: "four-day"
    name: "Four Day 10h"
    workingDays: [1, 2, 3, 4]
    hoursPerDay: 10
    holidays: ["2026-10-05"]
    exceptions:
      - date: "2026-10-09"
        isWorking: true
        name: "Friday Overtime"
---

- [ ] Task Alpha 🛫 2026-10-01 ⏳ 2d
`;

    const project = MarkdownAdapter.parseProject('FourDay.md', 'FourDay', rawMarkdown);
    const scheduled = SchedulingEngine.schedule(project);

    // 2026-10-01 is a Thursday (working day 4) -> Day 1
    // Friday 2026-10-02 is NOT a working day in this calendar
    // Saturday & Sunday are non-working
    // Monday 2026-10-05 is a holiday
    // Tuesday 2026-10-06 (working day 2) -> Day 2 (Finish date!)
    const task = scheduled.tasks[0];
    assert.strictEqual(task.calculatedStart, '2026-10-01');
    assert.strictEqual(task.calculatedFinish, '2026-10-06');
    assert.strictEqual(task.workHours, 20); // 2 days * 10h/day = 20h

    // Verify exception: Friday 2026-10-09 is marked as isWorking: true (overtime)
    const cal = ProjectCalendar.fromDefinition(project.calendars[0]);
    assert.strictEqual(cal.isWorkingDay('2026-10-02'), false, 'Normal Friday is non-working');
    assert.strictEqual(cal.isWorkingDay('2026-10-05'), false, 'Holiday Monday is non-working');
    assert.strictEqual(cal.isWorkingDay('2026-10-09'), true, 'Exception Friday is working');
});

test('17. Multi-Baseline Management: Baseline 0..10 snapshots, immutability, and signed variance math', () => {
    const res: ResourceDefinition = {
        id: 'r1',
        name: 'Engineer',
        type: 'Work',
        maxUnits: 1.0,
        workingHoursPerDay: 8,
        ratePerHour: 50
    };

    const task1 = createMockTask({
        id: 'task-1',
        title: 'Foundations',
        userStart: '2026-09-14',
        durationDays: 2,
        assignments: [{ resourceId: 'r1', units: 1.0 }]
    });

    const project = createMockProject([task1], [], undefined, [res], '2026-09-14');
    const scheduled1 = SchedulingEngine.schedule(project);

    assert.strictEqual(scheduled1.tasks[0].calculatedStart, '2026-09-14');
    assert.strictEqual(scheduled1.tasks[0].calculatedFinish, '2026-09-15');
    assert.strictEqual(scheduled1.tasks[0].workHours, 16);
    assert.strictEqual(scheduled1.tasks[0].cost, 800);

    // Save Baseline 0 (Contract Approval)
    SchedulingEngine.saveBaseline(scheduled1, '0', 'Baseline 0 - Contract Approval');
    assert.ok(scheduled1.baselines['0']);
    assert.strictEqual(scheduled1.baselines['0'].name, 'Baseline 0 - Contract Approval');
    assert.strictEqual(scheduled1.baselines['0'].tasks['task-1'].start, '2026-09-14');
    assert.strictEqual(scheduled1.baselines['0'].tasks['task-1'].finish, '2026-09-15');
    assert.strictEqual(scheduled1.baselines['0'].tasks['task-1'].duration, 2);
    assert.strictEqual(scheduled1.baselines['0'].tasks['task-1'].work, 16);
    assert.strictEqual(scheduled1.baselines['0'].tasks['task-1'].cost, 800);

    // Now schedule slips: duration expands to 4 days, starting 1 day late (Tuesday 2026-09-15)
    // Finishes Friday 2026-09-18
    task1.userStart = '2026-09-15';
    task1.durationDays = 4;
    task1.schedulingMode = 'manual';

    const scheduled2 = SchedulingEngine.schedule(scheduled1);

    // 1. IMMUTABILITY CHECK: Baseline 0 snapshot must remain unchanged!
    assert.strictEqual(scheduled2.baselines['0'].tasks['task-1'].start, '2026-09-14', 'Baseline start must be immutable');
    assert.strictEqual(scheduled2.baselines['0'].tasks['task-1'].finish, '2026-09-15', 'Baseline finish must be immutable');
    assert.strictEqual(scheduled2.baselines['0'].tasks['task-1'].duration, 2, 'Baseline duration must be immutable');

    // 2. VARIANCE CHECK against Baseline 0:
    // Started 1 day late: startVariance = +1
    // Finished 3 days late (Friday vs Tuesday): finishVariance = +3
    // Duration +2 days: durationVariance = +2
    // Work +16h (32h vs 16h): workVariance = +16
    // Cost +$800 ($1600 vs $800): costVariance = +800
    const v = scheduled2.tasks[0].variance;
    assert.ok(v, 'Variance must be calculated');
    assert.strictEqual(v.startVariance, 1, 'Start variance +1 day late');
    assert.strictEqual(v.finishVariance, 3, 'Finish variance +3 days late');
    assert.strictEqual(v.durationVariance, 2, 'Duration variance +2 days');
    assert.strictEqual(v.workVariance, 16, 'Work variance +16h');
    assert.strictEqual(v.costVariance, 800, 'Cost variance +$800');

    // Save Baseline 1 (Mid-project re-baseline)
    SchedulingEngine.saveBaseline(scheduled2, '1', 'Baseline 1 - Revised Target');
    assert.ok(scheduled2.baselines['1']);
    assert.strictEqual(scheduled2.activeBaselineId, '1');

    // Re-schedule with active baseline = 1: variances should now be 0 relative to Baseline 1
    const scheduled3 = SchedulingEngine.schedule(scheduled2);
    const v3 = scheduled3.tasks[0].variance;
    assert.ok(v3);
    assert.strictEqual(v3.startVariance, 0);
    assert.strictEqual(v3.finishVariance, 0);
    assert.strictEqual(v3.durationVariance, 0);
    assert.strictEqual(v3.workVariance, 0);
    assert.strictEqual(v3.costVariance, 0);

    // Switch back to active baseline = 0: variances reflect comparison against Baseline 0 again
    scheduled3.activeBaselineId = '0';
    const scheduled4 = SchedulingEngine.schedule(scheduled3);
    assert.strictEqual(scheduled4.tasks[0].variance?.finishVariance, 3);
});
test('18. Phase 3: Status Date, Actuals, and Forecast Engine (6 scenarios & separation)', () => {
    // Markdown with Status Date, Task Actuals, and Dependencies
    const rawMarkdown = `---
title: "Phase 3 Status Date and Actuals Project"
projectStartDate: "2026-09-01"
statusDate: "2026-09-15"
---

# Execution Project

- [x] Task 1 Completed Early [actualStart:: 2026-09-01] [actualFinish:: 2026-09-04] [actualWork:: 32h] 🛫 2026-09-01 📅 2026-09-07 ⏳ 5d
- [/] Task 2 In Progress @dev-1 [actualStart:: 2026-09-08] [actualWork:: 24h] 🛫 2026-09-08 📅 2026-09-18 ⏳ 9d 50%
- [ ] Task 3 Future Unstarted 🛫 2026-09-21 📅 2026-09-25 ⏳ 5d
- [ ] Task 4 Planned Before Status Date Incomplete 🛫 2026-09-07 📅 2026-09-11 ⏳ 5d
- [ ] Task 5 Dependent on Incomplete Task dependsOn:: 4 ⏳ 3d
- [ ] Task 6 Resource Allocated with Overrun @dev-1 [actualStart:: 2026-09-14] [actualWork:: 16h] 🛫 2026-09-14 📅 2026-09-17 ⏳ 4d 50%
`;

    // 1. Markdown Parsing & Persistence of Status Date & Actuals
    const project = MarkdownAdapter.parseProject('StatusTest.md', 'StatusTest', rawMarkdown);
    assert.strictEqual(project.statusDate, '2026-09-15', 'Status date parsed from frontmatter');
    assert.strictEqual(project.tasks.length, 6);

    // Verify Task 1 actuals parsed
    const t1 = project.tasks[0];
    assert.strictEqual(t1.actualStart, '2026-09-01');
    assert.strictEqual(t1.actualFinish, '2026-09-04');
    assert.strictEqual(t1.actualWorkHours, 32);

    // Verify Timebox Daily Note cleanliness: stripProjectMetadata must remove actuals tokens
    const cleanedTaskTitle = MarkdownAdapter.stripProjectMetadata(t1.rawLine || '');
    assert.ok(!cleanedTaskTitle.includes('actualStart::'), 'actualStart stripped for Timebox');
    assert.ok(!cleanedTaskTitle.includes('actualFinish::'), 'actualFinish stripped for Timebox');
    assert.ok(!cleanedTaskTitle.includes('actualWork::'), 'actualWork stripped for Timebox');

    // Run scheduling engine (baseline snapshot -> schedule -> forecast)
    const scheduled = SchedulingEngine.schedule(project);
    SchedulingEngine.saveBaseline(scheduled, '0', 'Contract Baseline');

    // SCENARIO 1: Task completed before status date
    // Task finished early (Sept 4 vs planned Sept 5).
    // Planned schedule must remain Sept 1 -> Sept 5.
    // Forecast must be Sept 1 -> Sept 4. Remaining work & duration must be 0.
    const s1 = scheduled.tasks[0];
    assert.strictEqual(s1.plannedStart, '2026-09-01', 'Scenario 1: Planned start preserved');
    assert.strictEqual(s1.plannedFinish, '2026-09-07', 'Scenario 1: Planned finish preserved');
    assert.strictEqual(s1.actualStart, '2026-09-01', 'Scenario 1: Actual start');
    assert.strictEqual(s1.actualFinish, '2026-09-04', 'Scenario 1: Actual finish');
    assert.strictEqual(s1.forecastStart, '2026-09-01', 'Scenario 1: Forecast start = actual');
    assert.strictEqual(s1.forecastFinish, '2026-09-04', 'Scenario 1: Forecast finish = actual finish');
    assert.strictEqual(s1.remainingDurationDays, 0, 'Scenario 1: Remaining duration is 0');
    assert.strictEqual(s1.remainingWorkHours, 0, 'Scenario 1: Remaining work is 0');

    // SCENARIO 2: Task partially complete at status date
    // Task 2: 9 days total duration, 50% complete.
    // Actual start = 2026-09-08. Status date = 2026-09-15.
    // Remaining days = round(9 * 0.5) = 5 days.
    // Remaining work must be anchored from Status Date forward (2026-09-15).
    // 5 working days from 2026-09-15 (Tue, Wed, Thu, Fri, Mon 2026-09-21).
    const s2 = scheduled.tasks[1];
    assert.strictEqual(s2.plannedStart, '2026-09-08', 'Scenario 2: Planned start preserved');
    assert.strictEqual(s2.plannedFinish, '2026-09-18', 'Scenario 2: Planned finish preserved');
    assert.strictEqual(s2.actualStart, '2026-09-08', 'Scenario 2: Actual start preserved');
    assert.strictEqual(s2.forecastStart, '2026-09-08', 'Scenario 2: Forecast start is actual start');
    assert.strictEqual(s2.remainingDurationDays, 5, 'Scenario 2: Remaining duration calculated');
    assert.strictEqual(s2.forecastFinish, '2026-09-21', 'Scenario 2: Forecast finish projected past planned finish');

    // SCENARIO 3: Task not started at status date
    // Task 3: Planned in future (Sept 21 -> Sept 25).
    // Forecast should match planned dates.
    const s3 = scheduled.tasks[2];
    assert.strictEqual(s3.plannedStart, '2026-09-21', 'Scenario 3: Planned start');
    assert.strictEqual(s3.plannedFinish, '2026-09-25', 'Scenario 3: Planned finish');
    assert.strictEqual(s3.forecastStart, '2026-09-21', 'Scenario 3: Forecast start matches planned');
    assert.strictEqual(s3.forecastFinish, '2026-09-25', 'Scenario 3: Forecast finish matches planned');
    assert.strictEqual(s3.remainingDurationDays, 5, 'Scenario 3: 100% remaining');

    // SCENARIO 4: Task planned before status date but incomplete
    // Task 4 was planned for 2026-09-07 -> 2026-09-11 (5 days).
    // But today is 2026-09-15 (Status Date) and it has not started (0% complete).
    // Planned start MUST REMAIN 2026-09-07! It must NOT be silently overwritten!
    // Forecast start MUST slip to Status Date: 2026-09-15.
    // 5 working days from 2026-09-15 -> finishes 2026-09-21.
    const s4 = scheduled.tasks[3];
    assert.strictEqual(s4.plannedStart, '2026-09-07', 'Scenario 4: Planned start must NOT be overwritten');
    assert.strictEqual(s4.plannedFinish, '2026-09-11', 'Scenario 4: Planned finish must NOT be overwritten');
    assert.strictEqual(s4.forecastStart, '2026-09-15', 'Scenario 4: Forecast slips to status date');
    assert.strictEqual(s4.forecastFinish, '2026-09-21', 'Scenario 4: Forecast finish slips');

    // SCENARIO 5: Task with dependencies
    // Task 5 depends on Task 4 (FS). Task 5 duration = 3d.
    // Planned: Task 4 ended Sept 11 -> Task 5 was planned Sept 14 -> Sept 16.
    // Successor Planned dates must be preserved!
    // Successor Forecast MUST ripple: predecessor forecast finish is 2026-09-21.
    // Task 5 forecast start = 2026-09-22 -> finishes 2026-09-24 (3 working days: 22, 23, 24).
    const s5 = scheduled.tasks[4];
    assert.strictEqual(s5.plannedStart, '2026-09-14', 'Scenario 5: Successor planned start preserved');
    assert.strictEqual(s5.plannedFinish, '2026-09-16', 'Scenario 5: Successor planned finish preserved');
    assert.strictEqual(s5.forecastStart, '2026-09-22', 'Scenario 5: Forecast ripples from predecessor slippage');
    assert.strictEqual(s5.forecastFinish, '2026-09-24', 'Scenario 5: Forecast finish ripples');

    // SCENARIO 6: Task with resource assignments
    // Task 6 has actual work = 16h, 50% complete.
    // Remaining work = 16h.
    const s6 = scheduled.tasks[5];
    assert.strictEqual(s6.actualWorkHours, 16, 'Scenario 6: Actual work recorded');
    assert.strictEqual(s6.remainingWorkHours, 16, 'Scenario 6: Remaining work calculated');
    assert.strictEqual(s6.forecastStart, '2026-09-14');

    // STRICT SEPARATION & IMMUTABILITY CHECK
    // Verify that Baseline 0 still retains original snapshots and has not been mutated
    assert.strictEqual(scheduled.baselines['0'].tasks[s4.id].start, '2026-09-07');
    assert.strictEqual(scheduled.baselines['0'].tasks[s4.id].finish, '2026-09-11');

    // Verify serialization round-trip retains actuals
    const serialized = MarkdownAdapter.serializeProject(scheduled, rawMarkdown);
    assert.ok(serialized.includes('[actualStart:: 2026-09-01]'), 'Serialized actualStart');
    assert.ok(serialized.includes('[actualFinish:: 2026-09-04]'), 'Serialized actualFinish');
    assert.ok(serialized.includes('[actualWork:: 32h]'), 'Serialized actualWork');
    assert.ok(serialized.includes('statusDate: "2026-09-15"') || serialized.includes('statusDate: 2026-09-15'));
});

test('19. Phase 4: Task Sheet Customization, Column Visibility, & Preference Isolation', () => {
    // 1. Column Registry Validation
    const allColIds = ALL_TASKSHEET_COLUMNS.map(c => c.id);
    
    // Core & Structure
    assert.ok(allColIds.includes('wbs'), 'WBS column registered');
    assert.ok(allColIds.includes('status'), 'Status column registered');
    assert.ok(allColIds.includes('name'), 'Name column registered');
    assert.ok(allColIds.includes('description'), 'Description column registered');
    assert.ok(allColIds.includes('actions'), 'Actions column registered');

    // Planned Schedule
    assert.ok(allColIds.includes('startDate'), 'Planned Start column registered');
    assert.ok(allColIds.includes('dueDate'), 'Planned Due column registered');
    assert.ok(allColIds.includes('duration'), 'Duration column registered');
    assert.ok(allColIds.includes('work'), 'Work column registered');
    assert.ok(allColIds.includes('predecessors'), 'Predecessors column registered');
    assert.ok(allColIds.includes('resource'), 'Resource column registered');

    // Execution & Actuals
    assert.ok(allColIds.includes('actualStart'), 'Actual Start column registered');
    assert.ok(allColIds.includes('actualFinish'), 'Actual Finish column registered');
    assert.ok(allColIds.includes('actualWork'), 'Actual Work column registered');
    assert.ok(allColIds.includes('forecastStart'), 'Forecast Start column registered');
    assert.ok(allColIds.includes('forecastFinish'), 'Forecast Finish column registered');
    assert.ok(allColIds.includes('percentComplete'), '% Complete column registered');

    // Baseline & Variance
    assert.ok(allColIds.includes('baselineStart'), 'Baseline Start column registered');
    assert.ok(allColIds.includes('baselineFinish'), 'Baseline Finish column registered');
    assert.ok(allColIds.includes('startVariance'), 'Start Variance column registered');
    assert.ok(allColIds.includes('finishVariance'), 'Finish Variance column registered');
    assert.ok(allColIds.includes('durationVariance'), 'Duration Variance column registered');
    assert.ok(allColIds.includes('workVariance'), 'Work Variance column registered');
    assert.ok(allColIds.includes('costVariance'), 'Cost Variance column registered');

    // Analysis & Float
    assert.ok(allColIds.includes('totalFloat'), 'Total Float column registered');
    assert.ok(allColIds.includes('freeFloat'), 'Free Float column registered');
    assert.ok(allColIds.includes('critical'), 'Critical column registered');

    // 2. Presets Integrity
    const validatePreset = (name: string, cols: string[]) => {
        for (const colId of cols) {
            assert.ok(allColIds.includes(colId), `${name} column ${colId} exists in registry`);
        }
    };
    validatePreset('DEFAULT_TASKSHEET_COLUMNS', DEFAULT_TASKSHEET_COLUMNS);
    validatePreset('PRESET_EXECUTION_COLUMNS', PRESET_EXECUTION_COLUMNS);
    validatePreset('PRESET_VARIANCE_COLUMNS', PRESET_VARIANCE_COLUMNS);
    validatePreset('PRESET_FLOAT_COLUMNS', PRESET_FLOAT_COLUMNS);

    // 3. Separation & Non-Pollution Verification:
    // Ensure column preferences are completely independent of project Markdown serialization.
    const rawMarkdown = `---
title: "Clean Project"
---

- [ ] Task 1 🛫 2026-09-01 📅 2026-09-05 ⏳ 5d
`;
    const project = MarkdownAdapter.parseProject('Clean.md', 'Clean', rawMarkdown);
    const scheduled = SchedulingEngine.schedule(project);
    const serialized = MarkdownAdapter.serializeProject(scheduled, rawMarkdown);

    // Assert that column preferences do NOT appear in the project markdown or frontmatter
    assert.ok(!serialized.includes('taskSheetVisibleColumns'), 'No column preferences in markdown');
    assert.ok(!serialized.includes('visibleColumns'), 'No UI preferences in markdown');
    assert.ok(!serialized.includes('ALL_TASKSHEET_COLUMNS'), 'No column metadata in markdown');
});

test('20. Four-State Lifecycle Hardening: 11 Invariant Audit & Verification', () => {
    const rawMarkdown = `---
title: "Four-State Lifecycle Invariant Test"
projectStartDate: "2026-09-01"
---

# Lifecycle Project

- [ ] Task 1 Initial Phase 🛫 2026-09-01 📅 2026-09-02 ⏳ 2d @alice-eng
- [ ] Task 2 Intermediate Work dependsOn:: 1 ⏳ 3d @alice-eng
- [ ] Task 3 Final Delivery dependsOn:: 2 ⏳ 4d @bob-tech
`;
    const project = MarkdownAdapter.parseProject('Lifecycle.md', 'Lifecycle', rawMarkdown);
    project.resources = [
        { id: 'alice-eng', name: 'Alice Engineer', type: 'Work', maxUnits: 1.0, ratePerHour: 100, workingHoursPerDay: 8 },
        { id: 'bob-tech', name: 'Bob Technician', type: 'Work', maxUnits: 1.0, ratePerHour: 60, workingHoursPerDay: 8 }
    ];

    // INITIAL SCHEDULE & BASELINE
    const planSchedule = SchedulingEngine.schedule(project);
    const initialT1Start = planSchedule.tasks[0].plannedStart!;
    const initialT1Finish = planSchedule.tasks[0].plannedFinish!;
    const initialT2Finish = planSchedule.tasks[1].plannedFinish!;

    // Save Baseline 0
    SchedulingEngine.saveBaseline(planSchedule, '0', 'Contract Baseline 0');
    const b0_t1_start = planSchedule.baselines['0'].tasks[planSchedule.tasks[0].id].start;
    const b0_t1_finish = planSchedule.baselines['0'].tasks[planSchedule.tasks[0].id].finish;
    const b0_t2_finish = planSchedule.baselines['0'].tasks[planSchedule.tasks[1].id].finish;

    // INVARIANT 1: Baseline data is immutable after creation
    const b0SnapshotJson = JSON.stringify(planSchedule.baselines['0']);

    // INVARIANT 2: Changing the current plan does not alter any saved baseline
    planSchedule.tasks[1].durationDays = 6; // expand Task 2 duration
    const rescheduled = SchedulingEngine.schedule(planSchedule);
    assert.strictEqual(JSON.stringify(rescheduled.baselines['0']), b0SnapshotJson, 'Invariant 1 & 2: Baseline 0 remains strictly immutable after plan modification');
    assert.strictEqual(rescheduled.tasks[1].plannedFinish !== initialT2Finish, true, 'Current plan has changed');
    assert.strictEqual(rescheduled.baselines['0'].tasks[rescheduled.tasks[1].id].finish, b0_t2_finish, 'Baseline 2 finish remains original');

    // INVARIANT 3: Entering actuals does not modify planned dates
    rescheduled.tasks[0].actualStart = '2026-09-01';
    rescheduled.tasks[0].actualFinish = '2026-09-02';
    rescheduled.tasks[0].actualWorkHours = 16;
    rescheduled.tasks[0].completed = true;
    rescheduled.tasks[0].percentComplete = 100;
    const scheduledWithActuals = SchedulingEngine.schedule(rescheduled);
    assert.strictEqual(scheduledWithActuals.tasks[0].plannedStart, initialT1Start, 'Invariant 3: Entering actuals preserves plannedStart');
    assert.strictEqual(scheduledWithActuals.tasks[0].plannedFinish, initialT1Finish, 'Invariant 3: Entering actuals preserves plannedFinish');

    // INVARIANT 4: Entering actuals does not modify baseline dates
    assert.strictEqual(scheduledWithActuals.baselines['0'].tasks[rescheduled.tasks[0].id].start, b0_t1_start, 'Invariant 4: Entering actuals preserves baseline start');
    assert.strictEqual(scheduledWithActuals.baselines['0'].tasks[rescheduled.tasks[0].id].finish, b0_t1_finish, 'Invariant 4: Entering actuals preserves baseline finish');

    // INVARIANT 5: Forecast calculations do not modify planned dates
    scheduledWithActuals.statusDate = '2026-09-10';
    const scheduledForecast = SchedulingEngine.schedule(scheduledWithActuals);
    assert.strictEqual(scheduledForecast.tasks[0].plannedStart, initialT1Start, 'Invariant 5: Forecast does not modify planned start for task 1');
    assert.strictEqual(scheduledForecast.tasks[0].plannedFinish, initialT1Finish, 'Invariant 5: Forecast does not modify planned finish for task 1');
    assert.strictEqual(scheduledForecast.tasks[1].plannedStart, rescheduled.tasks[1].plannedStart, 'Invariant 5: Forecast does not modify planned start for task 2');
    assert.strictEqual(scheduledForecast.tasks[1].plannedFinish, rescheduled.tasks[1].plannedFinish, 'Invariant 5: Forecast does not modify planned finish for task 2');

    // INVARIANT 6: Forecast calculations do not modify baseline data
    assert.strictEqual(JSON.stringify(scheduledForecast.baselines['0']), b0SnapshotJson, 'Invariant 6: Forecast calculation preserves Baseline 0 data intact');

    // INVARIANT 7: Changing statusDate does not modify historical actuals
    scheduledForecast.statusDate = '2026-09-25'; // move status date forward
    const fwdSchedule = SchedulingEngine.schedule(scheduledForecast);
    assert.strictEqual(fwdSchedule.tasks[0].actualStart, '2026-09-01', 'Invariant 7: Actual start untouched by status date advance');
    assert.strictEqual(fwdSchedule.tasks[0].actualFinish, '2026-09-02', 'Invariant 7: Actual finish untouched by status date advance');
    assert.strictEqual(fwdSchedule.tasks[0].actualWorkHours, 16, 'Invariant 7: Actual work untouched by status date advance');

    fwdSchedule.statusDate = '2026-08-20'; // move status date backward
    const bwdSchedule = SchedulingEngine.schedule(fwdSchedule);
    assert.strictEqual(bwdSchedule.tasks[0].actualStart, '2026-09-01', 'Invariant 7: Actual start untouched by status date rewind');
    assert.strictEqual(bwdSchedule.tasks[0].actualFinish, '2026-09-02', 'Invariant 7: Actual finish untouched by status date rewind');

    // INVARIANT 8: Re-running forecast with identical inputs is deterministic
    const projCopy1 = MarkdownAdapter.parseProject('Copy1.md', 'Copy1', rawMarkdown);
    projCopy1.resources = project.resources;
    projCopy1.statusDate = '2026-09-15';
    const projCopy2 = MarkdownAdapter.parseProject('Copy2.md', 'Copy2', rawMarkdown);
    projCopy2.resources = project.resources;
    projCopy2.statusDate = '2026-09-15';

    const run1 = SchedulingEngine.schedule(projCopy1);
    const run2 = SchedulingEngine.schedule(projCopy2);
    assert.strictEqual(
        JSON.stringify(run1.tasks.map(t => ({ fs: t.forecastStart, ff: t.forecastFinish, ps: t.plannedStart, pf: t.plannedFinish }))),
        JSON.stringify(run2.tasks.map(t => ({ fs: t.forecastStart, ff: t.forecastFinish, ps: t.plannedStart, pf: t.plannedFinish }))),
        'Invariant 8: Identical inputs produce strictly deterministic forecast outputs'
    );

    // INVARIANT 9: Completed tasks remain completed regardless of statusDate changes
    for (const testDate of ['2026-09-01', '2026-09-10', '2026-10-15', '2027-01-01']) {
        fwdSchedule.statusDate = testDate;
        const testSched = SchedulingEngine.schedule(fwdSchedule);
        assert.strictEqual(testSched.tasks[0].completed, true, `Invariant 9: Task remains completed with statusDate ${testDate}`);
        assert.strictEqual(testSched.tasks[0].remainingDurationDays, 0, `Invariant 9: Remaining duration is 0 with statusDate ${testDate}`);
        assert.strictEqual(testSched.tasks[0].remainingWorkHours, 0, `Invariant 9: Remaining work is 0 with statusDate ${testDate}`);
    }

    // INVARIANT 10: Predecessor forecast changes ripple into successor FORECAST dates, but NOT successor PLANNED dates
    fwdSchedule.statusDate = '2026-09-15';
    // Task 2 is in progress, delayed: actualStart 2026-09-03, 20% progress
    fwdSchedule.tasks[1].actualStart = '2026-09-03';
    fwdSchedule.tasks[1].percentComplete = 20;
    fwdSchedule.tasks[1].completed = false;
    const rippleSchedule = SchedulingEngine.schedule(fwdSchedule);
    const t2_planned_finish = rippleSchedule.tasks[1].plannedFinish!;
    const t2_forecast_finish = rippleSchedule.tasks[1].forecastFinish!;
    const t3_planned_start = rippleSchedule.tasks[2].plannedStart!;
    const t3_forecast_start = rippleSchedule.tasks[2].forecastStart!;

    assert.ok(t2_forecast_finish > t2_planned_finish, 'Predecessor forecast finish slips past planned finish');
    assert.ok(t3_forecast_start > t3_planned_start, 'Successor forecast start ripples forward following predecessor forecast');
    assert.strictEqual(rippleSchedule.tasks[2].plannedStart, t3_planned_start, 'Invariant 10: Successor PLANNED start remains completely unchanged');

    // INVARIANT 11: Replanning is an explicit user operation, not an implicit consequence of entering actuals or changing statusDate
    assert.strictEqual(rippleSchedule.tasks[1].durationDays, 6, 'Task duration unchanged implicitly');
    // Explicit user replan operation:
    rippleSchedule.tasks[1].durationDays = 8;
    rippleSchedule.tasks[1].userStart = '2026-09-03';
    const explicitlyReplanned = SchedulingEngine.schedule(rippleSchedule);
    assert.strictEqual(explicitlyReplanned.tasks[1].plannedStart, '2026-09-03', 'Invariant 11: Planned start updates only upon explicit replan');
    assert.strictEqual(explicitlyReplanned.tasks[1].durationDays, 8, 'Invariant 11: Planned duration updates only upon explicit replan');
});

test('21. Forecast & Variance Semantics: 12 Edge-Case Scenarios & Cost Variance Audit', () => {
    const rawMarkdown = `---
title: "Forecast & Variance Audit"
projectStartDate: "2026-09-01"
statusDate: "2026-09-15"
---

- [x] T1 Completed Before Status Date [actualStart:: 2026-09-01] [actualFinish:: 2026-09-04] [actualWork:: 32h] 🛫 2026-09-01 📅 2026-09-07 ⏳ 5d @eng
- [x] T2 Completed After Status Date [actualStart:: 2026-09-10] [actualFinish:: 2026-09-18] [actualWork:: 56h] 🛫 2026-09-10 📅 2026-09-18 ⏳ 7d @eng
- [/] T3 In Progress at Status Date [actualStart:: 2026-09-08] [actualWork:: 24h] 🛫 2026-09-08 📅 2026-09-18 ⏳ 9d 50% @eng
- [ ] T4 Planned Before Status Date Incomplete 🛫 2026-09-07 📅 2026-09-11 ⏳ 5d @eng
- [ ] T5 Predecessor Dependency on T4 dependsOn:: 4 ⏳ 3d @eng
- [x] T6 Milestone Zero Duration Completed [actualStart:: 2026-09-05] [actualFinish:: 2026-09-05] 🛫 2026-09-05 📅 2026-09-05 ⏳ 0d #milestone
- [ ] T7 Milestone Zero Duration Unstarted 🛫 2026-09-22 📅 2026-09-22 ⏳ 0d #milestone
- [/] T8 In Progress with 0 Remaining Work [actualStart:: 2026-09-08] [actualWork:: 40h] 🛫 2026-09-08 📅 2026-09-14 ⏳ 5d 99% @eng
- [/] T9 Progress Without Actual Start 🛫 2026-09-10 📅 2026-09-18 ⏳ 7d 50% @eng
- [/] T10 Actual Start Without Actual Finish [actualStart:: 2026-09-14] 🛫 2026-09-14 📅 2026-09-18 ⏳ 5d @eng
- [ ] T11 Actual Work Without Actual Start [actualWork:: 16h] 🛫 2026-09-14 📅 2026-09-18 ⏳ 5d @eng
- [ ] T12 Zero Percent Complete Future 🛫 2026-09-21 📅 2026-09-25 ⏳ 5d @eng
`;
    const project = MarkdownAdapter.parseProject('ForecastAudit.md', 'ForecastAudit', rawMarkdown);
    project.resources = [
        { id: 'eng', name: 'Engineer', type: 'Work', maxUnits: 1.0, ratePerHour: 100, workingHoursPerDay: 8 }
    ];

    const scheduled = SchedulingEngine.schedule(project);

    // Scenario 1: Completed before status date
    const t1 = scheduled.tasks[0];
    assert.strictEqual(t1.forecastStart, '2026-09-01');
    assert.strictEqual(t1.forecastFinish, '2026-09-04');
    assert.strictEqual(t1.remainingDurationDays, 0);
    assert.strictEqual(t1.remainingWorkHours, 0);
    assert.strictEqual(t1.actualCost, 3200, 'Actual cost = 32h * $100 = $3200');

    // Scenario 2: Completed after status date
    const t2 = scheduled.tasks[1];
    assert.strictEqual(t2.forecastStart, '2026-09-10');
    assert.strictEqual(t2.forecastFinish, '2026-09-18');
    assert.strictEqual(t2.remainingDurationDays, 0);
    assert.strictEqual(t2.remainingWorkHours, 0);
    assert.strictEqual(t2.actualCost, 5600, 'Actual cost = 56h * $100 = $5600');

    // Scenario 3: In progress at status date
    const t3 = scheduled.tasks[2];
    assert.strictEqual(t3.forecastStart, '2026-09-08');
    assert.ok(t3.forecastFinish! >= '2026-09-15');
    assert.strictEqual(t3.actualCost, 2400, 'Actual cost = 24h * $100 = $2400');
    assert.strictEqual(t3.remainingWorkHours, 48, 'Remaining work = 72h - 24h = 48h');

    // Scenario 4: Planned before status date but incomplete
    const t4 = scheduled.tasks[3];
    assert.strictEqual(t4.plannedStart, '2026-09-07', 'Planned start preserved');
    assert.strictEqual(t4.forecastStart, '2026-09-15', 'Forecast slips to status date');
    assert.strictEqual(t4.remainingDurationDays, 5);

    // Scenario 5: Predecessor forecast ripple
    const t5 = scheduled.tasks[4];
    assert.strictEqual(t5.plannedStart, '2026-09-14', 'Successor planned start preserved');
    assert.ok(t5.forecastStart! > t5.plannedStart!, 'Successor forecast ripples from predecessor');

    // Scenario 6: Completed milestone (0 duration)
    const t6 = scheduled.tasks[5];
    assert.strictEqual(t6.forecastStart, '2026-09-05');
    assert.strictEqual(t6.forecastFinish, '2026-09-05');
    assert.strictEqual(t6.actualDuration, 0, 'Milestone actual duration is 0');
    assert.strictEqual(t6.remainingDurationDays, 0);

    // Scenario 7: Unstarted milestone (0 duration)
    const t7 = scheduled.tasks[6];
    assert.strictEqual(t7.forecastStart, '2026-09-22');
    assert.strictEqual(t7.forecastFinish, '2026-09-22');
    assert.strictEqual(t7.remainingDurationDays, 0);

    // Scenario 8: Task with remaining work = 0
    const t8 = scheduled.tasks[7];
    assert.strictEqual(t8.actualWorkHours, 40);
    assert.strictEqual(t8.remainingWorkHours, 0);

    // Scenario 9: Progress without actualStart
    const t9 = scheduled.tasks[8];
    assert.strictEqual(t9.actualStart, undefined, 'No fake actualStart synthesized');
    assert.strictEqual(t9.forecastStart, '2026-09-10', 'Forecast start defaults to plannedStart');

    // Scenario 10: Actual start without actual finish
    const t10 = scheduled.tasks[9];
    assert.strictEqual(t10.actualStart, '2026-09-14');
    assert.strictEqual(t10.actualFinish, undefined, 'actualFinish remains undefined');
    assert.strictEqual(t10.forecastStart, '2026-09-14');

    // Scenario 11: Actual work without actual start
    const t11 = scheduled.tasks[10];
    assert.strictEqual(t11.actualWorkHours, 16);
    assert.strictEqual(t11.actualStart, undefined);
    assert.strictEqual(t11.forecastStart, '2026-09-14');

    // Scenario 12: 0% completion future
    const t12 = scheduled.tasks[11];
    assert.strictEqual(t12.percentComplete, 0);
    assert.strictEqual(t12.forecastStart, '2026-09-21');
    assert.strictEqual(t12.forecastFinish, '2026-09-25');
    assert.strictEqual(t12.remainingDurationDays, 5);
    assert.strictEqual(t12.actualCost, 0);
});

