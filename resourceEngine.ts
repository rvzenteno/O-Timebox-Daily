import { NormalizedProject, NormalizedTask, ResourceDefinition } from './projectModel';
import { ProjectCalendar } from './projectCalendar';

export interface TaskDailyWork {
    taskId: string;
    taskTitle: string;
    wbsCode: string;
    hours: number;
    units: number;
}

export interface DailyResourceAllocation {
    date: string;
    allocatedUnits: number;    // e.g. 1.5 = 150%
    allocatedHours: number;    // e.g. 12h
    capacityHours: number;     // e.g. 8h, or 4h for part-time, or 0 on holidays
    isOverAllocated: boolean;
    taskIds: string[];
    taskWork: TaskDailyWork[]; // Task-level workload breakdown
}

export interface ResourceUsageSummary {
    resource: ResourceDefinition;
    totalWorkHours: number;
    totalCost: number;
    assignedTasks: NormalizedTask[];
    dailyAllocations: Map<string, DailyResourceAllocation>;
    hasOverAllocation: boolean;
    peakAllocationUnits: number;
    peakAllocationHours: number;
    overallUtilizationPercent: number;
}

export class ResourceEngine {
    /**
     * Compute time-phased daily resource allocations, utilization, and flag over-allocated tasks.
     * Uses the resource's specific working hours and calendar rather than hardcoded 8h.
     */
    static analyze(project: NormalizedProject, projectCalendar: ProjectCalendar): Map<string, ResourceUsageSummary> {
        const usageMap = new Map<string, ResourceUsageSummary>();

        // Cache calendars for resource-specific overrides
        const calendarMap = new Map<string, ProjectCalendar>();
        calendarMap.set(projectCalendar.id, projectCalendar);
        for (const calDef of project.calendars) {
            if (!calendarMap.has(calDef.id)) {
                calendarMap.set(calDef.id, ProjectCalendar.fromDefinition(calDef));
            }
        }

        // Initialize resource usage objects for all defined project resources
        for (const res of project.resources) {
            usageMap.set(res.id.toLowerCase(), {
                resource: res,
                totalWorkHours: 0,
                totalCost: 0,
                assignedTasks: [],
                dailyAllocations: new Map(),
                hasOverAllocation: false,
                peakAllocationUnits: 0,
                peakAllocationHours: 0,
                overallUtilizationPercent: 0
            });
        }

        // Helper to find or create resource summary
        const getOrCreateUsage = (resourceIdOrName: string): ResourceUsageSummary => {
            const cleanKey = resourceIdOrName.replace(/^@/, '').toLowerCase();
            let usage = usageMap.get(cleanKey);
            if (usage) return usage;

            // Search by name
            for (const u of usageMap.values()) {
                if (u.resource.name.toLowerCase() === cleanKey || u.resource.id.toLowerCase() === cleanKey) {
                    return u;
                }
            }

            // Auto-create ad-hoc resource entry if not yet defined
            const adHocRes: ResourceDefinition = {
                id: cleanKey,
                name: resourceIdOrName.replace(/^@/, ''),
                type: 'Work',
                maxUnits: 1.0,
                workingHoursPerDay: projectCalendar.hoursPerDay,
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
                peakAllocationUnits: 0,
                peakAllocationHours: 0,
                overallUtilizationPercent: 0
            };
            usageMap.set(cleanKey, usage);
            return usage;
        };

        // Iterate through all active non-summary tasks with assignments
        for (const task of project.tasks) {
            if (task.isSummary || task.completed) continue;
            task.isOverAllocated = false;

            for (const assignment of task.assignments) {
                const usage = getOrCreateUsage(assignment.resourceId);
                const res = usage.resource;

                // Resolve the applicable calendar and working hours for this resource
                const resCalendar = (res.calendarId && calendarMap.get(res.calendarId)) || projectCalendar;
                const hoursPerDay = res.workingHoursPerDay !== undefined && res.workingHoursPerDay > 0
                    ? res.workingHoursPerDay
                    : resCalendar.hoursPerDay;

                if (!usage.assignedTasks.some(t => t.id === task.id)) {
                    usage.assignedTasks.push(task);
                }

                const isMaterialOrCost = res.type === 'Material' || res.type === 'Cost';

                if (isMaterialOrCost) {
                    // Material/Cost resources: cost is per use or fixed rate; work hours are 0
                    const unitCost = res.costPerUse !== undefined ? res.costPerUse : (res.ratePerHour || 0);
                    usage.totalCost += unitCost * (assignment.units || 1);
                    continue;
                }

                // Work Resource calculation
                const assignedHours = task.durationDays * hoursPerDay * assignment.units;
                usage.totalWorkHours += assignedHours;
                usage.totalCost += assignedHours * (res.ratePerHour || 0);

                // Distribute hours across each working day in the task's schedule
                if (task.calculatedStart && task.calculatedFinish) {
                    const intervals = resCalendar.getWorkingIntervals(task.calculatedStart, task.calculatedFinish);
                    for (const intv of intervals) {
                        const cur = new Date(intv.start + 'T00:00:00Z');
                        const end = new Date(intv.end + 'T00:00:00Z');

                        while (cur.getTime() <= end.getTime()) {
                            const curDate = cur.toISOString().slice(0, 10);
                            const isWorkDay = resCalendar.isWorkingDay(curDate);

                            if (isWorkDay) {
                                let daily = usage.dailyAllocations.get(curDate);
                                const dailyCapHours = hoursPerDay * (res.maxUnits || 1.0);

                                if (!daily) {
                                    daily = {
                                        date: curDate,
                                        allocatedUnits: 0,
                                        allocatedHours: 0,
                                        capacityHours: dailyCapHours,
                                        isOverAllocated: false,
                                        taskIds: [],
                                        taskWork: []
                                    };
                                    usage.dailyAllocations.set(curDate, daily);
                                }

                                const taskDailyHours = hoursPerDay * assignment.units;
                                daily.allocatedUnits += assignment.units;
                                daily.allocatedHours += taskDailyHours;

                                if (!daily.taskIds.includes(task.id)) {
                                    daily.taskIds.push(task.id);
                                }

                                daily.taskWork.push({
                                    taskId: task.id,
                                    taskTitle: task.title,
                                    wbsCode: task.wbsCode,
                                    hours: Math.round(taskDailyHours * 10) / 10,
                                    units: assignment.units
                                });

                                if (daily.allocatedUnits > usage.peakAllocationUnits) {
                                    usage.peakAllocationUnits = daily.allocatedUnits;
                                }
                                if (daily.allocatedHours > usage.peakAllocationHours) {
                                    usage.peakAllocationHours = daily.allocatedHours;
                                }

                                if (daily.allocatedUnits > (res.maxUnits || 1.0) || daily.allocatedHours > daily.capacityHours) {
                                    daily.isOverAllocated = true;
                                    usage.hasOverAllocation = true;
                                    task.isOverAllocated = true;
                                }
                            }
                            cur.setUTCDate(cur.getUTCDate() + 1);
                        }
                    }
                }
            }
        }

        // Calculate overall utilization % for each resource across project duration
        const projectStart = project.projectStartDate || new Date().toISOString().slice(0, 10);
        const projectFinish = project.projectFinishDate || projectStart;

        for (const usage of usageMap.values()) {
            const res = usage.resource;
            const resCalendar = (res.calendarId && calendarMap.get(res.calendarId)) || projectCalendar;
            const hoursPerDay = res.workingHoursPerDay !== undefined && res.workingHoursPerDay > 0
                ? res.workingHoursPerDay
                : resCalendar.hoursPerDay;
            const workingDays = resCalendar.calculateWorkingDays(projectStart, projectFinish);
            const totalCapacity = workingDays * hoursPerDay * (res.maxUnits || 1.0);

            usage.overallUtilizationPercent = totalCapacity > 0
                ? Math.round((usage.totalWorkHours / totalCapacity) * 100)
                : 0;
            usage.totalWorkHours = Math.round(usage.totalWorkHours * 10) / 10;
            usage.totalCost = Math.round(usage.totalCost * 100) / 100;
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
        peakHours: number;
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
            peakHours: number;
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
                    peakHours: summary.peakAllocationHours,
                    maxUnits: summary.resource.maxUnits,
                    conflictingTaskIds: Array.from(conflictTaskIds)
                });
            }
        }
        return conflicts;
    }

    /**
     * Calculate time-phased daily allocations and utilization for a specific resource across [startDate, endDate].
     */
    static calculateDailyAllocations(
        project: NormalizedProject,
        resourceId: string,
        startDate: string,
        endDate: string
    ): Array<DailyResourceAllocation & { assignedHours: number; utilizationPercent: number }> {
        const cal = ProjectCalendar.fromDefinition(
            project.calendars.find(c => c.id === project.activeCalendarId) || ProjectCalendar.createStandardCalendar().toDefinition()
        );
        const usageMap = this.analyze(project, cal);
        const cleanKey = resourceId.replace(/^@/, '').toLowerCase();
        let summary = usageMap.get(cleanKey);
        if (!summary) {
            for (const u of usageMap.values()) {
                if (u.resource.id.toLowerCase() === cleanKey || u.resource.name.toLowerCase() === cleanKey) {
                    summary = u;
                    break;
                }
            }
        }

        const res = summary?.resource || project.resources.find(r => r.id.toLowerCase() === cleanKey);
        const resCal = (res?.calendarId && ProjectCalendar.fromDefinition(project.calendars.find(c => c.id === res.calendarId)!)) || cal;
        const hoursPerDay = res?.workingHoursPerDay !== undefined && res.workingHoursPerDay > 0
            ? res.workingHoursPerDay
            : resCal.hoursPerDay;
        const maxUnits = res?.maxUnits || 1.0;
        const normalDailyCap = hoursPerDay * maxUnits;

        const results: Array<DailyResourceAllocation & { assignedHours: number; utilizationPercent: number }> = [];
        const cur = new Date(startDate + 'T00:00:00Z');
        const end = new Date(endDate + 'T00:00:00Z');

        while (cur.getTime() <= end.getTime()) {
            const dateStr = cur.toISOString().slice(0, 10);
            const isWorkDay = resCal.isWorkingDay(dateStr);
            const daily = summary?.dailyAllocations.get(dateStr);

            const allocatedHours = daily ? daily.allocatedHours : 0;
            const capacityHours = isWorkDay ? normalDailyCap : 0;
            const utilizationPercent = capacityHours > 0 ? Math.round((allocatedHours / capacityHours) * 100) : (allocatedHours > 0 ? 999 : 0);

            results.push({
                date: dateStr,
                allocatedUnits: daily ? daily.allocatedUnits : 0,
                allocatedHours,
                assignedHours: allocatedHours,
                capacityHours,
                isOverAllocated: daily ? daily.isOverAllocated : (allocatedHours > capacityHours),
                taskIds: daily ? daily.taskIds : [],
                taskWork: daily ? daily.taskWork : [],
                utilizationPercent
            });

            cur.setUTCDate(cur.getUTCDate() + 1);
        }

        return results;
    }
}

