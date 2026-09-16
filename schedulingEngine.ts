import {
    NormalizedProject,
    NormalizedTask,
    TaskDependency,
    TaskVariance,
    TaskBaseline
} from './projectModel';
import { ProjectCalendar } from './projectCalendar';


export class SchedulingEngine {
    /**
     * Run full project scheduling engine:
     * 1. Calendar normalization
     * 2. Forward pass (Early Start, Early Finish, Calculated Dates)
     * 3. Backward pass (Late Start, Late Finish)
     * 4. Slack / Float calculation (Total Float, Free Float)
     * 5. Critical path determination
     * 6. Summary task hierarchy rollups
     * 7. Work, cost, and baseline variance calculations
     */
    static schedule(project: NormalizedProject): NormalizedProject {
        // Resolve active calendar
        const calendarDef = project.calendars.find(c => c.id === project.activeCalendarId) 
            || project.calendars[0] 
            || ProjectCalendar.createStandardCalendar().toDefinition();
        const calendar = ProjectCalendar.fromDefinition(calendarDef);

        // Ensure project start date is valid working day
        if (!project.projectStartDate) {
            project.projectStartDate = new Date().toISOString().slice(0, 10);
        }
        project.projectStartDate = calendar.snapToWorkingDay(project.projectStartDate, 'forward');

        // Build adjacency graphs
        const successorsMap = new Map<string, TaskDependency[]>();
        const predecessorsMap = new Map<string, TaskDependency[]>();

        for (const task of project.tasks) {
            successorsMap.set(task.id, []);
            predecessorsMap.set(task.id, []);
        }

        for (const dep of project.dependencies) {
            if (successorsMap.has(dep.fromTaskId) && predecessorsMap.has(dep.toTaskId)) {
                successorsMap.get(dep.fromTaskId)!.push(dep);
                predecessorsMap.get(dep.toTaskId)!.push(dep);
            }
        }

        // Topological Sort (Kahn's algorithm)
        const inDegree = new Map<string, number>();
        project.tasks.forEach(t => inDegree.set(t.id, 0));
        project.dependencies.forEach(dep => {
            if (inDegree.has(dep.toTaskId) && project.taskMap.has(dep.fromTaskId)) {
                inDegree.set(dep.toTaskId, inDegree.get(dep.toTaskId)! + 1);
            }
        });

        const queue: string[] = [];
        inDegree.forEach((deg, id) => {
            if (deg === 0) queue.push(id);
        });

        const topoOrder: string[] = [];
        while (queue.length > 0) {
            const currId = queue.shift()!;
            topoOrder.push(currId);

            for (const dep of successorsMap.get(currId) || []) {
                const nextDeg = inDegree.get(dep.toTaskId)! - 1;
                inDegree.set(dep.toTaskId, nextDeg);
                if (nextDeg === 0) {
                    queue.push(dep.toTaskId);
                }
            }
        }

        // Append any remaining tasks (in case of disconnected nodes or cyclic subsets)
        for (const task of project.tasks) {
            if (!topoOrder.includes(task.id)) {
                topoOrder.push(task.id);
            }
        }

        // -------------------------------------------------------------
        // STEP 1: FORWARD PASS (Early Start & Early Finish)
        // -------------------------------------------------------------
        for (const taskId of topoOrder) {
            const task = project.taskMap.get(taskId);
            if (!task) continue;

            let earliestStart = project.projectStartDate;

            // Check task constraints
            if (task.constraintType === 'mso' && task.constraintDate) {
                earliestStart = calendar.snapToWorkingDay(task.constraintDate, 'forward');
            } else if (task.constraintType === 'snet' && task.constraintDate) {
                const snet = calendar.snapToWorkingDay(task.constraintDate, 'forward');
                if (snet > earliestStart) earliestStart = snet;
            } else if (task.userStart && task.schedulingMode === 'manual') {
                earliestStart = calendar.snapToWorkingDay(task.userStart, 'forward');
            } else if (task.userStart && (!predecessorsMap.get(taskId) || predecessorsMap.get(taskId)!.length === 0)) {
                earliestStart = calendar.snapToWorkingDay(task.userStart, 'forward');
            }

            // Evaluate all predecessor dependencies
            const preds = predecessorsMap.get(taskId) || [];
            for (const dep of preds) {
                const predTask = project.taskMap.get(dep.fromTaskId);
                if (!predTask) continue;

                let candidateStart = earliestStart;
                const lag = dep.lag || 0;

                switch (dep.type) {
                    case 'FS': {
                        // Finish-to-Start: successor starts 1 working day after predecessor finishes + lag
                        const baseDate = predTask.earlyFinish || predTask.calculatedFinish;
                        candidateStart = calendar.stepWorkingDays(baseDate, 1 + lag);
                        break;
                    }
                    case 'SS': {
                        // Start-to-Start: successor starts with predecessor start + lag
                        const baseDate = predTask.earlyStart || predTask.calculatedStart;
                        candidateStart = calendar.stepWorkingDays(baseDate, lag);
                        break;
                    }
                    case 'FF': {
                        // Finish-to-Finish: successor finishes with predecessor finish + lag
                        const baseDate = predTask.earlyFinish || predTask.calculatedFinish;
                        const targetFinish = calendar.stepWorkingDays(baseDate, lag);
                        const dur = task.isMilestone ? 0 : Math.max(1, task.durationDays);
                        candidateStart = dur > 1 ? calendar.subtractWorkingDays(targetFinish, dur) : targetFinish;
                        break;
                    }
                    case 'SF': {
                        // Start-to-Finish: successor finishes with predecessor start + lag
                        const baseDate = predTask.earlyStart || predTask.calculatedStart;
                        const targetFinish = calendar.stepWorkingDays(baseDate, lag);
                        const dur = task.isMilestone ? 0 : Math.max(1, task.durationDays);
                        candidateStart = dur > 1 ? calendar.subtractWorkingDays(targetFinish, dur) : targetFinish;
                        break;
                    }
                }

                if (candidateStart > earliestStart) {
                    earliestStart = candidateStart;
                }
            }

            task.earlyStart = earliestStart;
            task.calculatedStart = earliestStart;

            const duration = task.isMilestone ? 0 : Math.max(1, task.durationDays);
            task.earlyFinish = duration > 0 ? calendar.addWorkingDays(task.earlyStart, duration) : task.earlyStart;
            task.calculatedFinish = task.earlyFinish;
            task.workingIntervals = calendar.getWorkingIntervals(task.calculatedStart, task.calculatedFinish);
        }

        // -------------------------------------------------------------
        // STEP 2: SUMMARY TASK BOTTOM-UP ROLLUP (Forward)
        // -------------------------------------------------------------
        this.rollupSummaryTasks(project, calendar);

        // -------------------------------------------------------------
        // STEP 3: PROJECT FINISH BOUNDARY (Multiple Terminal Tasks)
        // -------------------------------------------------------------
        let maxTerminalFinish = project.projectStartDate;
        for (const task of project.tasks) {
            if (task.calculatedFinish > maxTerminalFinish) {
                maxTerminalFinish = task.calculatedFinish;
            }
        }
        project.projectFinishDate = project.projectDeadline && project.projectDeadline > maxTerminalFinish
            ? project.projectDeadline
            : maxTerminalFinish;

        // -------------------------------------------------------------
        // STEP 4: BACKWARD PASS (Late Start & Late Finish)
        // -------------------------------------------------------------
        const reverseTopo = [...topoOrder].reverse();
        for (const taskId of reverseTopo) {
            const task = project.taskMap.get(taskId);
            if (!task) continue;

            const succs = successorsMap.get(taskId) || [];
            let latestFinish = project.projectFinishDate;

            if (succs.length > 0) {
                for (const dep of succs) {
                    const succTask = project.taskMap.get(dep.toTaskId);
                    if (!succTask) continue;

                    let candidateFinish = latestFinish;
                    const lag = dep.lag || 0;

                    switch (dep.type) {
                        case 'FS': {
                            // Predecessor must finish 1 working day before successor lateStart + lag
                            candidateFinish = calendar.stepWorkingDays(succTask.lateStart, -(1 + lag));
                            break;
                        }
                        case 'SS': {
                            // Predecessor must start before successor start - lag
                            const targetStart = calendar.stepWorkingDays(succTask.lateStart, -lag);
                            const dur = task.isMilestone ? 0 : Math.max(1, task.durationDays);
                            candidateFinish = dur > 1 ? calendar.addWorkingDays(targetStart, dur) : targetStart;
                            break;
                        }
                        case 'FF': {
                            // Predecessor must finish before successor finish - lag
                            candidateFinish = calendar.stepWorkingDays(succTask.lateFinish, -lag);
                            break;
                        }
                        case 'SF': {
                            // Predecessor start relates to successor finish
                            const targetStart = calendar.stepWorkingDays(succTask.lateFinish, -lag);
                            const dur = task.isMilestone ? 0 : Math.max(1, task.durationDays);
                            candidateFinish = dur > 1 ? calendar.addWorkingDays(targetStart, dur) : targetStart;
                            break;
                        }
                    }


                    if (candidateFinish < latestFinish) {
                        latestFinish = candidateFinish;
                    }
                }
            }

            task.lateFinish = latestFinish;
            const dur = task.isMilestone ? 0 : Math.max(1, task.durationDays);
            task.lateStart = dur > 0 ? calendar.subtractWorkingDays(task.lateFinish, dur) : task.lateFinish;

            // -------------------------------------------------------------
            // STEP 5: FLOAT (SLACK) & CRITICAL PATH
            // -------------------------------------------------------------
            if (task.lateFinish >= task.earlyFinish) {
                task.totalFloat = calendar.calculateWorkingDays(task.earlyFinish, task.lateFinish) - 1;
            } else {
                // Negative float when compressed past deadline or constraint
                task.totalFloat = -(calendar.calculateWorkingDays(task.lateFinish, task.earlyFinish) - 1);
            }

            // Free float: min(successor earlyStart - task earlyFinish - 1)
            let minSuccessorEarlyStart: string | null = null;
            for (const dep of succs) {
                const succTask = project.taskMap.get(dep.toTaskId);
                if (succTask) {
                    if (!minSuccessorEarlyStart || succTask.earlyStart < minSuccessorEarlyStart) {
                        minSuccessorEarlyStart = succTask.earlyStart;
                    }
                }
            }

            if (minSuccessorEarlyStart) {
                task.freeFloat = Math.max(0, calendar.calculateWorkingDays(task.earlyFinish, minSuccessorEarlyStart) - 2);
            } else {
                task.freeFloat = task.totalFloat;
            }

            // Task is critical if total float <= 0
            task.isCritical = task.totalFloat <= 0 && !task.completed;
        }

        // Compile list of critical path task IDs
        project.criticalPath = project.tasks.filter(t => t.isCritical).map(t => t.id);

        // -------------------------------------------------------------
        // STEP 6: WORK, COST, PROGRESS & BASELINES
        // -------------------------------------------------------------
        let totalProjectWork = 0;
        let totalProjectCost = 0;
        let totalWorkCompleted = 0;

        for (const task of project.tasks) {
            // Work = Duration * HoursPerDay * sum(Units)
            const unitsSum = task.assignments.length > 0 
                ? task.assignments.reduce((sum, a) => sum + a.units, 0)
                : 1.0;
            task.workHours = Math.round(task.durationDays * calendar.hoursPerDay * unitsSum);

            // Cost calculation based on resource ratePerHour
            let taskCost = 0;
            for (const a of task.assignments) {
                const res = project.resources.find(r => r.id === a.resourceId || r.name === a.resourceId);
                const rate = res?.ratePerHour || 0;
                const assignedWork = task.durationDays * calendar.hoursPerDay * a.units;
                taskCost += assignedWork * rate;
            }
            task.cost = taskCost;

            if (!task.isSummary) {
                totalProjectWork += task.workHours;
                totalProjectCost += task.cost;
                totalWorkCompleted += task.workHours * (task.percentComplete / 100);
            }

            // Baseline variance comparison
            if (project.activeBaselineId && project.baselines[project.activeBaselineId]) {
                const base = project.baselines[project.activeBaselineId].tasks[task.wbsCode] 
                    || project.baselines[project.activeBaselineId].tasks[task.id];
                if (base) {
                    task.baseline = base;
                    const startVar = calendar.calculateWorkingDays(base.start, task.calculatedStart) - 1;
                    const finishVar = calendar.calculateWorkingDays(base.finish, task.calculatedFinish) - 1;
                    const durVar = task.durationDays - base.duration;
                    const workVar = task.workHours - base.work;
                    const costVar = task.cost - base.cost;

                    task.variance = {
                        startVariance: task.calculatedStart >= base.start ? startVar : -startVar,
                        finishVariance: task.calculatedFinish >= base.finish ? finishVar : -finishVar,
                        durationVariance: durVar,
                        workVariance: workVar,
                        costVariance: costVar
                    };
                }
            }
        }

        project.totalWorkHours = totalProjectWork;
        project.totalCost = totalProjectCost;
        project.overallProgressPercent = totalProjectWork > 0 
            ? Math.round((totalWorkCompleted / totalProjectWork) * 100)
            : 0;

        return project;
    }

    /**
     * Recursively roll up summary task dates, durations, work, and progress from child tasks.
     */
    private static rollupSummaryTasks(project: NormalizedProject, calendar: ProjectCalendar): void {
        // Group by depth descending (deepest children first)
        const summaryTasks = project.tasks.filter(t => t.isSummary);
        summaryTasks.sort((a, b) => b.depth - a.depth);

        for (const parent of summaryTasks) {
            const children = parent.childIds.map(id => project.taskMap.get(id)).filter(Boolean) as NormalizedTask[];
            if (children.length === 0) continue;

            let minStart: string | null = null;
            let maxFinish: string | null = null;
            let totalChildWork = 0;
            let totalChildProgress = 0;

            for (const child of children) {
                const cStart = child.calculatedStart;
                const cFinish = child.calculatedFinish;

                if (!minStart || cStart < minStart) minStart = cStart;
                if (!maxFinish || cFinish > maxFinish) maxFinish = cFinish;

                totalChildWork += child.workHours || 1;
                totalChildProgress += (child.workHours || 1) * (child.percentComplete / 100);
            }

            if (minStart) parent.calculatedStart = minStart;
            if (maxFinish) parent.calculatedFinish = maxFinish;

            if (minStart && maxFinish) {
                parent.durationDays = calendar.calculateWorkingDays(minStart, maxFinish);
                parent.earlyStart = parent.calculatedStart;
                parent.earlyFinish = parent.calculatedFinish;
                parent.workingIntervals = calendar.getWorkingIntervals(parent.calculatedStart, parent.calculatedFinish);
            }

            parent.percentComplete = totalChildWork > 0 
                ? Math.round((totalChildProgress / totalChildWork) * 100)
                : 0;
            parent.completed = parent.percentComplete === 100;
        }
    }

    /**
     * Create and store a baseline snapshot from current calculated/scheduled state.
     */
    static saveBaseline(
        project: NormalizedProject,
        baselineId: string = 'baseline0',
        baselineName: string = 'Baseline 0'
    ): NormalizedProject {
        if (!project.baselines) project.baselines = {};

        const taskBaselines: Record<string, TaskBaseline> = {};
        for (const task of project.tasks) {
            taskBaselines[task.id] = {
                start: task.calculatedStart,
                finish: task.calculatedFinish,
                duration: task.durationDays,
                work: task.workHours,
                cost: task.cost
            };
        }

        project.baselines[baselineId] = {
            id: baselineId,
            name: baselineName,
            savedAt: new Date().toISOString(),
            tasks: taskBaselines
        };
        project.activeBaselineId = baselineId;

        return project;
    }
}

