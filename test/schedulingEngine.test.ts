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

