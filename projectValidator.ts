import { NormalizedProject, ValidationIssue } from './projectModel';

export class ProjectValidator {
    /**
     * Run all project validation checks and return prioritized issues.
     */
    static validate(project: NormalizedProject): ValidationIssue[] {
        const issues: ValidationIssue[] = [];

        this.validateTaskIds(project, issues);
        this.validateDatesAndDurations(project, issues);
        this.validateDependencies(project, issues);
        this.detectCircularDependencies(project, issues);
        this.validateConstraintsAndDeadlines(project, issues);
        this.validateResourceAssignments(project, issues);

        return issues;
    }

    /**
     * Verify unique task identifiers.
     */
    private static validateTaskIds(project: NormalizedProject, issues: ValidationIssue[]): void {
        const seenIds = new Set<string>();
        for (const task of project.tasks) {
            if (!task.id) {
                issues.push({
                    severity: 'error',
                    code: 'MISSING_TASK_ID',
                    message: `Task at line ${task.lineIndex + 1} has no identifier.`,
                    taskId: task.id
                });
            } else if (seenIds.has(task.id)) {
                issues.push({
                    severity: 'error',
                    code: 'DUPLICATE_TASK_ID',
                    message: `Duplicate task identifier detected: "${task.id}".`,
                    taskId: task.id
                });
            } else {
                seenIds.add(task.id);
            }
        }
    }

    /**
     * Validate date formats and duration consistency.
     */
    private static validateDatesAndDurations(project: NormalizedProject, issues: ValidationIssue[]): void {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

        for (const task of project.tasks) {
            if (task.userStart && !dateRegex.test(task.userStart)) {
                issues.push({
                    severity: 'warning',
                    code: 'INVALID_START_DATE',
                    message: `Task "${task.title}" has invalid start date: "${task.userStart}". Expected YYYY-MM-DD.`,
                    taskId: task.id
                });
            }

            if (task.userFinish && !dateRegex.test(task.userFinish)) {
                issues.push({
                    severity: 'warning',
                    code: 'INVALID_FINISH_DATE',
                    message: `Task "${task.title}" has invalid finish date: "${task.userFinish}". Expected YYYY-MM-DD.`,
                    taskId: task.id
                });
            }

            if (task.isMilestone && task.durationDays !== 0) {
                issues.push({
                    severity: 'warning',
                    code: 'MILESTONE_DURATION_NONZERO',
                    message: `Milestone "${task.title}" has non-zero duration (${task.durationDays}d). Milestones must be 0d.`,
                    taskId: task.id
                });
            }

            if (!task.isMilestone && task.durationDays < 1 && !task.isSummary) {
                issues.push({
                    severity: 'warning',
                    code: 'INVALID_DURATION',
                    message: `Task "${task.title}" has duration less than 1 working day (${task.durationDays}d).`,
                    taskId: task.id
                });
            }
        }
    }

    /**
     * Validate dependency references exist and don't self-reference.
     */
    private static validateDependencies(project: NormalizedProject, issues: ValidationIssue[]): void {
        for (const dep of project.dependencies) {
            if (dep.fromTaskId === dep.toTaskId) {
                issues.push({
                    severity: 'error',
                    code: 'SELF_DEPENDENCY',
                    message: `Task cannot depend on itself (Task "${dep.fromTaskId}").`,
                    taskId: dep.toTaskId,
                    dependencyId: dep.id
                });
            }

            const fromExists = project.taskMap.has(dep.fromTaskId);
            const toExists = project.taskMap.has(dep.toTaskId);

            if (!fromExists) {
                issues.push({
                    severity: 'error',
                    code: 'MISSING_PREDECESSOR',
                    message: `Predecessor task reference "${dep.fromTaskId}" not found.`,
                    taskId: dep.toTaskId,
                    dependencyId: dep.id
                });
            }

            if (!toExists) {
                issues.push({
                    severity: 'error',
                    code: 'MISSING_SUCCESSOR',
                    message: `Successor task reference "${dep.toTaskId}" not found.`,
                    taskId: dep.toTaskId,
                    dependencyId: dep.id
                });
            }
        }
    }

    /**
     * Detect circular dependency loops (e.g. A -> B -> C -> A) using Kahn's algorithm.
     */
    private static detectCircularDependencies(project: NormalizedProject, issues: ValidationIssue[]): void {
        const inDegree = new Map<string, number>();
        const adj = new Map<string, string[]>();

        // Initialize graph for all tasks
        for (const task of project.tasks) {
            inDegree.set(task.id, 0);
            adj.set(task.id, []);
        }

        // Build edges
        for (const dep of project.dependencies) {
            if (project.taskMap.has(dep.fromTaskId) && project.taskMap.has(dep.toTaskId)) {
                adj.get(dep.fromTaskId)!.push(dep.toTaskId);
                inDegree.set(dep.toTaskId, (inDegree.get(dep.toTaskId) || 0) + 1);
            }
        }

        // Kahn's algorithm queue
        const queue: string[] = [];
        inDegree.forEach((deg, id) => {
            if (deg === 0) queue.push(id);
        });

        let processedCount = 0;
        while (queue.length > 0) {
            const curr = queue.shift()!;
            processedCount++;

            for (const neighbor of adj.get(curr) || []) {
                const nextDeg = inDegree.get(neighbor)! - 1;
                inDegree.set(neighbor, nextDeg);
                if (nextDeg === 0) {
                    queue.push(neighbor);
                }
            }
        }

        // If processedCount < total tasks with dependencies, a cycle exists
        if (processedCount < project.tasks.length) {
            const cyclicTaskIds: string[] = [];
            inDegree.forEach((deg, id) => {
                if (deg > 0) cyclicTaskIds.push(id);
            });

            // Reconstruct a specific cycle path for user clarity
            const cyclePath = this.findSpecificCycle(cyclicTaskIds, adj);

            issues.push({
                severity: 'error',
                code: 'CIRCULAR_DEPENDENCY',
                message: `Circular dependency loop detected: ${cyclePath.join(' ➔ ')}.`,
                taskId: cyclicTaskIds[0]
            });
        }
    }

    /**
     * Helper to trace one specific cycle path for descriptive error messages.
     */
    private static findSpecificCycle(cyclicIds: string[], adj: Map<string, string[]>): string[] {
        if (cyclicIds.length === 0) return [];
        const visited = new Set<string>();
        const path: string[] = [];
        const cyclicSet = new Set(cyclicIds);

        const dfs = (curr: string): boolean => {
            if (path.includes(curr)) {
                path.push(curr);
                return true;
            }
            if (visited.has(curr)) return false;

            visited.add(curr);
            path.push(curr);

            for (const next of adj.get(curr) || []) {
                if (cyclicSet.has(next)) {
                    if (dfs(next)) return true;
                }
            }

            path.pop();
            return false;
        };

        for (const startId of cyclicIds) {
            visited.clear();
            path.length = 0;
            if (dfs(startId)) {
                // Trim path to start from the loop start
                const loopStart = path[path.length - 1];
                const firstIdx = path.indexOf(loopStart);
                return path.slice(firstIdx);
            }
        }

        return cyclicIds.slice(0, 4);
    }

    /**
     * Validate constraint dates against logic and deadlines.
     */
    private static validateConstraintsAndDeadlines(project: NormalizedProject, issues: ValidationIssue[]): void {
        for (const task of project.tasks) {
            // SNET or MSO check
            if ((task.constraintType === 'snet' || task.constraintType === 'mso') && !task.constraintDate) {
                issues.push({
                    severity: 'warning',
                    code: 'MISSING_CONSTRAINT_DATE',
                    message: `Task "${task.title}" has constraint "${task.constraintType.toUpperCase()}" but no constraint date specified.`,
                    taskId: task.id
                });
            }

            // Deadline check
            if (task.deadline && task.calculatedFinish && task.calculatedFinish > task.deadline) {
                issues.push({
                    severity: 'warning',
                    code: 'DEADLINE_EXCEEDED',
                    message: `Task "${task.title}" scheduled finish (${task.calculatedFinish}) exceeds deadline (${task.deadline})!`,
                    taskId: task.id
                });
            }
        }
    }

    /**
     * Check resource assignments.
     */
    private static validateResourceAssignments(project: NormalizedProject, issues: ValidationIssue[]): void {
        for (const task of project.tasks) {
            for (const assign of task.assignments) {
                if (assign.units <= 0 || assign.units > 5.0) {
                    issues.push({
                        severity: 'warning',
                        code: 'UNUSUAL_RESOURCE_UNITS',
                        message: `Resource assignment for "${assign.resourceId}" on task "${task.title}" has unusual allocation: ${Math.round(assign.units * 100)}%.`,
                        taskId: task.id
                    });
                }
            }
        }
    }
}
