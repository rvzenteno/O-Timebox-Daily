import { NormalizedProject, NormalizedTask, ResourceDefinition } from './projectModel';
import { ProjectCalendar } from './projectCalendar';

export interface DailyResourceAllocation {
    date: string;
    allocatedUnits: number; // e.g. 1.5 = 150%
    isOverAllocated: boolean;
    taskIds: string[];
}

export interface ResourceUsageSummary {
    resource: ResourceDefinition;
    totalWorkHours: number;
    totalCost: number;
    assignedTasks: NormalizedTask[];
    dailyAllocations: Map<string, DailyResourceAllocation>;
    hasOverAllocation: boolean;
    peakAllocationUnits: number;
}

export class ResourceEngine {
    /**
     * Compute time-phased daily resource allocations and flag over-allocated tasks.
     */
    static analyze(project: NormalizedProject, calendar: ProjectCalendar): Map<string, ResourceUsageSummary> {
        const usageMap = new Map<string, ResourceUsageSummary>();

        // Initialize resource usage objects
        for (const res of project.resources) {
            usageMap.set(res.id, {
                resource: res,
                totalWorkHours: 0,
                totalCost: 0,
                assignedTasks: [],
                dailyAllocations: new Map(),
                hasOverAllocation: false,
                peakAllocationUnits: 0
            });
        }

        // Iterate through all active non-summary tasks with assignments
        for (const task of project.tasks) {
            if (task.isSummary || task.completed) continue;
            task.isOverAllocated = false;

            for (const assignment of task.assignments) {
                let usage = usageMap.get(assignment.resourceId);

                // Auto-create ad-hoc resource entry if not yet in project resources
                if (!usage) {
                    const adHocRes: ResourceDefinition = {
                        id: assignment.resourceId,
                        name: assignment.resourceId.replace(/^@/, ''),
                        maxUnits: 1.0,
                        ratePerHour: 0
                    };
                    project.resources.push(adHocRes);
                    usage = {
                        resource: adHocRes,
                        totalWorkHours: 0,
                        totalCost: 0,
                        assignedTasks: [],
                        dailyAllocations: new Map(),
                        hasOverAllocation: false,
                        peakAllocationUnits: 0
                    };
                    usageMap.set(adHocRes.id, usage);
                }

                if (!usage.assignedTasks.some(t => t.id === task.id)) {
                    usage.assignedTasks.push(task);
                }

                const assignedHours = task.durationDays * calendar.hoursPerDay * assignment.units;
                usage.totalWorkHours += assignedHours;
                usage.totalCost += assignedHours * (usage.resource.ratePerHour || 0);

                // Distribute units across each working day in the task's schedule
                if (task.calculatedStart && task.calculatedFinish) {
                    const intervals = calendar.getWorkingIntervals(task.calculatedStart, task.calculatedFinish);
                    for (const intv of intervals) {
                        let curDate = intv.start;
                        while (curDate <= intv.end) {
                            if (calendar.isWorkingDay(curDate)) {
                                let daily = usage.dailyAllocations.get(curDate);
                                if (!daily) {
                                    daily = {
                                        date: curDate,
                                        allocatedUnits: 0,
                                        isOverAllocated: false,
                                        taskIds: []
                                    };
                                    usage.dailyAllocations.set(curDate, daily);
                                }

                                daily.allocatedUnits += assignment.units;
                                if (!daily.taskIds.includes(task.id)) {
                                    daily.taskIds.push(task.id);
                                }

                                if (daily.allocatedUnits > usage.peakAllocationUnits) {
                                    usage.peakAllocationUnits = daily.allocatedUnits;
                                }

                                if (daily.allocatedUnits > (usage.resource.maxUnits || 1.0)) {
                                    daily.isOverAllocated = true;
                                    usage.hasOverAllocation = true;
                                    task.isOverAllocated = true;
                                }
                            }
                            curDate = calendar.addWorkingDays(curDate, 2); // advance to next day
                        }
                    }
                }
            }
        }

        return usageMap;
    }

    /**
     * Detect all over-allocated resources and conflicting tasks.
     */
    static detectOverAllocations(project: NormalizedProject): Array<{
        resourceId: string;
        resourceName: string;
        peakUnits: number;
        maxUnits: number;
        conflictingTaskIds: string[];
    }> {
        const calDef = project.calendars.find(c => c.id === project.activeCalendarId) 
            || project.calendars[0] 
            || ProjectCalendar.createStandardCalendar().toDefinition();
        const calendar = ProjectCalendar.fromDefinition(calDef);
        const usageMap = this.analyze(project, calendar);
        const conflicts: Array<{
            resourceId: string;
            resourceName: string;
            peakUnits: number;
            maxUnits: number;
            conflictingTaskIds: string[];
        }> = [];

        for (const [id, summary] of usageMap.entries()) {
            if (summary.hasOverAllocation) {
                const conflictTaskIds = new Set<string>();
                for (const daily of summary.dailyAllocations.values()) {
                    if (daily.isOverAllocated) {
                        daily.taskIds.forEach(tid => conflictTaskIds.add(tid));
                    }
                }
                conflicts.push({
                    resourceId: id,
                    resourceName: summary.resource.name,
                    peakUnits: summary.peakAllocationUnits,
                    maxUnits: summary.resource.maxUnits,
                    conflictingTaskIds: Array.from(conflictTaskIds)
                });
            }
        }
        return conflicts;
    }
}

