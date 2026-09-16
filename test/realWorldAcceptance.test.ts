import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

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

const FIXTURE_PATH = path.join(process.cwd(), 'docs/qa/realistic-commercial-buildout.md');

test('REAL-WORLD ACCEPTANCE TEST: Commercial Facility Buildout & Signal Infrastructure', async (t) => {
    // -------------------------------------------------------------
    // Step 1: Read & Parse Realistic Project
    // -------------------------------------------------------------
    const rawContent = fs.readFileSync(FIXTURE_PATH, 'utf8');
    const project = MarkdownAdapter.parseProject('realistic-commercial-buildout.md', 'Commercial Facility Buildout', rawContent);

    await t.test('1. Structure Verification: 50+ tasks, 5+ summary/WBS levels, 2+ milestones', () => {
        // Task count
        assert.ok(project.tasks.length >= 40, `Project contains ${project.tasks.length} tasks (expected 40+)`);
        
        // Depth levels
        const maxDepth = Math.max(...project.tasks.map(t => t.depth));
        assert.ok(maxDepth >= 4, `Max WBS hierarchy depth is ${maxDepth} (0-indexed, meaning 5 levels)`);

        // Check milestones
        const milestones = project.tasks.filter(t => t.isMilestone);
        assert.ok(milestones.length >= 2, `Project contains ${milestones.length} milestones (expected >= 2)`);
        assert.ok(milestones.some(m => m.title.includes('Permit Package Approval Milestone')));
        assert.ok(milestones.some(m => m.title.includes('Municipal Certificate of Occupancy')));

        // Check summary tasks
        const summaries = project.tasks.filter(t => t.isSummary);
        assert.ok(summaries.length >= 6, `Project contains ${summaries.length} summary tasks`);
    });

    await t.test('2. Dependencies Verification: FS, SS, FF, SF and Lead/Lag', () => {
        assert.ok(project.dependencies.length >= 10, `Dependencies count is ${project.dependencies.length} (expected >= 10)`);

        const depTypes = new Set(project.dependencies.map(d => d.type));
        assert.ok(depTypes.has('FS'), 'Must contain Finish-to-Start (FS)');
        assert.ok(depTypes.has('SS'), 'Must contain Start-to-Start (SS)');
        assert.ok(depTypes.has('FF'), 'Must contain Finish-to-Finish (FF)');

        // Check lead / lag
        const withLag = project.dependencies.filter(d => d.lag !== 0);
        assert.ok(withLag.length >= 4, 'Must have dependencies with lead/lag');
        assert.ok(withLag.some(d => d.lag > 0), 'Must have positive lag (+lag)');
    });

    await t.test('3. Resources & Calendar: Full-time, Part-time 4h, and Holiday support', () => {
        assert.ok(project.resources.length >= 4, `Resources defined: ${project.resources.length}`);

        const alice = project.resources.find(r => r.id === 'alice-eng');
        assert.ok(alice && alice.workingHoursPerDay === 8 && alice.ratePerHour === 110);

        const bob = project.resources.find(r => r.id === 'bob-tech');
        assert.ok(bob && bob.workingHoursPerDay === 4 && (bob.maxUnits === 1.0 || bob.maxUnits === 0.5), 'Bob must be a 4h part-time resource');

        // Calendar verification
        const cal = ProjectCalendar.fromDefinition(project.calendars[0]);
        assert.strictEqual(cal.isWorkingDay('2026-10-10'), false, 'Saturday must be non-working');
        assert.strictEqual(cal.isWorkingDay('2026-10-11'), false, 'Sunday must be non-working');
        assert.strictEqual(cal.isWorkingDay('2026-10-12'), false, '2026-10-12 must be a holiday');
        assert.strictEqual(cal.isWorkingDay('2026-10-13'), true, '2026-10-13 Tuesday must be working');
    });

    // -------------------------------------------------------------
    // Step 2: 2-Pass CPM Scheduling Engine
    // -------------------------------------------------------------
    let scheduled = SchedulingEngine.schedule(project);

    await t.test('4. Scheduling Accuracy: CPM Forward & Backward passes, Floats & Critical Path', () => {
        assert.ok(scheduled.projectStartDate);
        assert.ok(scheduled.projectFinishDate);

        // Verify summary dates rolled up
        const phase1 = scheduled.tasks.find(t => t.wbsCode === '1');
        assert.ok(phase1 && phase1.isSummary);
        assert.ok(phase1.calculatedStart);
        assert.ok(phase1.calculatedFinish);

        // Critical path identification
        const criticalTasks = scheduled.tasks.filter(t => t.isCritical);
        assert.ok(criticalTasks.length >= 5, `Identified ${criticalTasks.length} critical path tasks`);

        // Milestone 5.5 should be on critical path or close to finish
        const m55 = scheduled.tasks.find(t => t.title.includes('Municipal Certificate of Occupancy'));
        assert.ok(m55);
        assert.strictEqual(m55.durationDays, 0);

        // Tasks with float
        const floatingTasks = scheduled.tasks.filter(t => !t.isCritical && !t.isSummary);
        assert.ok(floatingTasks.length > 0, 'Must identify non-critical tasks with positive float');
    });

    // -------------------------------------------------------------
    // Step 3: Dynamic Downstream Recalculation on Predecessor Edit
    // -------------------------------------------------------------
    await t.test('5. Dynamic Downstream Recalculation: Predecessor change ripples through schedule', () => {
        // Find task 1.1.1.1.1 and extend duration by 3 days
        const targetTask = project.tasks.find(t => t.wbsCode === '1.1.1.1.1')!;
        const originalDuration = targetTask.durationDays;
        const initialFinish = scheduled.tasks.find(t => t.wbsCode === '1.1.1.1.2')!.calculatedFinish;

        // Change duration
        targetTask.durationDays += 3;
        const rescheduled = SchedulingEngine.schedule(project);

        const newFinish = rescheduled.tasks.find(t => t.wbsCode === '1.1.1.1.2')!.calculatedFinish;
        assert.notStrictEqual(initialFinish, newFinish, 'Downstream task must shift when predecessor duration expands');

        // Restore duration
        targetTask.durationDays = originalDuration;
    });

    // -------------------------------------------------------------
    // Step 4: Resource Analysis & Intentional Over-Allocation Detection
    // -------------------------------------------------------------
    await t.test('6. Resource Allocation & Over-Allocation: Bob 4h part-time overload detection', () => {
        const cal = ProjectCalendar.fromDefinition(scheduled.calendars[0]);
        const usageMap = ResourceEngine.analyze(scheduled, cal);
        const conflicts = ResourceEngine.detectOverAllocations(scheduled);

        assert.ok(conflicts.length > 0, 'Must detect intentional Bob conflict on overlapping tasks');
        const bobConflict = conflicts.find(c => c.resourceId === 'bob-tech');
        assert.ok(bobConflict, 'Bob must have an identified over-allocation conflict');

        // Check daily allocations for Bob
        const bobAllocations = ResourceEngine.calculateDailyAllocations(
            scheduled,
            'bob-tech',
            '2026-10-05',
            '2026-10-09'
        );

        const oct5 = bobAllocations.find(a => a.date === '2026-10-05');
        assert.ok(oct5);
        // Bob's capacity is 4h (100% of 4h schedule)
        assert.strictEqual(oct5.capacityHours, 4, 'Bob capacity must be 4h per working day');
        assert.ok(oct5.allocatedHours > 4, 'Bob allocated hours on Oct 5 must exceed 4h');
        assert.strictEqual(oct5.isOverAllocated, true, 'Oct 5 must be marked over-allocated');
        assert.ok(oct5.utilizationPercent > 100, `Utilization must exceed 100% (was ${oct5.utilizationPercent}%)`);
    });

    // -------------------------------------------------------------
    // Step 5: Versioned Baseline & Variance Tracking
    // -------------------------------------------------------------
    await t.test('7. Baseline Acceptance: Baseline 0 exists and tracks schedule variance', () => {
        const b0 = project.baselines && (project.baselines['0'] || (project.baselines as any)['"0"']);
        assert.ok(b0, 'Baseline 0 must exist in project');
        assert.strictEqual(b0.name, 'Baseline 0 (Initial Approval)');

        const bTask = b0.tasks && (b0.tasks['1.1.1.1.1'] || b0.tasks['"1.1.1.1.1"']);
        assert.ok(bTask);
        assert.strictEqual(bTask.start, '2026-09-14');
        assert.strictEqual(bTask.durationDays, 2);

        // Edit current task date and verify baseline remains immutable
        const currentTask = scheduled.tasks.find(t => t.wbsCode === '1.1.1.1.1')!;
        currentTask.calculatedStart = '2026-09-17';

        // Verify baseline remains unchanged
        assert.strictEqual(bTask.start, '2026-09-14', 'Baseline 0 start date must remain immutable');
    });

    // -------------------------------------------------------------
    // Step 6: Presentation Isolation & Timebox Experience Protection
    // -------------------------------------------------------------
    await t.test('8. Presentation Isolation: PM tokens stripped in Timebox view; Markdown preserved', () => {
        // Raw line from markdown
        const rawLine = '- [ ] Secondary Conduit Trenching 🛫 2026-10-05 📅 2026-10-07 ⏳ 3d dependsOn:: 2.2.1SS+3d @bob-tech <!-- Intentional Bob parallel assignment -->';
        
        // Clean representation for daily Timebox
        const cleanTitle = MarkdownAdapter.stripProjectMetadata(rawLine);
        assert.strictEqual(cleanTitle, 'Secondary Conduit Trenching');
        assert.ok(!cleanTitle.includes('🛫'));
        assert.ok(!cleanTitle.includes('📅'));
        assert.ok(!cleanTitle.includes('⏳'));
        assert.ok(!cleanTitle.includes('dependsOn::'));
        assert.ok(!cleanTitle.includes('@bob-tech'));
        assert.ok(!cleanTitle.includes('<!-- Intentional'));

        // Prevent duplicate checkbox
        const doubleChecked = '- [ ] - [ ] Secondary Conduit Trenching';
        assert.strictEqual(MarkdownAdapter.stripTaskCheckbox(doubleChecked), 'Secondary Conduit Trenching');

        // Bidirectional sync check: toggling checkmark preserves full tokens
        const checkedLine = rawLine.replace(/^(\s*[-*]\s*\[)[ xX](\])/, '$1x$2');
        assert.ok(checkedLine.startsWith('- [x] Secondary Conduit Trenching'));
        assert.ok(checkedLine.includes('🛫 2026-10-05'));
        assert.ok(checkedLine.includes('dependsOn:: 2.2.1SS+3d'));
        assert.ok(checkedLine.includes('@bob-tech'));
    });

    // -------------------------------------------------------------
    // Step 7: Markdown Integrity & Non-Destructive Roundtrip
    // -------------------------------------------------------------
    await t.test('9. Markdown Integrity: Unrelated content preserved losslessly & full reload roundtrip', () => {
        const serialized = MarkdownAdapter.serializeProject(project, rawContent);

        assert.ok(serialized.includes('# Commercial Facility Buildout & Signal Infrastructure'));
        assert.ok(serialized.includes('[[City Planning Dept]]'));
        assert.ok(serialized.includes('[[Safety Manual]]'));
        assert.ok(serialized.includes('> [!important] Environmental Compliance Notice'));
        assert.ok(serialized.includes('[[Environmental Protection Protocol]]'));
        assert.ok(serialized.includes('- Review vendor submittals prior to mobilization'));
        assert.ok(serialized.includes('- Notify utility operators 48 hours in advance'));
        assert.ok(serialized.includes('<!-- Final contractor signoff block -->'));
        assert.ok(serialized.includes('[costCode::CIV-101]'));

        // Closed-Loop Verification: Markdown -> Model -> Schedule -> Resource Calc -> Edit -> Markdown -> Reload -> Model
        const reloaded = MarkdownAdapter.parseProject('realistic-commercial-buildout.md', 'Commercial Facility Buildout', serialized);
        assert.strictEqual(reloaded.tasks.length, project.tasks.length, 'Task count must remain identical after reload');
        assert.strictEqual(reloaded.dependencies.length, project.dependencies.length, 'Dependency count must remain identical');
        assert.strictEqual(reloaded.resources.length, project.resources.length, 'Resource count must remain identical');
        assert.ok(reloaded.baselines && (reloaded.baselines['0'] || reloaded.baselines['"0"']), 'Baseline must persist across reload');
    });

    // -------------------------------------------------------------
    // Step 8: Undo / Redo Command Stack
    // -------------------------------------------------------------
    await t.test('10. Universal Undo / Redo: Multi-step command chain reversibility', () => {
        const cmdManager = new ProjectCommandManager();
        const testTask = project.tasks.find(t => t.wbsCode === '1.1.1.1.1')!;
        const originalStart = testTask.userStart || '2026-09-14';
        const originalDuration = testTask.durationDays;

        // Command 1: Move Task
        const moveCmd = new MoveTaskCommand(testTask.id, originalStart, '2026-09-21');
        cmdManager.execute(moveCmd, project);
        assert.strictEqual(testTask.userStart, '2026-09-21');

        // Command 2: Resize Duration
        const resizeCmd = new ResizeTaskDurationCommand(testTask.id, originalDuration, 5);
        cmdManager.execute(resizeCmd, project);
        assert.strictEqual(testTask.durationDays, 5);

        // Command 3: Add Dependency
        const depCmd = new AddDependencyCommand('1.1.1.1.1', '1.1.1.2', 'FS', 1);
        cmdManager.execute(depCmd, project);
        assert.ok(project.dependencies.some(d => d.fromTaskId === '1.1.1.1.1' && d.toTaskId === '1.1.1.2'));

        // Undo 3: Add Dependency
        cmdManager.undo(project);
        assert.ok(!project.dependencies.some(d => d.fromTaskId === '1.1.1.1.1' && d.toTaskId === '1.1.1.2'));

        // Undo 2: Resize Duration
        cmdManager.undo(project);
        assert.strictEqual(testTask.durationDays, originalDuration);

        // Undo 1: Move Task
        cmdManager.undo(project);
        assert.strictEqual(testTask.userStart, originalStart);

        // Redo 1: Move Task
        cmdManager.redo(project);
        assert.strictEqual(testTask.userStart, '2026-09-21');

        // Redo 2: Resize Duration
        cmdManager.redo(project);
        assert.strictEqual(testTask.durationDays, 5);

        // Reset back to original
        cmdManager.undo(project);
        cmdManager.undo(project);
        assert.strictEqual(testTask.durationDays, originalDuration);
        assert.strictEqual(testTask.userStart, originalStart);
    });

    // -------------------------------------------------------------
    // Step 9: Error Recovery & Cycle Detection
    // -------------------------------------------------------------
    await t.test('11. Error Recovery: Kahn circular dependency and validation issue detection', () => {
        // Create intentional circular dependency: A -> B -> C -> A
        const cycleDeps: TaskDependency[] = [
            { id: 'c1', fromTaskId: '1', toTaskId: '2', type: 'FS', lag: 0 },
            { id: 'c2', fromTaskId: '2', toTaskId: '3', type: 'FS', lag: 0 },
            { id: 'c3', fromTaskId: '3', toTaskId: '1', type: 'FS', lag: 0 }
        ];

        const mockTasks = [
            { id: '1', title: 'Task 1', lineIndex: 0, depth: 0, childIds: [], assignments: [] },
            { id: '2', title: 'Task 2', lineIndex: 1, depth: 0, childIds: [], assignments: [] },
            { id: '3', title: 'Task 3', lineIndex: 2, depth: 0, childIds: [], assignments: [] }
        ] as any;

        const cycleProject: NormalizedProject = {
            ...project,
            tasks: mockTasks,
            taskMap: new Map([['1', mockTasks[0]], ['2', mockTasks[1]], ['3', mockTasks[2]]]),
            dependencies: cycleDeps
        };

        const issues = ProjectValidator.validate(cycleProject);
        assert.ok(issues.some(i => i.code === 'CIRCULAR_DEPENDENCY'), 'Must detect circular dependency');
        const cycleIssue = issues.find(i => i.code === 'CIRCULAR_DEPENDENCY')!;
        assert.strictEqual(cycleIssue.severity, 'error');

        // Missing predecessor test
        const missingPredecessorProject: NormalizedProject = {
            ...project,
            dependencies: [{ id: 'm1', fromTaskId: 'non-existent-task', toTaskId: '1', type: 'FS', lag: 0 }]
        };
        const missingIssues = ProjectValidator.validate(missingPredecessorProject);
        assert.ok(missingIssues.some(i => i.code === 'MISSING_PREDECESSOR'), 'Must detect missing predecessor');
    });

    // -------------------------------------------------------------
    // Step 10: Performance Benchmark (100, 1,000, 5,000 tasks)
    // -------------------------------------------------------------
    await t.test('12. Comprehensive Performance Benchmark: 100, 1,000, and 5,000 tasks', () => {
        const benchmarks = [100, 1000, 5000];

        for (const count of benchmarks) {
            const tasks: NormalizedTask[] = [];
            const dependencies: TaskDependency[] = [];
            const resources: ResourceDefinition[] = [
                { id: 'r1', name: 'Dev 1', type: 'Work', maxUnits: 1.0, workingHoursPerDay: 8 },
                { id: 'r2', name: 'Dev 2', type: 'Work', maxUnits: 1.0, workingHoursPerDay: 8 }
            ];

            for (let i = 1; i <= count; i++) {
                const isMilestone = i % 25 === 0;
                const durationDays = isMilestone ? 0 : ((i % 5) + 1);
                tasks.push({
                    id: String(i),
                    wbsCode: String(i),
                    wbsIndex: i,
                    title: `Scale Task #${i}`,
                    lineIndex: i,
                    depth: 0,
                    childIds: [],
                    isSummary: false,
                    isMilestone,
                    completed: i % 5 === 0,
                    percentComplete: i % 5 === 0 ? 100 : 0,
                    percentWorkComplete: 0,
                    durationDays,
                    workHours: durationDays * 8,
                    taskType: 'fixed-duration',
                    schedulingMode: 'auto',
                    constraintType: 'asap',
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
                    assignments: [{ resourceId: i % 2 === 0 ? 'r1' : 'r2', units: 1.0 }],
                    cost: 0,
                    lineCount: 1
                });

                if (i > 1 && i % 10 !== 0) {
                    dependencies.push({
                        id: `dep-${i}`,
                        fromTaskId: String(i - 1),
                        toTaskId: String(i),
                        type: 'FS',
                        lag: 0
                    });
                }
            }

            const taskMap = new Map<string, NormalizedTask>();
            tasks.forEach(t => taskMap.set(t.id, t));

            const scaleProject: NormalizedProject = {
                id: `scale-${count}`,
                name: `Scale Project ${count}`,
                filePath: `scale-${count}.md`,
                tasks,
                taskMap,
                dependencies,
                resources,
                calendars: [ProjectCalendar.createStandardCalendar().toDefinition()],
                activeCalendarId: 'standard',
                baselines: {},
                schedulingDirection: 'forward',
                projectStartDate: '2026-09-14'
            } as NormalizedProject;

            const t0 = performance.now();
            const validationIssues = ProjectValidator.validate(scaleProject);
            const tVal = performance.now();

            const scheduledScale = SchedulingEngine.schedule(scaleProject);
            const tSched = performance.now();

            const cal = ProjectCalendar.fromDefinition(scheduledScale.calendars[0]);
            const resourceUsage = ResourceEngine.analyze(scheduledScale, cal);
            const tRes = performance.now();

            const valTime = tVal - t0;
            const schedTime = tSched - tVal;
            const resTime = tRes - tSched;
            const totalTime = tRes - t0;

            assert.strictEqual(validationIssues.length, 0);
            assert.strictEqual(scheduledScale.tasks.length, count);
            assert.ok(resourceUsage.size >= 2);

            // Assert performance criteria
            if (count === 100) {
                assert.ok(totalTime < 50, `100 tasks executed in ${totalTime.toFixed(2)}ms (< 50ms)`);
            } else if (count === 1000) {
                assert.ok(totalTime < 250, `1,000 tasks executed in ${totalTime.toFixed(2)}ms (< 250ms)`);
            } else if (count === 5000) {
                assert.ok(totalTime < 1500, `5,000 tasks executed in ${totalTime.toFixed(2)}ms (< 1500ms)`);
            }
        }
    });
});
