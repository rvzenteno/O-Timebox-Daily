/**
 * projectCommandManager.ts
 *
 * Implements an Undo/Redo Command pattern for all project mutations.
 * Supports task updates, date shifts, duration resizing, dependency management,
 * indent/outdent (WBS tree manipulation), task addition/deletion, resource assignments,
 * and baseline snapshots.
 */

import { NormalizedProject, NormalizedTask, TaskDependency, ProjectBaseline } from './projectModel';

export interface ProjectCommand {
    id: string;
    description: string;
    execute(project: NormalizedProject): NormalizedProject;
    undo(project: NormalizedProject): NormalizedProject;
}

/**
 * Deep clones a project object to guarantee state immutability when capturing snapshots
 */
export function cloneProject(project: NormalizedProject): NormalizedProject {
    const clone: NormalizedProject = JSON.parse(JSON.stringify(project, (key, value) => {
        if (value instanceof Map) {
            return Array.from(value.entries());
        }
        return value;
    }));
    // Rebuild taskMap
    clone.taskMap = new Map<string, NormalizedTask>();
    for (const t of clone.tasks) {
        clone.taskMap.set(t.id, t);
    }
    return clone;
}

/**
 * Updates a specific field on a task
 */
export class UpdateTaskFieldCommand implements ProjectCommand {
    id = 'update-task-field';
    constructor(
        public taskId: string,
        public field: keyof NormalizedTask,
        public oldValue: any,
        public newValue: any,
        public description: string = `Update task ${String(field)}`
    ) {}

    execute(project: NormalizedProject): NormalizedProject {
        const task = project.tasks.find(t => t.id === this.taskId);
        if (task) {
            (task as any)[this.field] = this.newValue;
        }
        return project;
    }

    undo(project: NormalizedProject): NormalizedProject {
        const task = project.tasks.find(t => t.id === this.taskId);
        if (task) {
            (task as any)[this.field] = this.oldValue;
        }
        return project;
    }
}

/**
 * Moves a task's userStart date (drag-to-move in Gantt)
 */
export class MoveTaskCommand implements ProjectCommand {
    id = 'move-task';
    constructor(
        public taskId: string,
        public oldStart: string | undefined,
        public newStart: string,
        public oldConstraintType?: any,
        public description: string = 'Move task'
    ) {}

    execute(project: NormalizedProject): NormalizedProject {
        const task = project.tasks.find(t => t.id === this.taskId);
        if (task) {
            task.userStart = this.newStart;
            // When user drags a task to a specific date, set SNET (Start No Earlier Than)
            if (!task.constraintType || task.constraintType === 'asap') {
                task.constraintType = 'snet';
                task.constraintDate = this.newStart;
            }
        }
        return project;
    }

    undo(project: NormalizedProject): NormalizedProject {
        const task = project.tasks.find(t => t.id === this.taskId);
        if (task) {
            task.userStart = this.oldStart;
            task.constraintType = this.oldConstraintType;
            task.constraintDate = this.oldStart;
        }
        return project;
    }
}

/**
 * Resizes a task's duration (drag-to-resize in Gantt)
 */
export class ResizeTaskDurationCommand implements ProjectCommand {
    id = 'resize-task';
    constructor(
        public taskId: string,
        public oldDuration: number,
        public newDuration: number,
        public description: string = 'Resize task duration'
    ) {}

    execute(project: NormalizedProject): NormalizedProject {
        const task = project.tasks.find(t => t.id === this.taskId);
        if (task) {
            task.durationDays = Math.max(0, this.newDuration);
            task.isMilestone = task.durationDays === 0;
            task.workHours = task.durationDays * 8;
        }
        return project;
    }

    undo(project: NormalizedProject): NormalizedProject {
        const task = project.tasks.find(t => t.id === this.taskId);
        if (task) {
            task.durationDays = Math.max(0, this.oldDuration);
            task.isMilestone = task.durationDays === 0;
            task.workHours = task.durationDays * 8;
        }
        return project;
    }
}

/**
 * Adds a new dependency between tasks
 */
export class AddDependencyCommand implements ProjectCommand {
    id = 'add-dependency';
    public dependency: TaskDependency;
    public description: string;

    constructor(
        depOrFrom: TaskDependency | string,
        toTaskId?: string,
        type: 'FS' | 'SS' | 'FF' | 'SF' = 'FS',
        lag: number = 0,
        description?: string
    ) {
        if (typeof depOrFrom === 'object') {
            this.dependency = depOrFrom;
            this.description = description || `Add dependency ${this.dependency.fromTaskId} -> ${this.dependency.toTaskId}`;
        } else {
            this.dependency = {
                id: `dep-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                fromTaskId: depOrFrom,
                toTaskId: toTaskId || '',
                type: type,
                lag: lag || 0
            };
            this.description = description || `Add dependency ${depOrFrom} -> ${toTaskId}`;
        }
    }

    execute(project: NormalizedProject): NormalizedProject {
        const exists = project.dependencies.some(
            d => d.fromTaskId === this.dependency.fromTaskId && d.toTaskId === this.dependency.toTaskId
        );
        if (!exists) {
            project.dependencies.push({ ...this.dependency });
        }
        return project;
    }

    undo(project: NormalizedProject): NormalizedProject {
        project.dependencies = project.dependencies.filter(
            d => !(d.fromTaskId === this.dependency.fromTaskId && d.toTaskId === this.dependency.toTaskId)
        );
        return project;
    }
}

/**
 * Removes an existing dependency
 */
export class RemoveDependencyCommand implements ProjectCommand {
    id = 'remove-dependency';
    private removedDep?: TaskDependency;

    constructor(
        public fromTaskId: string,
        public toTaskId: string,
        public description: string = `Remove dependency ${fromTaskId} -> ${toTaskId}`
    ) {}

    execute(project: NormalizedProject): NormalizedProject {
        const idx = project.dependencies.findIndex(
            d => d.fromTaskId === this.fromTaskId && d.toTaskId === this.toTaskId
        );
        if (idx !== -1) {
            this.removedDep = project.dependencies[idx];
            project.dependencies.splice(idx, 1);
        }
        return project;
    }

    undo(project: NormalizedProject): NormalizedProject {
        if (this.removedDep) {
            project.dependencies.push({ ...this.removedDep });
        }
        return project;
    }
}

/**
 * Indents a task (makes it a subtask of the preceding sibling)
 */
export class IndentTaskCommand implements ProjectCommand {
    id = 'indent-task';
    constructor(
        public taskId: string,
        public description: string = 'Indent task'
    ) {}

    execute(project: NormalizedProject): NormalizedProject {
        const index = project.tasks.findIndex(t => t.id === this.taskId);
        if (index <= 0) return project;

        const currentTask = project.tasks[index];
        const prevTask = project.tasks[index - 1];

        // Prev task becomes parent
        currentTask.parentId = prevTask.id;
        currentTask.depth = prevTask.depth + 1;
        if (!prevTask.childIds.includes(currentTask.id)) {
            prevTask.childIds.push(currentTask.id);
        }
        prevTask.isSummary = true;

        return project;
    }

    undo(project: NormalizedProject): NormalizedProject {
        const index = project.tasks.findIndex(t => t.id === this.taskId);
        if (index <= 0) return project;

        const currentTask = project.tasks[index];
        const prevTask = project.tasks[index - 1];

        currentTask.parentId = prevTask.parentId;
        currentTask.depth = prevTask.depth;
        prevTask.childIds = prevTask.childIds.filter(id => id !== currentTask.id);

        const hasChildren = project.tasks.some(t => t.parentId === prevTask.id && t.id !== currentTask.id);
        if (!hasChildren) {
            prevTask.isSummary = false;
        }

        return project;
    }
}

/**
 * Outdents a task (moves it one level up in hierarchy)
 */
export class OutdentTaskCommand implements ProjectCommand {
    id = 'outdent-task';
    private originalParentId?: string;
    private originalDepth: number = 0;

    constructor(
        public taskId: string,
        public description: string = 'Outdent task'
    ) {}

    execute(project: NormalizedProject): NormalizedProject {
        const task = project.tasks.find(t => t.id === this.taskId);
        if (!task || task.depth === 0) return project;

        this.originalParentId = task.parentId;
        this.originalDepth = task.depth;

        const parent = project.tasks.find(t => t.id === task.parentId);
        if (parent) {
            parent.childIds = parent.childIds.filter(id => id !== task.id);
            task.parentId = parent.parentId;
            task.depth = parent.depth;

            const stillHasChildren = project.tasks.some(t => t.parentId === parent.id && t.id !== task.id);
            if (!stillHasChildren) {
                parent.isSummary = false;
            }
        } else {
            task.parentId = undefined;
            task.depth = 0;
        }

        return project;
    }

    undo(project: NormalizedProject): NormalizedProject {
        const task = project.tasks.find(t => t.id === this.taskId);
        if (!task) return project;

        task.parentId = this.originalParentId;
        task.depth = this.originalDepth;

        if (this.originalParentId) {
            const parent = project.tasks.find(t => t.id === this.originalParentId);
            if (parent) {
                if (!parent.childIds.includes(task.id)) {
                    parent.childIds.push(task.id);
                }
                parent.isSummary = true;
            }
        }

        return project;
    }
}

/**
 * Adds a new task to the project
 */
export class AddTaskCommand implements ProjectCommand {
    id = 'add-task';
    constructor(
        public task: NormalizedTask,
        public insertAfterIndex?: number,
        public description: string = 'Add task'
    ) {}

    execute(project: NormalizedProject): NormalizedProject {
        if (this.insertAfterIndex !== undefined && this.insertAfterIndex >= 0 && this.insertAfterIndex < project.tasks.length) {
            project.tasks.splice(this.insertAfterIndex + 1, 0, this.task);
        } else {
            project.tasks.push(this.task);
        }
        project.taskMap.set(this.task.id, this.task);
        return project;
    }

    undo(project: NormalizedProject): NormalizedProject {
        project.tasks = project.tasks.filter(t => t.id !== this.task.id);
        project.taskMap.delete(this.task.id);
        return project;
    }
}

/**
 * Deletes a task from the project
 */
export class DeleteTaskCommand implements ProjectCommand {
    id = 'delete-task';
    private deletedIndex: number = -1;
    private deletedTask?: NormalizedTask;
    private deletedDependencies: TaskDependency[] = [];

    constructor(
        public taskId: string,
        public description: string = 'Delete task'
    ) {}

    execute(project: NormalizedProject): NormalizedProject {
        this.deletedIndex = project.tasks.findIndex(t => t.id === this.taskId);
        if (this.deletedIndex === -1) return project;

        this.deletedTask = project.tasks[this.deletedIndex];

        // Track and remove any dependencies involving this task
        this.deletedDependencies = project.dependencies.filter(
            d => d.fromTaskId === this.taskId || d.toTaskId === this.taskId
        );
        project.dependencies = project.dependencies.filter(
            d => d.fromTaskId !== this.taskId && d.toTaskId !== this.taskId
        );

        project.tasks.splice(this.deletedIndex, 1);
        project.taskMap.delete(this.taskId);
        return project;
    }

    undo(project: NormalizedProject): NormalizedProject {
        if (this.deletedIndex !== -1 && this.deletedTask) {
            project.tasks.splice(this.deletedIndex, 0, this.deletedTask);
            project.taskMap.set(this.deletedTask.id, this.deletedTask);

            // Restore dependencies
            for (const dep of this.deletedDependencies) {
                project.dependencies.push(dep);
            }
        }
        return project;
    }
}

/**
 * Saves a baseline snapshot
 */
export class SaveBaselineCommand implements ProjectCommand {
    id = 'save-baseline';
    private previousBaseline?: ProjectBaseline;

    constructor(
        public baselineId: string,
        public newBaseline: ProjectBaseline,
        public description: string = `Save Baseline ${baselineId}`
    ) {}

    execute(project: NormalizedProject): NormalizedProject {
        if (!project.baselines) project.baselines = {};
        this.previousBaseline = project.baselines[this.baselineId];
        project.baselines[this.baselineId] = this.newBaseline;
        return project;
    }

    undo(project: NormalizedProject): NormalizedProject {
        if (project.baselines) {
            if (this.previousBaseline) {
                project.baselines[this.baselineId] = this.previousBaseline;
            } else {
                delete project.baselines[this.baselineId];
            }
        }
        return project;
    }
}

/**
 * Composite / Batch Command to bundle multiple actions into a single atomic undo/redo step
 */
export class BatchCommand implements ProjectCommand {
    id = 'batch-command';
    constructor(
        public description: string,
        public commands: ProjectCommand[]
    ) {}

    execute(project: NormalizedProject): NormalizedProject {
        for (const cmd of this.commands) {
            project = cmd.execute(project);
        }
        return project;
    }

    undo(project: NormalizedProject): NormalizedProject {
        for (let i = this.commands.length - 1; i >= 0; i--) {
            project = this.commands[i].undo(project);
        }
        return project;
    }
}

/**
 * Project Command Manager managing undo and redo history
 */
export class ProjectCommandManager {
    private undoStack: ProjectCommand[] = [];
    private redoStack: ProjectCommand[] = [];
    private maxHistory: number = 100;
    private listeners: (() => void)[] = [];

    constructor(maxHistory: number = 100) {
        this.maxHistory = maxHistory;
    }

    onStateChange(fn: () => void): () => void {
        this.listeners.push(fn);
        return () => {
            this.listeners = this.listeners.filter(l => l !== fn);
        };
    }

    private notify() {
        for (const listener of this.listeners) {
            listener();
        }
    }

    canUndo(): boolean {
        return this.undoStack.length > 0;
    }

    canRedo(): boolean {
        return this.redoStack.length > 0;
    }

    getUndoDescription(): string | null {
        return this.undoStack.length > 0 ? this.undoStack[this.undoStack.length - 1].description : null;
    }

    getRedoDescription(): string | null {
        return this.redoStack.length > 0 ? this.redoStack[this.redoStack.length - 1].description : null;
    }

    execute(command: ProjectCommand, project: NormalizedProject): NormalizedProject {
        const modified = command.execute(project);
        this.undoStack.push(command);
        if (this.undoStack.length > this.maxHistory) {
            this.undoStack.shift();
        }
        this.redoStack = []; // Clear redo on new action
        this.notify();
        return modified;
    }

    undo(project: NormalizedProject): NormalizedProject | null {
        if (!this.canUndo()) return null;
        const command = this.undoStack.pop()!;
        const reverted = command.undo(project);
        this.redoStack.push(command);
        this.notify();
        return reverted;
    }

    redo(project: NormalizedProject): NormalizedProject | null {
        if (!this.canRedo()) return null;
        const command = this.redoStack.pop()!;
        const applied = command.execute(project);
        this.undoStack.push(command);
        this.notify();
        return applied;
    }

    clear() {
        this.undoStack = [];
        this.redoStack = [];
        this.notify();
    }
}

