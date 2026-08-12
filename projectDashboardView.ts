import { App, ItemView, WorkspaceLeaf, TFile, setIcon, Modal, Setting } from 'obsidian';
import { ProjectManager, ProjectData, ProjectTask } from './projectManager';
import TimeBoxPlugin from './main';

export const TIMEBOX_PROJECT_VIEW_TYPE = 'timebox-project-dashboard';

export class ProjectDashboardView extends ItemView {
    plugin: TimeBoxPlugin;
    projectManager: ProjectManager;

    private isRendering = false;
    private renderRequested = false;
    private renderDebounceTimer: number | null = null;
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
            this.app.workspace.on('file-open', () => {
                this.debouncedRender();
            })
        );

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
            window.clearTimeout(this.renderDebounceTimer);
        }
        this.renderDebounceTimer = window.setTimeout(() => {
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
            const container = this.contentEl;
            container.empty();
            container.addClass('timebox-project-view');

            const headerEl = container.createDiv({ cls: 'timebox-view-header' });
            headerEl.createEl('h4', { text: 'Project Dashboard' });

            const controlsEl = headerEl.createDiv({ cls: 'timebox-header-controls' });

            const toggleCompletedBtn = controlsEl.createEl('button', {
                cls: 'timebox-task-icon-btn',
                title: this.plugin.settings.hideCompletedProjectTasks ? 'Show completed tasks' : 'Hide completed tasks'
            });
            setIcon(toggleCompletedBtn, this.plugin.settings.hideCompletedProjectTasks ? 'eye-off' : 'eye');
            toggleCompletedBtn.addEventListener('click', () => {
                void (async () => {
                    this.plugin.settings.hideCompletedProjectTasks = !this.plugin.settings.hideCompletedProjectTasks;
                    await this.plugin.saveSettings();
                    void this.render();
                })();
            });

            const refreshBtn = controlsEl.createEl('button', {
                cls: 'timebox-task-icon-btn',
                title: 'Refresh dashboard'
            });
            setIcon(refreshBtn, 'refresh-cw');
            refreshBtn.addEventListener('click', () => {
                void this.render();
            });

            const projectsData = await this.projectManager.getAllProjectsData(
                this.plugin.settings.projectsFolder
            );

            if (projectsData.length === 0) {
                container.createDiv({
                    cls: 'timebox-empty-view',
                    text: `No project notes found in "${this.plugin.settings.projectsFolder}". Create an .md file in that folder to get started!`
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

    private collapsedProjects: Set<string> = new Set();
    private expandedSubtasks: Set<string> = new Set();
    private activeSubtaskInputs: Set<string> = new Set();

    renderProjectCard(parentEl: HTMLElement, proj: ProjectData): void {
        const isCollapsed = this.collapsedProjects.has(proj.file.path);
        const cardEl = parentEl.createDiv({
            cls: `timebox-project-card ${isCollapsed ? 'is-collapsed' : ''}`
        });

        // Card Header
        const cardHeader = cardEl.createDiv({ cls: 'timebox-project-header' });

        const headerLeft = cardHeader.createDiv({ cls: 'timebox-project-header-left' });
        
        // Expand/Collapse Chevron Icon
        const toggleChevron = headerLeft.createEl('button', {
            cls: 'timebox-task-icon-btn timebox-project-toggle-btn',
            title: isCollapsed ? 'Expand project card' : 'Collapse project card'
        });
        setIcon(toggleChevron, isCollapsed ? 'chevron-right' : 'chevron-down');

        // Project Title
        headerLeft.createSpan({ cls: 'timebox-project-title', text: proj.name });

        // Open Note Button (📄 / file icon)
        const openNoteBtn = headerLeft.createEl('button', {
            cls: 'timebox-task-icon-btn timebox-project-open-btn',
            title: `Open "${proj.name}" note`
        });
        setIcon(openNoteBtn, 'external-link');
        openNoteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            void (async () => {
                const leaf = this.app.workspace.getLeaf(false);
                await leaf.openFile(proj.file);
            })();
        });

        // Toggle Collapse when clicking header or chevron
        const handleToggleCollapse = (e: MouseEvent) => {
            e.stopPropagation();
            if (isCollapsed) {
                this.collapsedProjects.delete(proj.file.path);
            } else {
                this.collapsedProjects.add(proj.file.path);
            }
            void this.render();
        };

        cardHeader.addEventListener('click', handleToggleCollapse);

        cardHeader.createSpan({
            cls: 'timebox-project-meta',
            text: `${proj.completedCount}/${proj.totalCount} completed (${proj.progressPercent}%)`
        });

        // Card Body Container (collapsible)
        const cardBody = cardEl.createDiv({ cls: 'timebox-project-card-body' });
        if (isCollapsed) {
            cardBody.setCssStyles({ display: 'none' });
        }

        // Progress Bar
        const progressContainer = cardBody.createDiv({ cls: 'timebox-progress-container' });
        const progressFill = progressContainer.createDiv({ cls: 'timebox-progress-fill' });
        progressFill.setCssStyles({ width: `${proj.progressPercent}%` });

        // Tasks List
        const tasksContainer = cardBody.createDiv({ cls: 'timebox-project-tasks' });

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
        const addRow = cardBody.createDiv({ cls: 'timebox-quick-add-row' });
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
        const taskRowEl = taskBlockEl.createDiv({
            cls: `timebox-task-row ${task.completed ? 'is-completed' : ''}`
        });

        // HTML5 Drag and Drop Handlers for task reordering
        taskRowEl.setAttribute('draggable', 'true');

        taskRowEl.addEventListener('dragstart', (e) => {
            this.draggedTaskIndex = topLevelIndex;
            this.draggedProjectFilePath = proj.file.path;
            taskRowEl.addClass('is-dragging');
            if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', `${topLevelIndex}`);
            }
        });

        taskRowEl.addEventListener('dragend', () => {
            taskRowEl.removeClass('is-dragging');
            this.draggedTaskIndex = null;
            this.draggedProjectFilePath = null;
            const dropTargets = containerEl.querySelectorAll('.drop-target');
            dropTargets.forEach(el => el.removeClass('drop-target'));
        });

        taskRowEl.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (this.draggedProjectFilePath === proj.file.path && this.draggedTaskIndex !== topLevelIndex) {
                taskRowEl.addClass('drop-target');
            }
        });

        taskRowEl.addEventListener('dragleave', () => {
            taskRowEl.removeClass('drop-target');
        });

        taskRowEl.addEventListener('drop', (e) => {
            e.preventDefault();
            taskRowEl.removeClass('drop-target');
            if (
                this.draggedProjectFilePath === proj.file.path &&
                this.draggedTaskIndex !== null &&
                this.draggedTaskIndex !== topLevelIndex
            ) {
                const sourceIdx = this.draggedTaskIndex;
                const targetIdx = topLevelIndex;
                void (async () => {
                    await this.projectManager.reorderProjectTasks(proj.file, sourceIdx, targetIdx);
                    void this.render();
                })();
            }
        });

        // 6-Dot Drag Handle (⋮⋮)
        const dragHandle = taskRowEl.createDiv({
            cls: 'timebox-drag-handle',
            title: 'Drag to reorder task'
        });
        setIcon(dragHandle, 'grip-vertical');

        // Subtask Expand/Collapse Toggle Button
        if (hasSubtasks) {
            const toggleSubtasksBtn = taskRowEl.createEl('button', {
                cls: 'timebox-task-icon-btn timebox-toggle-subtasks-btn',
                title: isSubtasksExpanded ? 'Collapse subtasks' : 'Expand subtasks'
            });
            setIcon(toggleSubtasksBtn, isSubtasksExpanded ? 'chevron-down' : 'chevron-right');
            toggleSubtasksBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (isSubtasksExpanded) {
                    this.expandedSubtasks.delete(taskKey);
                    this.expandedSubtasks.add(`collapsed::${taskKey}`);
                } else {
                    this.expandedSubtasks.delete(`collapsed::${taskKey}`);
                    this.expandedSubtasks.add(taskKey);
                }
                void this.render();
            });
        }

        // Checkbox
        const checkbox = taskRowEl.createEl('input', { type: 'checkbox' });
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

        // Task Text
        taskRowEl.createSpan({ cls: 'timebox-task-text', text: task.text });

        // Subtask Count Badge (e.g. 1/3)
        if (hasSubtasks) {
            const completedCount = task.subtasks.filter(st => st.completed).length;
            const totalSubtasks = task.subtasks.length;
            taskRowEl.createSpan({
                cls: 'timebox-subtask-count-badge',
                text: `(${completedCount}/${totalSubtasks})`
            });
        }

        // Action Buttons Group
        const actionsGroup = taskRowEl.createDiv({ cls: 'timebox-task-actions' });

        // Push to Today button (+ Today)
        const pushBtn = actionsGroup.createEl('button', {
            cls: 'timebox-task-action-btn',
            text: '+ Today',
            title: "Add this task to Today's TimeBox"
        });
        pushBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            void (async () => {
                await this.projectManager.addProjectTaskToToday(
                    task.text,
                    proj.file,
                    this.plugin.settings.timeBoxFolder,
                    this.plugin.settings.dateFormat
                );
                void this.render();
            })();
        });

        // Add Subtask Button (List-Plus icon)
        const addSubtaskBtn = actionsGroup.createEl('button', {
            cls: 'timebox-task-icon-btn timebox-add-subtask-btn',
            title: 'Add subtask'
        });
        setIcon(addSubtaskBtn, 'list-plus');
        addSubtaskBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.activeSubtaskInputs.has(taskKey)) {
                this.activeSubtaskInputs.delete(taskKey);
            } else {
                this.activeSubtaskInputs.add(taskKey);
                this.expandedSubtasks.add(taskKey);
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
            subtasksContainer.setCssStyles({ display: 'none' });
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

        // Inline Quick Add Subtask Input Row
        if (isInputActive) {
            const addSubtaskRow = subtasksContainer.createDiv({ cls: 'timebox-quick-add-subtask-row' });
            const subInput = addSubtaskRow.createEl('input', {
                type: 'text',
                placeholder: '+ Add subtask...'
            });
            const subAddBtn = addSubtaskRow.createEl('button', { text: 'Add' });

            window.setTimeout(() => subInput.focus(), 50);

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

