import { App, ItemView, WorkspaceLeaf, TFile, Notice, setIcon, Modal, Setting } from 'obsidian';
import { ProjectManager, ProjectData, ProjectTask } from './projectManager';
import TimeBoxPlugin from './main';

export const TIMEBOX_PROJECT_VIEW_TYPE = 'timebox-project-dashboard';

export class ProjectDashboardView extends ItemView {
    plugin: TimeBoxPlugin;
    projectManager: ProjectManager;

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

        // Register vault listeners to refresh view when files change
        this.registerEvent(
            this.app.vault.on('modify', (file) => {
                if (file instanceof TFile) {
                    void this.render();
                }
            })
        );
    }

    async render(): Promise<void> {
        const container = this.contentEl;
        container.empty();
        container.addClass('timebox-dashboard-container');

        // Header
        const headerEl = container.createEl('div', { cls: 'timebox-dashboard-header' });
        headerEl.createEl('h4', { text: '🗂 Projects Dashboard' });

        const actionsEl = headerEl.createEl('div', { cls: 'timebox-dashboard-actions' });
        
        const isHiding = this.plugin.settings.hideCompletedProjectTasks;
        const toggleCompletedBtn = actionsEl.createEl('button', {
            cls: 'clickable-icon',
            title: isHiding ? 'Show completed tasks' : 'Hide completed tasks'
        });
        setIcon(toggleCompletedBtn, isHiding ? 'eye-off' : 'eye');
        toggleCompletedBtn.addEventListener('click', async () => {
            this.plugin.settings.hideCompletedProjectTasks = !this.plugin.settings.hideCompletedProjectTasks;
            await this.plugin.saveSettings();
            void this.render();
        });

        const refreshBtn = actionsEl.createEl('button', { cls: 'clickable-icon', title: 'Refresh dashboard' });
        setIcon(refreshBtn, 'refresh-cw');
        refreshBtn.addEventListener('click', () => {
            void this.render();
        });

        const newProjBtn = actionsEl.createEl('button', { cls: 'timebox-btn-primary', text: '+ New Project' });
        newProjBtn.addEventListener('click', async () => {
            await this.promptCreateProject();
        });

        // Projects List
        const projectsData = await this.projectManager.getAllProjectsData(this.plugin.settings.projectsFolder);

        if (projectsData.length === 0) {
            const emptyEl = container.createEl('div', { cls: 'timebox-dashboard-empty' });
            emptyEl.createEl('p', { text: `No project notes found in "${this.plugin.settings.projectsFolder}" folder.` });
            const createFirstBtn = emptyEl.createEl('button', { text: 'Create First Project' });
            createFirstBtn.addEventListener('click', async () => {
                await this.promptCreateProject();
            });
            return;
        }

        const projectListEl = container.createEl('div', { cls: 'timebox-project-list' });

        for (const proj of projectsData) {
            this.renderProjectCard(projectListEl, proj);
        }
    }

    renderProjectCard(parentEl: HTMLElement, proj: ProjectData): void {
        const cardEl = parentEl.createEl('div', { cls: 'timebox-project-card' });

        // Card Header
        const cardHeader = cardEl.createEl('div', { cls: 'timebox-project-header' });
        const titleEl = cardHeader.createEl('a', { cls: 'timebox-project-title', text: proj.name });
        titleEl.addEventListener('click', async () => {
            const leaf = this.app.workspace.getLeaf(false);
            await leaf.openFile(proj.file);
        });

        cardHeader.createEl('span', {
            cls: 'timebox-project-meta',
            text: `${proj.completedCount}/${proj.totalCount} completed (${proj.progressPercent}%)`
        });

        // Progress Bar
        const progressContainer = cardEl.createEl('div', { cls: 'timebox-progress-container' });
        const progressFill = progressContainer.createEl('div', { cls: 'timebox-progress-fill' });
        progressFill.style.width = `${proj.progressPercent}%`;

        // Tasks List
        const tasksContainer = cardEl.createEl('div', { cls: 'timebox-project-tasks' });

        const tasksToDisplay = this.plugin.settings.hideCompletedProjectTasks
            ? proj.tasks.filter(t => !t.completed)
            : proj.tasks;

        if (tasksToDisplay.length === 0) {
            const msg = proj.tasks.length > 0 && this.plugin.settings.hideCompletedProjectTasks
                ? 'All tasks completed! (Click 👁 to view completed)'
                : 'No checklist tasks found in this project.';
            tasksContainer.createEl('div', { cls: 'timebox-task-empty', text: msg });
        } else {
            for (const task of tasksToDisplay) {
                const taskRow = tasksContainer.createEl('div', {
                    cls: `timebox-task-row ${task.completed ? 'is-completed' : ''}`
                });

                const checkbox = taskRow.createEl('input', { type: 'checkbox' }) as HTMLInputElement;
                checkbox.checked = task.completed;
                checkbox.addEventListener('change', async () => {
                    await this.projectManager.syncTaskCompletion(
                        proj.file,
                        task.text,
                        checkbox.checked,
                        this.plugin.settings.projectsFolder,
                        this.plugin.settings.timeBoxFolder
                    );
                    void this.render();
                });

                taskRow.createEl('span', { cls: 'timebox-task-text', text: task.text });

                if (!task.completed) {
                    const addToTodayBtn = taskRow.createEl('button', {
                        cls: 'timebox-task-today-btn',
                        text: '+ Today',
                        title: "Add task to today's TimeBox note"
                    });

                    addToTodayBtn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        await this.projectManager.addProjectTaskToToday(
                            task.text,
                            proj.file,
                            this.plugin.settings.timeBoxFolder,
                            this.plugin.settings.dateFormat
                        );
                    });
                }
            }
        }

        // Quick add task row
        const addRow = cardEl.createEl('div', { cls: 'timebox-quick-add-row' });
        const input = addRow.createEl('input', {
            type: 'text',
            placeholder: 'Add task to project...'
        }) as HTMLInputElement;

        const addBtn = addRow.createEl('button', { text: 'Add' });
        const handleAdd = async () => {
            const val = input.value.trim();
            if (val) {
                await this.projectManager.addTaskToProject(proj.file, val);
                input.value = '';
                void this.render();
            }
        };

        addBtn.addEventListener('click', async () => await handleAdd());
        input.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
                await handleAdd();
            }
        });
    }

    async promptCreateProject(): Promise<void> {
        const modal = new (class extends Modal {
            resultName: string = '';
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
        })(this.app, async (name: string) => {
            if (name.trim()) {
                const newFile = await this.projectManager.createProjectFile(
                    name.trim(),
                    this.plugin.settings.projectsFolder
                );
                const leaf = this.app.workspace.getLeaf(false);
                await leaf.openFile(newFile);
                void this.render();
            }
        });

        modal.open();
    }
}
