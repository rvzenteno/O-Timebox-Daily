import { App, ItemView, WorkspaceLeaf, TFile, setIcon, Modal, Setting } from 'obsidian';
import { ProjectManager, ProjectData, ProjectTask } from './projectManager';
import TimeBoxPlugin from './main';

export const TIMEBOX_PROJECT_VIEW_TYPE = 'timebox-project-dashboard';

export class ProjectDashboardView extends ItemView {
    plugin: TimeBoxPlugin;
    projectManager: ProjectManager;

    private isRendering = false;
    private renderRequested = false;
    private renderDebounceTimer: NodeJS.Timeout | null = null;
    private draggedTaskIndex: number | null = null;
    private draggedProjectFilePath: string | null = null;

    constructor(leaf: WorkspaceLeaf, plugin: TimeBoxPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.projectManager = new ProjectManager(this.app);
    }

    getViewType(): string {
        return TIMEBOX_PROJECT_VIEW_TYPE;
    }

    getDisplayText(): string {
        return 'TimeBox Projects';
    }

    getIcon(): string {
        return 'kanban';
    }

    async onOpen(): Promise<void> {
        await this.render();

        this.registerEvent(
            this.app.vault.on('modify', (file) => {
                if (file instanceof TFile) {
                    if (this.projectManager.isInternalModification(file.path)) return;
                    this.debouncedRender();
                }
            })
        );
    }

    debouncedRender(): void {
        if (this.renderDebounceTimer) {
            clearTimeout(this.renderDebounceTimer);
        }
        this.renderDebounceTimer = setTimeout(() => {
            void this.render();
        }, 300);
    }

    async render(): Promise<void> {
        if (this.isRendering) {
            this.renderRequested = true;
            return;
        }
        this.isRendering = true;

        try {
            const projectsData = await this.projectManager.getAllProjectsData(this.plugin.settings.projectsFolder);

            const container = this.contentEl;
            container.empty();
            container.addClass('timebox-dashboard-container');

            // Header
            const headerEl = container.createDiv({ cls: 'timebox-dashboard-header' });
            headerEl.createEl('h4', { text: '🗂 Projects Dashboard' });

            const actionsEl = headerEl.createDiv({ cls: 'timebox-dashboard-actions' });
            
            const isHiding = this.plugin.settings.hideCompletedProjectTasks;
            const toggleCompletedBtn = actionsEl.createEl('button', {
                cls: 'clickable-icon',
                title: isHiding ? 'Show completed tasks' : 'Hide completed tasks'
            });
            setIcon(toggleCompletedBtn, isHiding ? 'eye-off' : 'eye');
            toggleCompletedBtn.addEventListener('click', () => {
                void (async () => {
                    this.plugin.settings.hideCompletedProjectTasks = !this.plugin.settings.hideCompletedProjectTasks;
                    await this.plugin.saveSettings();
                    void this.render();
                })();
            });

            const refreshBtn = actionsEl.createEl('button', { cls: 'clickable-icon', title: 'Refresh dashboard' });
            setIcon(refreshBtn, 'refresh-cw');
            refreshBtn.addEventListener('click', () => {
                void this.render();
            });

            const newProjBtn = actionsEl.createEl('button', { cls: 'timebox-btn-primary', text: '+ New Project' });
            newProjBtn.addEventListener('click', () => {
                void this.promptCreateProject();
            });

            // Projects List
            if (projectsData.length === 0) {
                const emptyEl = container.createDiv({ cls: 'timebox-dashboard-empty' });
                emptyEl.createEl('p', { text: `No project notes found in "${this.plugin.settings.projectsFolder}" folder.` });
                const createFirstBtn = emptyEl.createEl('button', { text: 'Create First Project' });
                createFirstBtn.addEventListener('click', () => {
                    void this.promptCreateProject();
                });
                return;
            }

            const projectListEl = container.createDiv({ cls: 'timebox-project-list' });

            for (const proj of projectsData) {
                this.renderProjectCard(projectListEl, proj);
            }
        } finally {
            this.isRendering = false;
            if (this.renderRequested) {
                this.renderRequested = false;
                void this.render();
            }
        }
    }

    renderProjectCard(parentEl: HTMLElement, proj: ProjectData): void {
        const cardEl = parentEl.createDiv({ cls: 'timebox-project-card' });

        // Card Header
        const cardHeader = cardEl.createDiv({ cls: 'timebox-project-header' });
        const titleEl = cardHeader.createEl('a', { cls: 'timebox-project-title', text: proj.name });
        titleEl.addEventListener('click', () => {
            void (async () => {
                const leaf = this.app.workspace.getLeaf(false);
                await leaf.openFile(proj.file);
            })();
        });

        cardHeader.createSpan({
            cls: 'timebox-project-meta',
            text: `${proj.completedCount}/${proj.totalCount} completed (${proj.progressPercent}%)`
        });

        // Progress Bar
        const progressContainer = cardEl.createDiv({ cls: 'timebox-progress-container' });
        const progressFill = progressContainer.createDiv({ cls: 'timebox-progress-fill' });
        progressFill.style.width = `${proj.progressPercent}%`;

        // Tasks List
        const tasksContainer = cardEl.createDiv({ cls: 'timebox-project-tasks' });

        const tasksToDisplay = this.plugin.settings.hideCompletedProjectTasks
            ? proj.tasks.filter(t => !t.completed)
            : proj.tasks;

        if (tasksToDisplay.length === 0) {
            const msg = proj.tasks.length > 0 && this.plugin.settings.hideCompletedProjectTasks
                ? 'All tasks completed! (Click 👁 to view completed)'
                : 'No checklist tasks found in this project.';
            tasksContainer.createDiv({ cls: 'timebox-task-empty', text: msg });
        } else {
            tasksToDisplay.forEach((task, topLevelIndex) => {
                this.renderTaskRow(tasksContainer, proj, task, topLevelIndex);
            });
        }

        // Quick add task row
        const addRow = cardEl.createDiv({ cls: 'timebox-quick-add-row' });
        const input = addRow.createEl('input', {
            type: 'text',
            placeholder: 'Add task to project...'
        });

        const addBtn = addRow.createEl('button', { text: 'Add' });
        const handleAdd = async () => {
            const val = input.value.trim();
            if (val) {
                await this.projectManager.addTaskToProject(proj.file, val);
                input.value = '';
                void this.render();
            }
        };

        addBtn.addEventListener('click', () => {
            void handleAdd();
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                void handleAdd();
            }
        });
    }

    private expandedSubtasks: Set<string> = new Set();
    private activeSubtaskInputs: Set<string> = new Set();

    renderTaskRow(containerEl: HTMLElement, proj: ProjectData, task: ProjectTask, topLevelIndex: number): void {
        const taskKey = `${proj.file.path}::${task.lineIndex}`;
        const hasSubtasks = task.subtasks && task.subtasks.length > 0;
        
        // Auto-expand subtasks by default if present unless user explicitly collapsed
        if (hasSubtasks && !this.expandedSubtasks.has(`collapsed::${taskKey}`)) {
            this.expandedSubtasks.add(taskKey);
        }

        const isSubtasksExpanded = this.expandedSubtasks.has(taskKey);
        const isInputActive = this.activeSubtaskInputs.has(taskKey);

        const taskBlockEl = containerEl.createDiv({ cls: 'timebox-task-block' });
        const taskRow = taskBlockEl.createDiv({
            cls: `timebox-task-row ${task.completed ? 'is-completed' : ''}`
        });

        // 6-Dot Drag Handle Icon
        taskRow.setAttribute('draggable', 'true');
        const dragHandle = taskRow.createDiv({
            cls: 'timebox-drag-handle',
            title: 'Drag handle (⋮⋮) to reorder task'
        });
        setIcon(dragHandle, 'grip-vertical');

        // Drag & Drop Event Handlers
        taskRow.addEventListener('dragstart', (e) => {
            this.draggedTaskIndex = topLevelIndex;
            this.draggedProjectFilePath = proj.file.path;
            taskRow.addClass('is-dragging');
            if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', `${topLevelIndex}`);
            }
        });

        taskRow.addEventListener('dragend', () => {
            taskRow.removeClass('is-dragging');
            this.draggedTaskIndex = null;
            this.draggedProjectFilePath = null;
        });

        taskRow.addEventListener('dragover', (e) => {
            if (this.draggedProjectFilePath === proj.file.path && this.draggedTaskIndex !== null) {
                e.preventDefault();
                taskRow.addClass('drop-target');
            }
        });

        taskRow.addEventListener('dragleave', () => {
            taskRow.removeClass('drop-target');
        });

        taskRow.addEventListener('drop', (e) => {
            e.preventDefault();
            taskRow.removeClass('drop-target');

            if (
                this.draggedProjectFilePath === proj.file.path &&
                this.draggedTaskIndex !== null &&
                this.draggedTaskIndex !== topLevelIndex
            ) {
                const src = this.draggedTaskIndex;
                const tgt = topLevelIndex;
                void (async () => {
                    await this.projectManager.reorderProjectTasks(proj.file, src, tgt);
                    void this.render();
                })();
            }
        });

        // Expand / Collapse Chevron Button (if task has subtasks)
        if (hasSubtasks) {
            const toggleSubtasksBtn = taskRow.createEl('button', {
                cls: 'timebox-task-icon-btn timebox-toggle-subtasks-btn',
                title: isSubtasksExpanded ? 'Hide subtasks' : 'Show subtasks'
            });
            setIcon(toggleSubtasksBtn, isSubtasksExpanded ? 'chevron-down' : 'chevron-right');
            toggleSubtasksBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (isSubtasksExpanded) {
                    this.expandedSubtasks.delete(taskKey);
                    this.expandedSubtasks.add(`collapsed::${taskKey}`);
                } else {
                    this.expandedSubtasks.add(taskKey);
                    this.expandedSubtasks.delete(`collapsed::${taskKey}`);
                }
                void this.render();
            });
        }

        // Checkbox
        const checkbox = taskRow.createEl('input', { type: 'checkbox' });
        checkbox.checked = task.completed;
        checkbox.addEventListener('change', () => {
            void (async () => {
                await this.projectManager.syncTaskCompletion(
                    proj.file,
                    task.text,
                    checkbox.checked,
                    this.plugin.settings.projectsFolder,
                    this.plugin.settings.timeBoxFolder
                );
                void this.render();
            })();
        });

        // Task Text & Count Badge
        const textWrapper = taskRow.createSpan({ cls: 'timebox-task-text' });
        textWrapper.createSpan({ text: task.text });

        if (hasSubtasks) {
            const completedSubCount = task.subtasks.filter(s => s.completed).length;
            textWrapper.createSpan({
                cls: 'timebox-subtask-count-badge',
                text: ` (${completedSubCount}/${task.subtasks.length})`
            });
        }

        // Action Buttons Group
        const actionsGroup = taskRow.createDiv({ cls: 'timebox-task-actions' });

        if (!task.completed) {
            const addToTodayBtn = actionsGroup.createEl('button', {
                cls: 'timebox-task-today-btn',
                text: '+ Today',
                title: "Add task to today's TimeBox note"
            });

            addToTodayBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                void (async () => {
                    await this.projectManager.addProjectTaskToToday(
                        task.text,
                        proj.file,
                        this.plugin.settings.timeBoxFolder,
                        this.plugin.settings.dateFormat
                    );
                })();
            });
        }

        // Add Subtask Button (Positioned right BEFORE delete button)
        const addSubtaskIconBtn = actionsGroup.createEl('button', {
            cls: `timebox-task-icon-btn timebox-add-subtask-btn ${isInputActive ? 'is-active' : ''}`,
            title: 'Add subtask'
        });
        setIcon(addSubtaskIconBtn, 'list-plus');
        addSubtaskIconBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.expandedSubtasks.add(taskKey);
            this.expandedSubtasks.delete(`collapsed::${taskKey}`);

            if (this.activeSubtaskInputs.has(taskKey)) {
                this.activeSubtaskInputs.delete(taskKey);
            } else {
                this.activeSubtaskInputs.add(taskKey);
            }
            void this.render();
        });

        // Delete Button (🗑️)
        const deleteBtn = actionsGroup.createEl('button', {
            cls: 'timebox-task-icon-btn timebox-delete-btn',
            title: 'Delete task'
        });
        setIcon(deleteBtn, 'trash-2');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            void (async () => {
                await this.projectManager.deleteTaskFromProject(proj.file, task);
                void this.render();
            })();
        });

        // Nested Subtasks Container
        const subtasksContainer = taskBlockEl.createDiv({ cls: 'timebox-subtasks-container' });
        if (!isSubtasksExpanded && !isInputActive) {
            subtasksContainer.style.display = 'none';
        }

        if (hasSubtasks && isSubtasksExpanded) {
            const subtasksToDisplay = this.plugin.settings.hideCompletedProjectTasks
                ? task.subtasks.filter(st => !st.completed)
                : task.subtasks;

            for (const subtask of subtasksToDisplay) {
                const subtaskRow = subtasksContainer.createDiv({
                    cls: `timebox-subtask-row ${subtask.completed ? 'is-completed' : ''}`
                });

                const subCheckbox = subtaskRow.createEl('input', { type: 'checkbox' });
                subCheckbox.checked = subtask.completed;
                subCheckbox.addEventListener('change', () => {
                    void (async () => {
                        await this.projectManager.syncTaskCompletion(
                            proj.file,
                            subtask.text,
                            subCheckbox.checked,
                            this.plugin.settings.projectsFolder,
                            this.plugin.settings.timeBoxFolder
                        );
                        void this.render();
                    })();
                });

                subtaskRow.createSpan({ cls: 'timebox-subtask-text', text: subtask.text });

                const subDeleteBtn = subtaskRow.createEl('button', {
                    cls: 'timebox-task-icon-btn timebox-delete-btn',
                    title: 'Delete subtask'
                });
                setIcon(subDeleteBtn, 'trash-2');
                subDeleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    void (async () => {
                        await this.projectManager.deleteTaskFromProject(proj.file, subtask);
                        void this.render();
                    })();
                });
            }
        }

        // Add Subtask Row (Only rendered/visible when 'Add subtask' button is active)
        if (isInputActive) {
            const addSubtaskRow = subtasksContainer.createDiv({ cls: 'timebox-quick-add-subtask-row' });
            const subInput = addSubtaskRow.createEl('input', {
                type: 'text',
                placeholder: '+ Add subtask...'
            });
            const subAddBtn = addSubtaskRow.createEl('button', { text: 'Add' });

            setTimeout(() => subInput.focus(), 50);

            const handleAddSubtask = async () => {
                const val = subInput.value.trim();
                if (val) {
                    await this.projectManager.addSubtaskToProject(proj.file, task.lineIndex, val);
                    subInput.value = '';
                    this.activeSubtaskInputs.delete(taskKey);
                    void this.render();
                }
            };

            subAddBtn.addEventListener('click', () => {
                void handleAddSubtask();
            });
            subInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    void handleAddSubtask();
                } else if (e.key === 'Escape') {
                    this.activeSubtaskInputs.delete(taskKey);
                    void this.render();
                }
            });
        }
    }

    async promptCreateProject(): Promise<void> {
        const modal = new (class extends Modal {
            resultName = '';
            onSubmit: (name: string) => void;

            constructor(app: App, onSubmit: (name: string) => void) {
                super(app);
                this.onSubmit = onSubmit;
            }

            onOpen() {
                const { contentEl } = this;
                contentEl.createEl('h3', { text: 'Create New Project' });

                new Setting(contentEl)
                    .setName('Project Name')
                    .addText((text) => text.onChange((val) => (this.resultName = val)));

                new Setting(contentEl).addButton((btn) =>
                    btn
                        .setButtonText('Create')
                        .setCta()
                        .onClick(() => {
                            this.close();
                            this.onSubmit(this.resultName);
                        })
                );
            }
        })(this.app, (name: string) => {
            if (name.trim()) {
                void (async () => {
                    const newFile = await this.projectManager.createProjectFile(
                        name.trim(),
                        this.plugin.settings.projectsFolder
                    );
                    const leaf = this.app.workspace.getLeaf(false);
                    await leaf.openFile(newFile);
                    void this.render();
                })();
            }
        });

        modal.open();
    }
}

