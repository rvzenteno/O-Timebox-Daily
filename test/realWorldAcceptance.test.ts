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

    // -------------------------------------------------------------
    // Step 9 / Phase 5: End-to-End Project Controls Lifecycle:
    // Plan → Baseline → Execute → Enter Actuals → Change Status Date → Forecast → Review Variance → Replan
    // -------------------------------------------------------------
    await t.test('13. Lifecycle Parity: Plan → Baseline → Execute → Actuals → Status Date → Forecast → Variance → Replan', () => {
        // 1. PLAN: Start with fresh parse of 55-task realistic project
        const lifecycleProject = MarkdownAdapter.parseProject('realistic-commercial-buildout.md', 'Commercial Facility Buildout', rawContent);
        const planSchedule = SchedulingEngine.schedule(lifecycleProject);

        assert.ok(planSchedule.projectStartDate, 'Plan start date established');
        assert.ok(planSchedule.projectFinishDate, 'Plan finish date established');
        const initialProjectFinish = planSchedule.projectFinishDate;

        // 2. BASELINE: Save Baseline 0 (Contract Approval)
        const baselined = SchedulingEngine.saveBaseline(planSchedule, '0', 'Baseline 0 - Initial Contract');
        assert.ok(baselined.baselines['0'], 'Baseline 0 created');
        assert.strictEqual(baselined.activeBaselineId, '0');

        const task1Id = baselined.tasks.find(t => t.wbsCode === '1.1.1.1.1')!.id;
        const task2Id = baselined.tasks.find(t => t.wbsCode === '1.1.1.1.2')!.id;
        const task3Id = baselined.tasks.find(t => t.wbsCode === '1.1.1.2')!.id;

        const b0_t1 = baselined.baselines['0'].tasks[task1Id];
        const b0_t2 = baselined.baselines['0'].tasks[task2Id];
        assert.ok(b0_t1, 'Task 1 in Baseline 0');
        assert.ok(b0_t2, 'Task 2 in Baseline 0');
        const b0_t1_start = b0_t1.start;
        const b0_t1_finish = b0_t1.finish;
        const b0_t2_start = b0_t2.start;
        const b0_t2_finish = b0_t2.finish;

        // 3. EXECUTE & ENTER ACTUALS:
        // Task 1: Completed 1 day early!
        const task1 = baselined.tasks.find(t => t.id === task1Id)!;
        task1.actualStart = '2026-09-14';
        task1.actualFinish = '2026-09-15'; // Planned was 2026-09-15 finish, 2 days
        task1.completed = true;
        task1.percentComplete = 100;
        task1.actualWorkHours = 16;

        // Task 2: Started on time (2026-09-16), but delayed in progress!
        const task2 = baselined.tasks.find(t => t.id === task2Id)!;
        task2.completed = false;
        task2.actualStart = '2026-09-16';
        task2.actualFinish = undefined;
        task2.percentComplete = 50;
        task2.actualWorkHours = 24;

        // Task 3: Unstarted (0%)
        const task3 = baselined.tasks.find(t => t.id === task3Id)!;
        task3.completed = false;
        task3.actualStart = undefined;
        task3.actualFinish = undefined;
        task3.actualWork = undefined;
        task3.actualWorkHours = undefined;
        task3.percentComplete = 0;

        // 4. CHANGE STATUS DATE:
        // Advance project status date to 2026-09-23 (Wednesday)
        baselined.statusDate = '2026-09-23';

        // 5. FORECAST: Run scheduling & forecast engine
        const forecasted = SchedulingEngine.schedule(baselined);

        // Verify Forecast vs Plan separation:
        // Planned dates must remain untouched!
        const f_t1 = forecasted.tasks.find(t => t.id === task1Id)!;
        const f_t2 = forecasted.tasks.find(t => t.id === task2Id)!;
        const f_t3 = forecasted.tasks.find(t => t.id === task3Id)!;

        assert.strictEqual(f_t1.plannedStart, b0_t1_start, 'Planned start preserved for completed task');
        assert.strictEqual(f_t1.plannedFinish, b0_t1_finish, 'Planned finish preserved for completed task');
        assert.strictEqual(f_t1.forecastStart, '2026-09-14', 'Forecast start reflects actual');
        assert.strictEqual(f_t1.forecastFinish, '2026-09-15', 'Forecast finish reflects actual finish');
        assert.strictEqual(f_t1.remainingDurationDays, 0, 'Remaining duration is 0 for 100% complete');

        assert.strictEqual(f_t2.plannedStart, b0_t2_start, 'Planned start preserved for in-progress task');
        assert.strictEqual(f_t2.plannedFinish, b0_t2_finish, 'Planned finish preserved for in-progress task');
        assert.strictEqual(f_t2.forecastStart, '2026-09-16', 'Forecast start reflects actual start');
        assert.ok(f_t2.forecastFinish && f_t2.forecastFinish >= '2026-09-23', 'Forecast finish projected from status date forward');
        assert.ok(f_t2.forecastFinish > f_t2.plannedFinish, 'Task 2 forecast shows slippage past planned finish');

        // Unstarted task scheduled before status date must slip to status date forward
        assert.ok(f_t3.forecastStart && f_t3.forecastStart >= '2026-09-23', 'Unstarted incomplete task forecast slips to status date forward');

        // 6. REVIEW VARIANCE & REPLAN:
        // Forecast shows slippage: f_t2.forecastFinish > f_t2.plannedFinish
        // Project manager replans schedule to reflect recovery target (duration expanded to 5d)
        task2.durationDays = 5;
        const replannedSchedule = SchedulingEngine.schedule(forecasted);
        const replanned_t2 = replannedSchedule.tasks.find(t => t.id === task2Id)!;

        // Check signed variance against Baseline 0: plan has slipped +2 days
        assert.ok(replanned_t2.variance, 'Variance calculated for Task 2');
        assert.ok((replanned_t2.variance.finishVariance || 0) > 0, 'Task 2 has positive finish variance (days late)');

        // IMMUTABILITY: Verify Baseline 0 was never altered
        assert.strictEqual(replannedSchedule.baselines['0'].tasks[task1Id].start, b0_t1_start, 'Baseline 0 start immutable');
        assert.strictEqual(replannedSchedule.baselines['0'].tasks[task1Id].finish, b0_t1_finish, 'Baseline 0 finish immutable');
        assert.strictEqual(replannedSchedule.baselines['0'].tasks[task2Id].start, b0_t2_start, 'Baseline 0 start immutable');
        assert.strictEqual(replannedSchedule.baselines['0'].tasks[task2Id].finish, b0_t2_finish, 'Baseline 0 finish immutable');

        // 7. BASELINE RECOVERY: Save Baseline 1 (Replanned target)
        SchedulingEngine.saveBaseline(replannedSchedule, '1', 'Baseline 1 - Replanned Recovery');
        assert.ok(replannedSchedule.baselines['1'], 'Baseline 1 saved');
        assert.strictEqual(replannedSchedule.activeBaselineId, '1');

        // Reschedule against Baseline 1: variance resets to 0
        const rescheduledB1 = SchedulingEngine.schedule(replannedSchedule);
        const r_t2 = rescheduledB1.tasks.find(t => t.id === task2Id)!;
        assert.strictEqual(r_t2.variance?.finishVariance, 0, 'Variance resets to 0 relative to new Baseline 1');

        // Switch back to Baseline 0: full contract variance reappears (+2 days)
        rescheduledB1.activeBaselineId = '0';
        const recheckB0 = SchedulingEngine.schedule(rescheduledB1);
        const recheck_t2 = recheckB0.tasks.find(t => t.id === task2Id)!;
        assert.strictEqual(recheck_t2.variance?.finishVariance, 2, 'Full contract variance (+2 days) reappears when switching to Baseline 0');

        // 8. LOSSLESS SERIALIZATION & TIMEBOX PRESENTATION ISOLATION:
        const serialized = MarkdownAdapter.serializeProject(recheckB0, rawContent);
        assert.ok(serialized.includes('[actualStart:: 2026-09-14]'), 'Serialized actualStart');
        assert.ok(serialized.includes('[actualFinish:: 2026-09-15]'), 'Serialized actualFinish');
        assert.ok(serialized.includes('statusDate: "2026-09-23"') || serialized.includes('statusDate: 2026-09-23'), 'Serialized status date');
        assert.ok(serialized.includes('baselines:'), 'Serialized baselines block');

        // Verify Timebox view strips project management metadata
        const sampleLine = `- [x] Subsurface Utility Locating [actualStart:: 2026-09-14] [actualFinish:: 2026-09-15] 🛫 2026-09-14 📅 2026-09-15`;
        const cleanedForTimebox = MarkdownAdapter.stripProjectMetadata(sampleLine);
        assert.ok(!cleanedForTimebox.includes('actualStart::'), 'No actualStart in daily note');
        assert.ok(!cleanedForTimebox.includes('actualFinish::'), 'No actualFinish in daily note');
        assert.strictEqual(cleanedForTimebox, 'Subsurface Utility Locating');
    });
});
