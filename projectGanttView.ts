import { ItemView, WorkspaceLeaf, TFile, setIcon, Menu, Notice, Modal, App, moment } from 'obsidian';
import { ProjectManager, ProjectData, ProjectTask, WorkingCalendar } from './projectManager';
import { ValidationIssue, ResourceDefinition, ResourceType, CalendarDefinition } from './projectModel';
import { ResourceEngine, ResourceUsageSummary } from './resourceEngine';
import { ProjectCalendar } from './projectCalendar';
import { ProjectCommandManager } from './projectCommandManager';
import { MarkdownAdapter } from './markdownAdapter';
import TimeBoxPlugin from './main';

export const TIMEBOX_GANTT_VIEW_TYPE = 'timebox-gantt-view';

const getMoment = (inp?: unknown, fmt?: unknown, strict?: boolean): moment.Moment => 
    (moment as unknown as (i?: unknown, f?: unknown, s?: boolean) => moment.Moment)(inp, fmt, strict);

export type GanttZoomLevel = 'day' | 'week' | 'month';
export type ProjectManagementViewType = 'gantt' | 'task-sheet' | 'resource-sheet' | 'resource-usage' | 'project-summary';

interface FlattenedGanttRow {
    task: ProjectTask;
    isParent: boolean;
    isSubtask: boolean;
    hasDates: boolean;
    startDate?: string;
    dueDate?: string;
    durationDays: number;
    isMilestone: boolean;
    visible: boolean;
    parentIndex?: number;
    wbsCode: string;
    wbsIndex: number;
    resource?: string;
    predecessors: string[];
    isBlocked: boolean;
    isCritical: boolean;
    totalFloat: number;
    freeFloat: number;
    workHours: number;
    percentComplete: number;
    constraintType?: string;
    constraintDate?: string;
    baselineStart?: string;
    baselineFinish?: string;
    description?: string;
    workingIntervals: Array<{ start: string; end: string }>;
}


export class TaskInformationModal extends Modal {
    projectFile: TFile;
    task: ProjectTask;
    projectManager: ProjectManager;
    onSaveCallback: () => void;

    private titleInput: HTMLInputElement | null = null;
    private descInput: HTMLTextAreaElement | null = null;
    private startInput: HTMLInputElement | null = null;
    private dueInput: HTMLInputElement | null = null;
    private durInput: HTMLInputElement | null = null;
    private predInput: HTMLInputElement | null = null;
    private resInput: HTMLInputElement | null = null;
    private milestoneCheck: HTMLInputElement | null = null;
    private completedCheck: HTMLInputElement | null = null;

    constructor(
        app: App,
        projectFile: TFile,
        task: ProjectTask,
        projectManager: ProjectManager,
        onSaveCallback: () => void
    ) {
        super(app);
        this.projectFile = projectFile;
        this.task = task;
        this.projectManager = projectManager;
        this.onSaveCallback = onSaveCallback;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('timebox-task-info-modal');

        // Header
        const header = contentEl.createDiv({ cls: 'timebox-modal-header' });
        const cleanModalTitle = (this.task.cleanTitle || this.task.text).replace(/^(\s*-\s*\[[ xX]\]\s*)+/g, '').trim();
        header.createEl('h3', { text: `Task Information: ${cleanModalTitle || 'Task'}` });
        if (this.task.wbsCode) {
            header.createSpan({ cls: 'timebox-modal-wbs-tag', text: `WBS: ${this.task.wbsCode}` });
        }

        // Body / Form Grid
        const form = contentEl.createDiv({ cls: 'timebox-task-info-form' });

        // Task Title
        const titleRow = form.createDiv({ cls: 'timebox-form-row full-width' });
        titleRow.createEl('label', { text: 'Task Name:' });
        this.titleInput = titleRow.createEl('input', {
            type: 'text',
            value: cleanModalTitle
        });

        // Description / Notes
        const descRow = form.createDiv({ cls: 'timebox-form-row full-width' });
        descRow.createEl('label', { text: 'Description / Notes:' });
        this.descInput = descRow.createEl('textarea', {
            placeholder: 'Task description or notes...'
        });
        this.descInput.value = this.task.description || '';

        // Start Date
        const startRow = form.createDiv({ cls: 'timebox-form-row' });
        startRow.createEl('label', { text: 'Start Date (Working Day):' });
        this.startInput = startRow.createEl('input', {
            type: 'date',
            value: this.task.startDate || ''
        });

        // Due Date
        const dueRow = form.createDiv({ cls: 'timebox-form-row' });
        dueRow.createEl('label', { text: 'Due Date:' });
        this.dueInput = dueRow.createEl('input', {
            type: 'date',
            value: this.task.dueDate || ''
        });

        // Duration in Working Days
        const durRow = form.createDiv({ cls: 'timebox-form-row' });
        durRow.createEl('label', { text: 'Duration (Working Days):' });
        this.durInput = durRow.createEl('input', {
            type: 'number',
            value: String(this.task.durationDays || 1)
        });
        this.durInput.min = '1';
        this.durInput.max = '365';

        // Predecessors
        const predRow = form.createDiv({ cls: 'timebox-form-row' });
        predRow.createEl('label', { text: 'Predecessors (WBS #):' });
        this.predInput = predRow.createEl('input', {
            type: 'text',
            value: this.task.predecessors && this.task.predecessors.length > 0 ? this.task.predecessors.join(', ') : '',
            placeholder: 'e.g. 2.1, 2.2'
        });

        // Assigned Resource
        const resRow = form.createDiv({ cls: 'timebox-form-row' });
        resRow.createEl('label', { text: 'Assigned Resource:' });
        this.resInput = resRow.createEl('input', {
            type: 'text',
            value: this.task.resource ? `@${this.task.resource}` : '',
            placeholder: 'e.g. @Roberto'
        });

        // Flags row (Milestone & Completed)
        const flagsRow = form.createDiv({ cls: 'timebox-form-row flags-row full-width' });
        
        const milestoneLabel = flagsRow.createEl('label', { cls: 'timebox-checkbox-label' });
        this.milestoneCheck = milestoneLabel.createEl('input', { type: 'checkbox' });
        this.milestoneCheck.checked = this.task.isMilestone;
        milestoneLabel.createSpan({ text: ' Milestone (0 working days)' });

        const completedLabel = flagsRow.createEl('label', { cls: 'timebox-checkbox-label' });
        this.completedCheck = completedLabel.createEl('input', { type: 'checkbox' });
        this.completedCheck.checked = this.task.completed;
        completedLabel.createSpan({ text: ' Task Completed' });

        // Synchronize Working Calendar between Start, Dur, and Due fields
        this.startInput.addEventListener('change', () => {
            const startVal = this.startInput?.value;
            if (startVal) {
                const snapped = WorkingCalendar.snapToWorkingDay(startVal);
                if (snapped !== startVal && this.startInput) {
                    this.startInput.value = snapped;
                }
                const durVal = parseInt(this.durInput?.value || '1', 10);
                if (durVal > 0 && this.dueInput) {
                    this.dueInput.value = WorkingCalendar.addWorkingDays(snapped, durVal);
                }
            }
        });

        this.durInput.addEventListener('input', () => {
            const startVal = this.startInput?.value;
            const durVal = parseInt(this.durInput?.value || '1', 10);
            if (startVal && durVal > 0 && this.dueInput) {
                this.dueInput.value = WorkingCalendar.addWorkingDays(startVal, durVal);
            }
        });

        this.dueInput.addEventListener('change', () => {
            const startVal = this.startInput?.value;
            const dueVal = this.dueInput?.value;
            if (startVal && dueVal && this.durInput) {
                const calculatedDur = WorkingCalendar.calculateWorkingDays(startVal, dueVal);
                this.durInput.value = String(calculatedDur);
            }
        });

        // Footer Actions
        const footer = contentEl.createDiv({ cls: 'timebox-modal-footer-split' });

        const deleteBtn = footer.createEl('button', {
            cls: 'mod-warning',
            text: 'Delete Task'
        });
        deleteBtn.addEventListener('click', () => {
            void (async () => {
                await this.projectManager.deleteTaskFromProject(this.projectFile, this.task);
                this.close();
                this.onSaveCallback();
            })();
        });

        const rightBtns = footer.createDiv({ cls: 'timebox-modal-footer-right' });
        const cancelBtn = rightBtns.createEl('button', { text: 'Cancel' });
        cancelBtn.addEventListener('click', () => this.close());

        const saveBtn = rightBtns.createEl('button', {
            cls: 'mod-cta',
            text: 'Save Changes'
        });
        saveBtn.addEventListener('click', () => {
            void this.save();
        });
    }

    private async save(): Promise<void> {
        const rawTitle = this.titleInput?.value.trim() || this.task.cleanTitle;
        const title = rawTitle.replace(/^(\s*-\s*\[[ xX]\]\s*)+/g, '').trim();
        const description = this.descInput?.value.trim() || undefined;
        const startDate = this.startInput?.value || undefined;
        const dueDate = this.dueInput?.value || undefined;
        const durationDays = parseInt(this.durInput?.value || '1', 10);
        const isMilestone = this.milestoneCheck?.checked || false;
        const completed = this.completedCheck?.checked || false;

        const rawResource = this.resInput?.value.trim().replace(/^@/, '') || undefined;
        const rawPred = this.predInput?.value.trim() || '';
        const predecessors: string[] = rawPred
            ? rawPred.split(',').map(s => s.replace(/#/g, '').trim()).filter(s => s.length > 0)
            : [];

        await this.projectManager.updateTaskDetails(this.projectFile, this.task.lineIndex, {
            title,
            description,
            startDate,
            dueDate,
            durationDays: isMilestone ? 0 : durationDays,
            resource: rawResource,
            predecessors,
            isMilestone,
            completed
        });

        new Notice(`Saved task: ${title}`);
        this.close();
        this.onSaveCallback();
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class ResourceModal extends Modal {
    private resource: Partial<ResourceDefinition>;
    private onSave: (res: ResourceDefinition) => Promise<void>;
    private calendars: CalendarDefinition[];

    constructor(
        app: App,
        resource: Partial<ResourceDefinition> | null,
        calendars: CalendarDefinition[],
        onSave: (res: ResourceDefinition) => Promise<void>
    ) {
        super(app);
        this.resource = resource ? { ...resource } : {
            id: '',
            name: '',
            type: 'Work',
            maxUnits: 1.0,
            workingHoursPerDay: 8,
            ratePerHour: 0
        };
        this.calendars = calendars || [];
        this.onSave = onSave;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('timebox-resource-modal');

        const isEdit = !!this.resource.id;
        contentEl.createEl('h3', { text: isEdit ? 'Edit Resource' : 'Add New Resource' });

        const form = contentEl.createDiv({ cls: 'timebox-task-info-form' });

        // Name
        const nameRow = form.createDiv({ cls: 'timebox-form-row full-width' });
        nameRow.createEl('label', { text: 'Resource Name:' });
        const nameInput = nameRow.createEl('input', { type: 'text', value: this.resource.name || '' });
        nameInput.placeholder = 'e.g. Roberto Zenteno';

        // Type
        const typeRow = form.createDiv({ cls: 'timebox-form-row' });
        typeRow.createEl('label', { text: 'Resource Type:' });
        const typeSelect = typeRow.createEl('select');
        (['Work', 'Material', 'Cost'] as ResourceType[]).forEach(t => {
            const opt = typeSelect.createEl('option', { value: t, text: t });
            if (this.resource.type === t) opt.selected = true;
        });

        // Max Units (%)
        const unitsRow = form.createDiv({ cls: 'timebox-form-row' });
        unitsRow.createEl('label', { text: 'Capacity / Max Units (%):' });
        const unitsInput = unitsRow.createEl('input', {
            type: 'number',
            value: String(Math.round((this.resource.maxUnits !== undefined ? this.resource.maxUnits : 1.0) * 100))
        });
        unitsInput.min = '10';
        unitsInput.max = '1000';
        unitsInput.step = '10';

        // Working Hours Per Day
        const hoursRow = form.createDiv({ cls: 'timebox-form-row' });
        hoursRow.createEl('label', { text: 'Working Hours / Day:' });
        const hoursInput = hoursRow.createEl('input', {
            type: 'number',
            value: String(this.resource.workingHoursPerDay || 8)
        });
        hoursInput.min = '1';
        hoursInput.max = '24';
        hoursInput.step = '0.5';

        // Hourly Rate ($)
        const rateRow = form.createDiv({ cls: 'timebox-form-row' });
        rateRow.createEl('label', { text: 'Standard Rate ($/hr):' });
        const rateInput = rateRow.createEl('input', {
            type: 'number',
            value: String(this.resource.ratePerHour || 0)
        });
        rateInput.min = '0';
        rateInput.step = '1';

        // Cost Per Use ($)
        const costRow = form.createDiv({ cls: 'timebox-form-row' });
        costRow.createEl('label', { text: 'Cost Per Use ($):' });
        const costInput = costRow.createEl('input', {
            type: 'number',
            value: String(this.resource.costPerUse || 0)
        });
        costInput.min = '0';
        costInput.step = '1';

        // Calendar Override
        const calRow = form.createDiv({ cls: 'timebox-form-row full-width' });
        calRow.createEl('label', { text: 'Resource Calendar:' });
        const calSelect = calRow.createEl('select');
        calSelect.createEl('option', { value: '', text: 'Default Project Calendar' });
        for (const cal of this.calendars) {
            const opt = calSelect.createEl('option', { value: cal.id, text: cal.name });
            if (this.resource.calendarId === cal.id) opt.selected = true;
        }

        // Action Buttons
        const footer = contentEl.createDiv({ cls: 'timebox-modal-footer' });
        const cancelBtn = footer.createEl('button', { text: 'Cancel' });
        cancelBtn.addEventListener('click', () => this.close());

        const saveBtn = footer.createEl('button', { cls: 'mod-cta', text: isEdit ? 'Save Resource' : 'Add Resource' });
        saveBtn.addEventListener('click', async () => {
            const name = nameInput.value.trim();
            if (!name) {
                new Notice('Please enter a resource name');
                return;
            }

            const rawUnits = parseFloat(unitsInput.value) || 100;
            const resDef: ResourceDefinition = {
                id: this.resource.id || name.toLowerCase().replace(/[^a-z0-9_\-]/g, '-'),
                name,
                type: typeSelect.value as ResourceType,
                maxUnits: Math.max(0.1, rawUnits / 100),
                workingHoursPerDay: parseFloat(hoursInput.value) || 8,
                ratePerHour: parseFloat(rateInput.value) || 0,
                costPerUse: parseFloat(costInput.value) || 0,
                calendarId: calSelect.value || undefined
            };

            await this.onSave(resDef);
            this.close();
        });
    }

    onClose(): void {
        this.contentEl.empty();
    }
}

class AssignResourceModal extends Modal {
    private rows: FlattenedGanttRow[];
    private resource: ResourceDefinition;
    private onAssign: (targetRow: FlattenedGanttRow, units: number) => Promise<void>;

    constructor(
        app: App,
        resource: ResourceDefinition,
        rows: FlattenedGanttRow[],
        onAssign: (targetRow: FlattenedGanttRow, units: number) => Promise<void>
    ) {
        super(app);
        this.resource = resource;
        this.rows = rows.filter(r => !r.isParent);
        this.onAssign = onAssign;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('timebox-resource-modal');

        contentEl.createEl('h3', { text: `Assign @${this.resource.name} to Task` });

        const form = contentEl.createDiv({ cls: 'timebox-task-info-form' });

        const taskRow = form.createDiv({ cls: 'timebox-form-row full-width' });
        taskRow.createEl('label', { text: 'Target Task:' });
        const taskSelect = taskRow.createEl('select');
        this.rows.forEach(r => {
            taskSelect.createEl('option', {
                value: String(r.task.lineIndex),
                text: `[WBS ${r.wbsCode}] ${r.task.cleanTitle}`
            });
        });

        const unitsRow = form.createDiv({ cls: 'timebox-form-row' });
        unitsRow.createEl('label', { text: 'Units / Allocation (%):' });
        const unitsInput = unitsRow.createEl('input', { type: 'number', value: '100' });
        unitsInput.min = '10';
        unitsInput.max = '200';
        unitsInput.step = '10';

        const footer = contentEl.createDiv({ cls: 'timebox-modal-footer' });
        const cancelBtn = footer.createEl('button', { text: 'Cancel' });
        cancelBtn.addEventListener('click', () => this.close());

        const assignBtn = footer.createEl('button', { cls: 'mod-cta', text: 'Assign Resource' });
        assignBtn.addEventListener('click', async () => {
            const lineIdx = parseInt(taskSelect.value, 10);
            const targetRow = this.rows.find(r => r.task.lineIndex === lineIdx);
            if (targetRow) {
                const units = (parseFloat(unitsInput.value) || 100) / 100;
                await this.onAssign(targetRow, units);
                this.close();
            }
        });
    }

    onClose(): void {
        this.contentEl.empty();
    }
}

export class ProjectGanttView extends ItemView {
    plugin: TimeBoxPlugin;
    projectManager: ProjectManager;

    private currentProjectFilePath: string | null = null;
    private zoomLevel: GanttZoomLevel = 'day';
    private activeView: ProjectManagementViewType = 'gantt';
    private showCriticalPath = false;
    private showBaselines = false;
    private commandManager = new ProjectCommandManager();
    private collapsedTaskLines: Set<number> = new Set();
    private selectedTaskLine: number | null = null;
    private isRendering = false;
    private renderRequested = false;
    private renderDebounceTimer: number | null = null;
    private wbsWidth = 540; // Default width to accommodate WBS, Name, Desc, Dates, Dur, Pred, Res, Info
    private resourceUsageStartOffset = 0; // Timeline window offset in days
    private expandedResources: Set<string> = new Set();

    // DOM references for sync scrolling
    private wbsBodyEl: HTMLElement | null = null;
    private timelineBodyEl: HTMLElement | null = null;
    private timelineScrollEl: HTMLElement | null = null;

    constructor(leaf: WorkspaceLeaf, plugin: TimeBoxPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.projectManager = new ProjectManager(this.app);
    }

    getViewType(): string {
        return TIMEBOX_GANTT_VIEW_TYPE;
    }

    getDisplayText(): string {
        if (this.currentProjectFilePath) {
            const file = this.app.vault.getAbstractFileByPath(this.currentProjectFilePath);
            if (file instanceof TFile) {
                return `Gantt: ${file.basename}`;
            }
        }
        return 'Project Gantt';
    }

    getIcon(): string {
        return 'bar-chart-2';
    }

    setTargetProject(filePath: string): void {
        this.currentProjectFilePath = filePath;
        void this.render();
    }

    async onOpen(): Promise<void> {
        await this.render();

        this.registerEvent(
            this.app.vault.on('modify', (file) => {
                if (file instanceof TFile) {
                    if (this.projectManager.isInternalModification(file.path)) return;
                    if (this.currentProjectFilePath && file.path === this.currentProjectFilePath) {
                        this.debouncedRender();
                    }
                }
            })
        );

        // Global keyboard shortcut: Tab/Shift+Tab for indent/outdent, Ctrl+Z/Cmd+Z for undo/redo
        this.contentEl.addEventListener('keydown', (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            const isInputField = target.tagName.toLowerCase() === 'input' || target.tagName.toLowerCase() === 'textarea';

            if (e.key === 'Tab') {
                if (this.selectedTaskLine !== null) {
                    if (!isInputField) {
                        e.preventDefault();
                        const activeFile = this.currentProjectFilePath 
                            ? this.app.vault.getAbstractFileByPath(this.currentProjectFilePath)
                            : null;
                        if (activeFile instanceof TFile) {
                            void (async () => {
                                if (e.shiftKey) {
                                    await this.projectManager.outdentTask(activeFile, this.selectedTaskLine!);
                                } else {
                                    await this.projectManager.indentTask(activeFile, this.selectedTaskLine!);
                                }
                                void this.render();
                            })();
                        }
                    }
                }
            } else if ((e.ctrlKey || e.metaKey) && !isInputField) {
                if (e.key.toLowerCase() === 'z') {
                    e.preventDefault();
                    if (e.shiftKey) {
                        void this.triggerRedo();
                    } else {
                        void this.triggerUndo();
                    }
                } else if (e.key.toLowerCase() === 'y') {
                    e.preventDefault();
                    void this.triggerRedo();
                }
            }
        });
    }

    private async triggerUndo(): Promise<void> {
        if (!this.commandManager.canUndo()) {
            new Notice('Nothing to undo');
            return;
        }
        if (!this.currentProjectFilePath) return;
        const activeFile = this.app.vault.getAbstractFileByPath(this.currentProjectFilePath);
        if (!(activeFile instanceof TFile)) return;

        const projectData = await this.projectManager.parseProjectData(activeFile);
        if (!projectData.normalizedProject) return;

        const desc = this.commandManager.getUndoDescription();
        const reverted = this.commandManager.undo(projectData.normalizedProject);
        if (reverted) {
            const content = await this.app.vault.read(activeFile);
            const updatedContent = MarkdownAdapter.serializeProject(reverted, content);
            this.projectManager.markInternalModification(activeFile.path);
            await this.app.vault.modify(activeFile, updatedContent);
            new Notice(`Undo: ${desc || 'action'}`);
            void this.render();
        }
    }

    private async triggerRedo(): Promise<void> {
        if (!this.commandManager.canRedo()) {
            new Notice('Nothing to redo');
            return;
        }
        if (!this.currentProjectFilePath) return;
        const activeFile = this.app.vault.getAbstractFileByPath(this.currentProjectFilePath);
        if (!(activeFile instanceof TFile)) return;

        const projectData = await this.projectManager.parseProjectData(activeFile);
        if (!projectData.normalizedProject) return;

        const desc = this.commandManager.getRedoDescription();
        const reapplied = this.commandManager.redo(projectData.normalizedProject);
        if (reapplied) {
            const content = await this.app.vault.read(activeFile);
            const updatedContent = MarkdownAdapter.serializeProject(reapplied, content);
            this.projectManager.markInternalModification(activeFile.path);
            await this.app.vault.modify(activeFile, updatedContent);
            new Notice(`Redo: ${desc || 'action'}`);
            void this.render();
        }
    }


    debouncedRender(): void {
        if (this.renderDebounceTimer) {
            window.clearTimeout(this.renderDebounceTimer);
        }
        this.renderDebounceTimer = window.setTimeout(() => {
            void this.render();
        }, 200);
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
            container.addClass('timebox-gantt-view');

            const projectFiles = this.projectManager.getProjectFiles(this.plugin.settings.projectsFolder);

            if (projectFiles.length === 0) {
                container.createDiv({
                    cls: 'timebox-empty-view',
                    text: `No project notes found in "${this.plugin.settings.projectsFolder}". Create an .md file in that folder to view the Gantt chart.`
                });
                return;
            }

            // Determine active project
            if (!this.currentProjectFilePath || !projectFiles.some(f => f.path === this.currentProjectFilePath)) {
                this.currentProjectFilePath = projectFiles[0].path;
            }

            const activeFile = this.app.vault.getAbstractFileByPath(this.currentProjectFilePath);
            if (!(activeFile instanceof TFile)) {
                return;
            }

            const projectData = await this.projectManager.parseProjectData(activeFile);

            // Flatten rows with WBS metadata and visibility
            const rows = this.flattenTasks(projectData.tasks);

            // Render Header Toolbar
            this.renderToolbar(container, projectFiles, projectData, rows);

            // Render Validation Banner if any issues detected
            if (projectData.normalizedProject?.validationIssues && projectData.normalizedProject.validationIssues.length > 0) {
                this.renderValidationBanner(container, projectData.normalizedProject.validationIssues);
            }

            // Render Active View Content
            if (this.activeView === 'gantt') {
                // Render Split Workspace
                const workspaceEl = container.createDiv({ cls: 'timebox-gantt-workspace' });

                // Render Left WBS Pane
                this.renderWbsPane(workspaceEl, projectData, rows);

                // Render Splitter
                this.renderSplitter(workspaceEl);

                // Render Right Timeline Pane
                this.renderTimelinePane(workspaceEl, projectData, rows);

                // Setup Synchronized Scrolling
                this.setupSyncScroll();
            } else if (this.activeView === 'task-sheet') {
                this.renderTaskSheet(container, projectData, rows);
            } else if (this.activeView === 'resource-sheet') {
                this.renderResourceSheet(container, projectData, rows);
            } else if (this.activeView === 'resource-usage') {
                this.renderResourceUsage(container, projectData, rows);
            } else if (this.activeView === 'project-summary') {
                this.renderProjectSummary(container, projectData, rows);
            }

        } finally {
            this.isRendering = false;
            if (this.renderRequested) {
                this.renderRequested = false;
                void this.render();
            }
        }
    }

    private renderToolbar(
        container: HTMLElement,
        projectFiles: TFile[],
        projectData: ProjectData,
        rows: FlattenedGanttRow[]
    ): void {
        // 1. View Switcher Tabs Bar
        const viewTabsEl = container.createDiv({ cls: 'timebox-view-switcher-bar' });
        const views: { id: ProjectManagementViewType; label: string; icon: string }[] = [
            { id: 'gantt', label: 'Gantt Chart', icon: 'bar-chart-2' },
            { id: 'task-sheet', label: 'Task Sheet', icon: 'table' },
            { id: 'resource-sheet', label: 'Resource Sheet', icon: 'users' },
            { id: 'resource-usage', label: 'Resource Usage', icon: 'clock' },
            { id: 'project-summary', label: 'Project Summary', icon: 'layout-dashboard' }
        ];

        for (const v of views) {
            const tabBtn = viewTabsEl.createEl('button', {
                cls: `timebox-view-tab-btn ${this.activeView === v.id ? 'is-active' : ''}`
            });
            const iconSpan = tabBtn.createSpan({ cls: 'timebox-tab-icon' });
            setIcon(iconSpan, v.icon);
            tabBtn.createSpan({ cls: 'timebox-tab-text', text: v.label });

            tabBtn.addEventListener('click', () => {
                this.activeView = v.id;
                void this.render();
            });
        }

        // 2. Main Controls Toolbar
        const toolbarEl = container.createDiv({ cls: 'timebox-gantt-toolbar' });

        // Left controls: Project Selector, Open Note, Undo/Redo, Hierarchy, Start designation
        const leftGroup = toolbarEl.createDiv({ cls: 'timebox-gantt-toolbar-left' });
        
        leftGroup.createSpan({ cls: 'timebox-gantt-label', text: 'Project:' });
        const select = leftGroup.createEl('select', { cls: 'timebox-gantt-project-select' });
        
        for (const file of projectFiles) {
            const option = select.createEl('option', { value: file.path, text: file.basename });
            if (file.path === this.currentProjectFilePath) {
                option.selected = true;
            }
        }

        select.addEventListener('change', () => {
            this.currentProjectFilePath = select.value;
            this.selectedTaskLine = null;
            void this.render();
        });

        // Open project note
        const openBtn = leftGroup.createEl('button', {
            cls: 'timebox-task-icon-btn',
            title: `Open "${projectData.name}" note`
        });
        setIcon(openBtn, 'external-link');
        openBtn.addEventListener('click', () => {
            void (async () => {
                const leaf = this.app.workspace.getLeaf(false);
                await leaf.openFile(projectData.file);
            })();
        });

        // Undo & Redo button group
        const historyGroup = leftGroup.createDiv({ cls: 'timebox-gantt-button-group' });
        const canUndo = this.commandManager.canUndo();
        const undoBtn = historyGroup.createEl('button', {
            cls: `timebox-task-icon-btn ${!canUndo ? 'is-disabled' : ''}`,
            title: canUndo ? `Undo: ${this.commandManager.getUndoDescription()}` : 'Nothing to undo (Ctrl+Z)'
        });
        setIcon(undoBtn, 'undo-2');
        undoBtn.addEventListener('click', () => {
            void this.triggerUndo();
        });

        const canRedo = this.commandManager.canRedo();
        const redoBtn = historyGroup.createEl('button', {
            cls: `timebox-task-icon-btn ${!canRedo ? 'is-disabled' : ''}`,
            title: canRedo ? `Redo: ${this.commandManager.getRedoDescription()}` : 'Nothing to redo (Ctrl+Y)'
        });
        setIcon(redoBtn, 'redo-2');
        redoBtn.addEventListener('click', () => {
            void this.triggerRedo();
        });

        // Hierarchy actions: Outdent (<-), Indent (->)
        const hierarchyGroup = leftGroup.createDiv({ cls: 'timebox-gantt-button-group' });

        const outdentBtn = hierarchyGroup.createEl('button', {
            cls: 'timebox-task-icon-btn',
            title: 'Outdent task (Shift+Tab: promote to main task)'
        });
        setIcon(outdentBtn, 'arrow-left');
        outdentBtn.addEventListener('click', () => {
            if (this.selectedTaskLine !== null) {
                void (async () => {
                    await this.projectManager.outdentTask(projectData.file, this.selectedTaskLine!);
                    void this.render();
                })();
            } else {
                new Notice('Click a task row to select it first');
            }
        });

        const indentBtn = hierarchyGroup.createEl('button', {
            cls: 'timebox-task-icon-btn',
            title: 'Indent task (Tab: demote to subtask)'
        });
        setIcon(indentBtn, 'arrow-right');
        indentBtn.addEventListener('click', () => {
            if (this.selectedTaskLine !== null) {
                void (async () => {
                    await this.projectManager.indentTask(projectData.file, this.selectedTaskLine!);
                    void this.render();
                })();
            } else {
                new Notice('Click a task row to select it first');
            }
        });

        // Start Task Designation Dropdown
        const startTaskGroup = leftGroup.createDiv({ cls: 'timebox-gantt-start-group' });
        startTaskGroup.createEl('label', { cls: 'timebox-gantt-label', text: 'Start:' });
        const startSelect = startTaskGroup.createEl('select', { cls: 'timebox-gantt-start-select' });

        const opt1 = startSelect.createEl('option', { value: '1', text: 'Task #1' });
        opt1.selected = (projectData.startTaskNumber || 1) === 1;

        const opt2 = startSelect.createEl('option', { value: '2', text: 'Task #2 (Task 1 = Title)' });
        opt2.selected = (projectData.startTaskNumber || 1) === 2;

        startSelect.title = 'Designate whether the project tasks begin at Task #1 or Task #2 (when Task #1 is the project title)';
        startSelect.addEventListener('change', () => {
            void (async () => {
                const val = parseInt(startSelect.value, 10);
                await this.projectManager.setProjectStartTask(projectData.file, val);
                new Notice(`Project starting task set to Task #${val}`);
                void this.render();
            })();
        });

        // Center / View Controls: Zoom Level & Today Navigation, CPM, Baselines
        const centerGroup = toolbarEl.createDiv({ cls: 'timebox-gantt-toolbar-center' });

        if (this.activeView === 'gantt') {
            const zoomGroup = centerGroup.createDiv({ cls: 'timebox-gantt-button-group' });
            const zooms: { id: GanttZoomLevel; label: string }[] = [
                { id: 'day', label: 'Day' },
                { id: 'week', label: 'Week' },
                { id: 'month', label: 'Month' }
            ];

            for (const z of zooms) {
                const btn = zoomGroup.createEl('button', {
                    cls: `timebox-gantt-zoom-btn ${this.zoomLevel === z.id ? 'is-active' : ''}`,
                    text: z.label
                });
                btn.addEventListener('click', () => {
                    this.zoomLevel = z.id;
                    void this.render();
                });
            }

            const todayBtn = centerGroup.createEl('button', {
                cls: 'timebox-gantt-today-btn',
                text: 'Today'
            });
            todayBtn.addEventListener('click', () => {
                this.scrollToToday();
            });
        }

        // Critical Path Toggle Button
        const cpmBtn = centerGroup.createEl('button', {
            cls: `timebox-gantt-toggle-btn ${this.showCriticalPath ? 'is-active' : ''}`,
            text: '⚡ Critical Path'
        });
        cpmBtn.title = 'Highlight Critical Path tasks with zero float driving the finish date';
        cpmBtn.addEventListener('click', () => {
            this.showCriticalPath = !this.showCriticalPath;
            void this.render();
        });

        // Baseline Controls
        const baselineGroup = centerGroup.createDiv({ cls: 'timebox-gantt-button-group' });
        const baseToggleBtn = baselineGroup.createEl('button', {
            cls: `timebox-gantt-toggle-btn ${this.showBaselines ? 'is-active' : ''}`,
            text: '📊 Baseline'
        });
        baseToggleBtn.title = 'Show/hide baseline comparison ghost bars';
        baseToggleBtn.addEventListener('click', () => {
            this.showBaselines = !this.showBaselines;
            void this.render();
        });

        const saveBaseBtn = baselineGroup.createEl('button', {
            cls: 'timebox-gantt-toggle-btn',
            text: 'Set Baseline'
        });
        saveBaseBtn.title = 'Snapshot current schedule as Baseline 0';
        saveBaseBtn.addEventListener('click', () => {
            void (async () => {
                await this.projectManager.saveProjectBaseline(projectData.file, 'baseline0');
                new Notice('Saved current schedule as Baseline 0');
                this.showBaselines = true;
                void this.render();
            })();
        });

        // Right controls: Add Task, Add Subtask, Task Info, Refresh
        const rightGroup = toolbarEl.createDiv({ cls: 'timebox-gantt-toolbar-right' });

        const quickAddBtn = rightGroup.createEl('button', {
            cls: 'timebox-gantt-action-btn',
            text: '+ Task'
        });
        quickAddBtn.title = 'Add new task (or use inline add row below)';
        quickAddBtn.addEventListener('click', () => {
            void this.createNewTask(projectData, false);
        });

        const addSubtaskBtn = rightGroup.createEl('button', {
            cls: 'timebox-gantt-action-btn',
            text: '+ Subtask'
        });
        addSubtaskBtn.title = 'Add subtask under selected task';
        addSubtaskBtn.addEventListener('click', () => {
            void this.createNewTask(projectData, true);
        });

        const infoBtn = rightGroup.createEl('button', {
            cls: 'timebox-task-icon-btn',
            title: 'Task Information (or double-click row)'
        });
        setIcon(infoBtn, 'sliders');
        infoBtn.addEventListener('click', () => {
            if (this.selectedTaskLine !== null) {
                const selectedRow = rows.find(r => r.task.lineIndex === this.selectedTaskLine);
                if (selectedRow) {
                    new TaskInformationModal(
                        this.app,
                        projectData.file,
                        selectedRow.task,
                        this.projectManager,
                        () => void this.render()
                    ).open();
                }
            } else {
                new Notice('Click a task row first to view properties');
            }
        });

        const refreshBtn = rightGroup.createEl('button', {
            cls: 'timebox-task-icon-btn',
            title: 'Refresh timeline'
        });
        setIcon(refreshBtn, 'refresh-cw');
        refreshBtn.addEventListener('click', () => {
            void this.render();
        });
    }

    private flattenTasks(tasks: ProjectTask[]): FlattenedGanttRow[] {
        const rows: FlattenedGanttRow[] = [];

        tasks.forEach((parentTask) => {
            const isParent = parentTask.subtasks.length > 0;
            const isCollapsed = this.collapsedTaskLines.has(parentTask.lineIndex);

            rows.push({
                task: parentTask,
                isParent,
                isSubtask: false,
                hasDates: !!(parentTask.startDate || parentTask.dueDate),
                startDate: parentTask.startDate,
                dueDate: parentTask.dueDate,
                durationDays: parentTask.durationDays,
                isMilestone: parentTask.isMilestone,
                visible: true,
                wbsCode: parentTask.wbsCode || String(parentTask.wbsIndex || 1),
                wbsIndex: parentTask.wbsIndex || 1,
                resource: parentTask.resource,
                predecessors: parentTask.predecessors || [],
                isBlocked: !!parentTask.isBlocked,
                isCritical: !!parentTask.isCritical,
                totalFloat: parentTask.totalFloat || 0,
                freeFloat: parentTask.freeFloat || 0,
                workHours: parentTask.workHours || (parentTask.durationDays * 8),
                percentComplete: parentTask.percentComplete || 0,
                constraintType: parentTask.constraintType,
                constraintDate: parentTask.constraintDate,
                baselineStart: parentTask.baselineStart,
                baselineFinish: parentTask.baselineFinish,
                description: parentTask.description,
                workingIntervals: parentTask.workingIntervals || (parentTask.startDate && parentTask.dueDate ? WorkingCalendar.getWorkingIntervals(parentTask.startDate, parentTask.dueDate) : [])
            });

            if (isParent) {
                parentTask.subtasks.forEach((subtask) => {
                    rows.push({
                        task: subtask,
                        isParent: false,
                        isSubtask: true,
                        hasDates: !!(subtask.startDate || subtask.dueDate),
                        startDate: subtask.startDate,
                        dueDate: subtask.dueDate,
                        durationDays: subtask.durationDays,
                        isMilestone: subtask.isMilestone,
                        visible: !isCollapsed,
                        parentIndex: parentTask.lineIndex,
                        wbsCode: subtask.wbsCode || '',
                        wbsIndex: subtask.wbsIndex || 1,
                        resource: subtask.resource,
                        predecessors: subtask.predecessors || [],
                        isBlocked: !!subtask.isBlocked,
                        isCritical: !!subtask.isCritical,
                        totalFloat: subtask.totalFloat || 0,
                        freeFloat: subtask.freeFloat || 0,
                        workHours: subtask.workHours || (subtask.durationDays * 8),
                        percentComplete: subtask.percentComplete || 0,
                        constraintType: subtask.constraintType,
                        constraintDate: subtask.constraintDate,
                        baselineStart: subtask.baselineStart,
                        baselineFinish: subtask.baselineFinish,
                        description: subtask.description,
                        workingIntervals: subtask.workingIntervals || (subtask.startDate && subtask.dueDate ? WorkingCalendar.getWorkingIntervals(subtask.startDate, subtask.dueDate) : [])
                    });
                });
            }
        });

        return rows;
    }


    private renderWbsPane(container: HTMLElement, projectData: ProjectData, rows: FlattenedGanttRow[]): void {
        const wbsEl = container.createDiv({ cls: 'timebox-gantt-wbs-pane' });
        wbsEl.setCssStyles({ width: `${this.wbsWidth}px` });

        // Header
        const headerEl = wbsEl.createDiv({ cls: 'timebox-gantt-wbs-header' });
        headerEl.createDiv({ cls: 'timebox-wbs-col-id', text: '#' });
        headerEl.createDiv({ cls: 'timebox-wbs-col-task', text: 'Task Name' });
        headerEl.createDiv({ cls: 'timebox-wbs-col-desc', text: 'Description' });
        headerEl.createDiv({ cls: 'timebox-wbs-col-start', text: 'Start' });
        headerEl.createDiv({ cls: 'timebox-wbs-col-due', text: 'Due' });
        headerEl.createDiv({ cls: 'timebox-wbs-col-dur', text: 'Dur' });
        headerEl.createDiv({ cls: 'timebox-wbs-col-pred', text: 'Pred' });
        headerEl.createDiv({ cls: 'timebox-wbs-col-res', text: 'Resource' });
        headerEl.createDiv({ cls: 'timebox-wbs-col-actions', text: '' });

        // Body
        this.wbsBodyEl = wbsEl.createDiv({ cls: 'timebox-gantt-wbs-body' });

        rows.forEach((row) => {
            if (!row.visible) return;

            const isSelected = this.selectedTaskLine === row.task.lineIndex;
            const isTitleTask = projectData.hasProjectTitleTask && row.wbsCode === '0';
            const rowEl = this.wbsBodyEl!.createDiv({
                cls: `timebox-gantt-wbs-row ${row.isParent ? 'is-parent-row' : ''} ${isTitleTask ? 'is-project-title-row' : ''} ${row.task.completed ? 'is-completed' : ''} ${isSelected ? 'timebox-wbs-row-active' : ''} ${row.isBlocked ? 'is-blocked' : ''}`
            });

            // Row selection
            rowEl.addEventListener('click', () => {
                this.selectedTaskLine = row.task.lineIndex;
                this.wbsBodyEl?.querySelectorAll('.timebox-gantt-wbs-row').forEach(r => r.removeClass('timebox-wbs-row-active'));
                rowEl.addClass('timebox-wbs-row-active');
            });

            // Double click opens TaskInformationModal
            rowEl.addEventListener('dblclick', (e) => {
                const target = e.target as HTMLElement;
                if (!target.tagName.toLowerCase().includes('input') && !target.tagName.toLowerCase().includes('textarea')) {
                    new TaskInformationModal(
                        this.app,
                        projectData.file,
                        row.task,
                        this.projectManager,
                        () => void this.render()
                    ).open();
                }
            });

            // 1. WBS Code Column (#)
            rowEl.createDiv({
                cls: 'timebox-wbs-col-id',
                text: row.wbsCode
            });

            // 2. Task Name Column
            const taskCol = rowEl.createDiv({ cls: 'timebox-wbs-col-task' });

            // Indentation & Expand/Collapse Caret
            if (row.isSubtask) {
                taskCol.createSpan({ cls: 'timebox-wbs-indent' });
            }

            if (row.isParent) {
                const isCollapsed = this.collapsedTaskLines.has(row.task.lineIndex);
                const chevron = taskCol.createEl('button', {
                    cls: 'timebox-task-icon-btn timebox-wbs-chevron'
                });
                setIcon(chevron, isCollapsed ? 'chevron-right' : 'chevron-down');
                chevron.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (isCollapsed) {
                        this.collapsedTaskLines.delete(row.task.lineIndex);
                    } else {
                        this.collapsedTaskLines.add(row.task.lineIndex);
                    }
                    void this.render();
                });
            } else if (!row.isSubtask) {
                taskCol.createSpan({ cls: 'timebox-wbs-chevron-spacer' });
            }

            // Dependency Lock Icon (if blocked by predecessor)
            if (row.isBlocked) {
                const lockIcon = taskCol.createSpan({
                    cls: 'timebox-wbs-lock-icon',
                    text: '🔒'
                });
                lockIcon.title = `Execution Blocked: Predecessor task(s) (#${row.predecessors.join(', ')}) must be completed first.`;
            }

            // Checkbox with Predecessor Execution Lock Enforcement
            const checkbox = taskCol.createEl('input', {
                type: 'checkbox',
                cls: 'task-list-item-checkbox timebox-wbs-checkbox'
            });
            checkbox.checked = row.task.completed;
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
                // Execution Lock Rule: cannot complete if predecessors are incomplete!
                if (!row.task.completed && row.isBlocked) {
                    e.preventDefault();
                    checkbox.checked = false;
                    new Notice(
                        `⛔ Execution Locked: Task #${row.wbsCode} cannot be started/completed until predecessor task(s) (#${row.predecessors.join(', ')}) finish!`,
                        5000
                    );
                    return;
                }

                void (async () => {
                    await this.projectManager.toggleProjectTaskCompletion(
                        projectData.file,
                        row.task.lineIndex,
                        checkbox.checked
                    );
                    void this.render();
                })();
            });

            // Clean Title with Inline Renaming on Click
            const titleSpan = taskCol.createSpan({
                cls: 'timebox-wbs-title',
                text: row.task.cleanTitle || row.task.text
            });
            titleSpan.title = `${row.task.text} (Click to edit or double-click for modal)`;
            titleSpan.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectedTaskLine = row.task.lineIndex;
                this.wbsBodyEl?.querySelectorAll('.timebox-gantt-wbs-row').forEach(r => r.removeClass('timebox-wbs-row-active'));
                rowEl.addClass('timebox-wbs-row-active');

                this.startInlineTextEdit(titleSpan, row.task.cleanTitle, 'Task Name', async (newTitle) => {
                    if (newTitle && newTitle !== row.task.cleanTitle) {
                        await this.projectManager.updateTaskDetails(projectData.file, row.task.lineIndex, {
                            title: newTitle
                        });
                        void this.render();
                    }
                });
            });

            // 3. Description Column (Inline Text Editor)
            const descCol = rowEl.createDiv({
                cls: 'timebox-wbs-col-desc',
                text: row.description || '-'
            });
            descCol.title = row.description ? `Description: ${row.description}` : 'Click to add description';
            descCol.addEventListener('click', (e) => {
                e.stopPropagation();
                this.startInlineTextEdit(descCol, row.description || '', 'Description', async (newDesc) => {
                    await this.projectManager.updateTaskDetails(projectData.file, row.task.lineIndex, {
                        description: newDesc || undefined
                    });
                    void this.render();
                });
            });

            // 4. Start Date column (Inline Date Editor)
            const startCol = rowEl.createDiv({
                cls: 'timebox-wbs-col-start',
                text: row.startDate ? getMoment(row.startDate, 'YYYY-MM-DD').format('MM/DD') : '-'
            });
            startCol.title = row.startDate ? `${row.startDate} (Click to edit)` : 'Set start date';
            startCol.addEventListener('click', (e) => {
                e.stopPropagation();
                this.startInlineDateEdit(startCol, row.startDate, async (newStartDate) => {
                    if (newStartDate) {
                        const snapped = WorkingCalendar.snapToWorkingDay(newStartDate);
                        let newDue = row.dueDate;
                        if (row.durationDays > 0) {
                            newDue = WorkingCalendar.addWorkingDays(snapped, row.durationDays);
                        }
                        await this.projectManager.updateTaskDetails(projectData.file, row.task.lineIndex, {
                            startDate: snapped,
                            dueDate: newDue
                        });
                        void this.render();
                    }
                });
            });

            // 5. Due Date column (Inline Date Editor)
            const dueCol = rowEl.createDiv({
                cls: 'timebox-wbs-col-due',
                text: row.dueDate ? getMoment(row.dueDate, 'YYYY-MM-DD').format('MM/DD') : '-'
            });
            dueCol.title = row.dueDate ? `${row.dueDate} (Click to edit)` : 'Set due date';
            dueCol.addEventListener('click', (e) => {
                e.stopPropagation();
                this.startInlineDateEdit(dueCol, row.dueDate, async (newDueDate) => {
                    if (newDueDate) {
                        let newDur = row.durationDays;
                        if (row.startDate) {
                            newDur = WorkingCalendar.calculateWorkingDays(row.startDate, newDueDate);
                        }
                        await this.projectManager.updateTaskDetails(projectData.file, row.task.lineIndex, {
                            dueDate: newDueDate,
                            durationDays: newDur
                        });
                        void this.render();
                    }
                });
            });

            // 6. Duration column (Inline Number Editor)
            const durText = row.isMilestone ? '0d' : (row.durationDays > 0 ? `${row.durationDays}d` : '-');
            const durCol = rowEl.createDiv({
                cls: 'timebox-wbs-col-dur',
                text: durText
            });
            durCol.title = 'Duration in working days (click to edit)';
            durCol.addEventListener('click', (e) => {
                e.stopPropagation();
                if (row.isMilestone) return;
                this.startInlineNumberEdit(durCol, row.durationDays || 1, async (newDur) => {
                    if (newDur > 0) {
                        let newDue = row.dueDate;
                        if (row.startDate) {
                            newDue = WorkingCalendar.addWorkingDays(row.startDate, newDur);
                        }
                        await this.projectManager.updateTaskDetails(projectData.file, row.task.lineIndex, {
                            durationDays: newDur,
                            dueDate: newDue
                        });
                        void this.render();
                    }
                });
            });

            // 7. Predecessors column (Inline Text Editor)
            const predText = row.predecessors && row.predecessors.length > 0 ? row.predecessors.join(', ') : '-';
            const predCol = rowEl.createDiv({
                cls: 'timebox-wbs-col-pred',
                text: predText
            });
            predCol.title = 'Predecessors (WBS #, click to edit)';
            predCol.addEventListener('click', (e) => {
                e.stopPropagation();
                this.startInlineTextEdit(predCol, row.predecessors.join(', '), '2.1, 2.2', async (raw) => {
                    const preds = raw
                        ? raw.split(',').map(s => s.replace(/#/g, '').trim()).filter(s => s.length > 0)
                        : [];
                    await this.projectManager.updateTaskDetails(projectData.file, row.task.lineIndex, {
                        predecessors: preds
                    });
                    void this.render();
                });
            });

            // 8. Resource column (Inline Text Editor)
            const resText = row.resource ? `@${row.resource}` : '-';
            const resCol = rowEl.createDiv({
                cls: 'timebox-wbs-col-res',
                text: resText
            });
            resCol.title = 'Assigned resource (click to edit)';
            resCol.addEventListener('click', (e) => {
                e.stopPropagation();
                this.startInlineTextEdit(resCol, row.resource || '', 'Name', async (raw) => {
                    const cleanRes = raw.trim().replace(/^@/, '');
                    await this.projectManager.updateTaskDetails(projectData.file, row.task.lineIndex, {
                        resource: cleanRes || undefined
                    });
                    void this.render();
                });
            });

            // 9. Actions column (Info modal button)
            const actionsCol = rowEl.createDiv({ cls: 'timebox-wbs-col-actions' });
            const editBtn = actionsCol.createEl('button', {
                cls: 'timebox-task-icon-btn timebox-wbs-edit-btn',
                title: 'Open Task Information modal'
            });
            setIcon(editBtn, 'sliders');
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                new TaskInformationModal(
                    this.app,
                    projectData.file,
                    row.task,
                    this.projectManager,
                    () => void this.render()
                ).open();
            });
        });

        // 10. Persistent Inline Quick-Add Task Row at Bottom of Table
        const addRowEl = this.wbsBodyEl.createDiv({ cls: 'timebox-wbs-add-row' });
        
        addRowEl.createDiv({
            cls: 'timebox-wbs-col-id',
            text: '+'
        });

        const addInputCol = addRowEl.createDiv({ cls: 'timebox-wbs-col-task' });
        const addInput = addInputCol.createEl('input', {
            type: 'text',
            cls: 'timebox-wbs-add-input',
            placeholder: '+ Add task and press Enter...'
        });

        const addDescCol = addRowEl.createDiv({ cls: 'timebox-wbs-col-desc' });
        const addDescInput = addDescCol.createEl('input', {
            type: 'text',
            cls: 'timebox-wbs-add-input',
            placeholder: 'Description...'
        });

        const commitQuickAdd = async () => {
            const taskText = addInput.value.trim();
            if (!taskText) return;

            const descText = addDescInput.value.trim();
            const todayStr = WorkingCalendar.snapToWorkingDay(getMoment().format('YYYY-MM-DD'));
            const dueStr = WorkingCalendar.addWorkingDays(todayStr, 3);

            const lastLine = rows.length > 0
                ? rows[rows.length - 1].task.lineIndex + rows[rows.length - 1].task.lineCount - 1
                : 0;

            await this.projectManager.insertTaskAt(
                projectData.file,
                lastLine,
                taskText,
                todayStr,
                dueStr,
                3,
                undefined,
                false,
                descText || undefined
            );

            addInput.value = '';
            addDescInput.value = '';
            void this.render();
        };

        addInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                void commitQuickAdd();
            }
        });

        addDescInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                void commitQuickAdd();
            }
        });
    }

    // Direct Task / Subtask creation helper
    private async createNewTask(projectData: ProjectData, isSubtask: boolean): Promise<void> {
        const todayStr = WorkingCalendar.snapToWorkingDay(getMoment().format('YYYY-MM-DD'));
        const defaultDur = isSubtask ? 2 : 3;
        const dueStr = WorkingCalendar.addWorkingDays(todayStr, defaultDur);

        let insertAfterLine = 0;
        const allTasks = projectData.tasks;

        if (this.selectedTaskLine !== null) {
            // Find task in projectData
            let foundTask: ProjectTask | null = null;
            for (const p of allTasks) {
                if (p.lineIndex === this.selectedTaskLine) {
                    foundTask = p;
                    break;
                }
                for (const s of p.subtasks) {
                    if (s.lineIndex === this.selectedTaskLine) {
                        foundTask = s;
                        break;
                    }
                }
                if (foundTask) break;
            }

            if (foundTask) {
                insertAfterLine = foundTask.lineIndex + foundTask.lineCount - 1;
                if (isSubtask && this.collapsedTaskLines.has(foundTask.lineIndex)) {
                    this.collapsedTaskLines.delete(foundTask.lineIndex);
                }
            } else {
                insertAfterLine = this.selectedTaskLine;
            }
        } else {
            // Insert at the end of the project note
            if (allTasks.length > 0) {
                const lastTask = allTasks[allTasks.length - 1];
                insertAfterLine = lastTask.lineIndex + lastTask.lineCount - 1;
            }
        }

        const taskTitle = isSubtask ? 'New Subtask' : 'New Task';
        const newLineIdx = await this.projectManager.insertTaskAt(
            projectData.file,
            insertAfterLine,
            taskTitle,
            todayStr,
            dueStr,
            defaultDur,
            undefined,
            isSubtask
        );

        this.selectedTaskLine = newLineIdx;
        await this.render();

        // Immediately trigger inline renaming on the newly created row
        window.setTimeout(() => {
            const rowEls = this.wbsBodyEl?.querySelectorAll('.timebox-gantt-wbs-row');
            if (rowEls) {
                for (let i = 0; i < rowEls.length; i++) {
                    const r = rowEls[i] as HTMLElement;
                    if (r.classList.contains('timebox-wbs-row-active')) {
                        const titleEl = r.querySelector('.timebox-wbs-title') as HTMLElement;
                        if (titleEl) {
                            titleEl.click();
                        }
                        break;
                    }
                }
            }
        }, 80);
    }

    // Inline Editors helpers
    private startInlineTextEdit(
        container: HTMLElement,
        currentValue: string,
        placeholder: string,
        onSave: (val: string) => Promise<void>
    ): void {
        container.empty();
        const input = container.createEl('input', {
            type: 'text',
            cls: 'timebox-wbs-inline-input',
            value: currentValue,
            placeholder
        });
        input.focus();
        input.select();

        let committed = false;
        const commit = async () => {
            if (committed) return;
            committed = true;
            const val = input.value.trim();
            await onSave(val);
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                input.blur();
            } else if (e.key === 'Escape') {
                committed = true;
                container.setText(currentValue || '-');
            }
        });

        input.addEventListener('blur', () => {
            void commit();
        });
    }

    private startInlineDateEdit(
        container: HTMLElement,
        currentDate: string | undefined,
        onSave: (val: string) => Promise<void>
    ): void {
        container.empty();
        const input = container.createEl('input', {
            type: 'date',
            cls: 'timebox-wbs-inline-input is-date',
            value: currentDate || ''
        });
        input.focus();

        let committed = false;
        const commit = async () => {
            if (committed) return;
            committed = true;
            const val = input.value;
            await onSave(val);
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                input.blur();
            } else if (e.key === 'Escape') {
                committed = true;
                container.setText(currentDate ? getMoment(currentDate, 'YYYY-MM-DD').format('MM/DD') : '-');
            }
        });

        input.addEventListener('change', () => {
            void commit();
        });

        input.addEventListener('blur', () => {
            void commit();
        });
    }

    private startInlineNumberEdit(
        container: HTMLElement,
        currentVal: number,
        onSave: (val: number) => Promise<void>
    ): void {
        container.empty();
        const input = container.createEl('input', {
            type: 'number',
            cls: 'timebox-wbs-inline-input is-number',
            value: currentVal > 0 ? String(currentVal) : '1'
        });
        input.min = '1';
        input.max = '365';
        input.focus();
        input.select();

        let committed = false;
        const commit = async () => {
            if (committed) return;
            committed = true;
            const val = parseInt(input.value, 10);
            await onSave(isNaN(val) || val < 1 ? 1 : val);
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                input.blur();
            } else if (e.key === 'Escape') {
                committed = true;
                container.setText(currentVal > 0 ? `${currentVal}d` : '-');
            }
        });

        input.addEventListener('change', () => {
            void commit();
        });

        input.addEventListener('blur', () => {
            void commit();
        });
    }

    private renderSplitter(container: HTMLElement): void {
        const splitter = container.createDiv({ cls: 'timebox-gantt-splitter' });

        let startX = 0;
        let startW = this.wbsWidth;

        const onMouseMove = (e: MouseEvent) => {
            const delta = e.clientX - startX;
            const newWidth = Math.max(220, Math.min(800, startW + delta));
            this.wbsWidth = newWidth;
            const wbsEl = container.querySelector('.timebox-gantt-wbs-pane') as HTMLElement;
            if (wbsEl) {
                wbsEl.setCssStyles({ width: `${newWidth}px` });
            }
        };

        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            document.body.removeClass('is-resizing-gantt-splitter');
        };

        splitter.addEventListener('mousedown', (e) => {
            startX = e.clientX;
            startW = this.wbsWidth;
            document.body.addClass('is-resizing-gantt-splitter');
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        });
    }

    private renderTimelinePane(container: HTMLElement, projectData: ProjectData, rows: FlattenedGanttRow[]): void {
        const timelinePane = container.createDiv({ cls: 'timebox-gantt-timeline-pane' });
        this.timelineScrollEl = timelinePane;

        // Determine timeline time range
        const today = getMoment().startOf('day');
        let minDate = today.clone().subtract(7, 'days');
        let maxDate = today.clone().add(21, 'days');

        const validStartDates: moment.Moment[] = [];
        const validDueDates: moment.Moment[] = [];

        rows.forEach(r => {
            if (r.startDate) validStartDates.push(getMoment(r.startDate, 'YYYY-MM-DD'));
            if (r.dueDate) validDueDates.push(getMoment(r.dueDate, 'YYYY-MM-DD'));
        });

        if (validStartDates.length > 0) {
            const earliest = moment.min(validStartDates);
            if (earliest.isBefore(minDate)) {
                minDate = earliest.clone().subtract(5, 'days');
            }
        }

        if (validDueDates.length > 0) {
            const latest = moment.max(validDueDates);
            if (latest.isAfter(maxDate)) {
                maxDate = latest.clone().add(10, 'days');
            }
        }

        // Align boundaries to week starts
        minDate = minDate.startOf('isoWeek');
        maxDate = maxDate.endOf('isoWeek');

        const totalDays = maxDate.diff(minDate, 'days') + 1;
        const columnWidth = this.zoomLevel === 'day' ? 36 : (this.zoomLevel === 'week' ? 18 : 6);
        const timelineWidth = totalDays * columnWidth;
        const rowHeight = 36;

        const visibleRows = rows.filter(r => r.visible);
        const timelineHeight = visibleRows.length * rowHeight;

        // Render Timeline Header
        const headerEl = timelinePane.createDiv({ cls: 'timebox-gantt-timeline-header' });
        headerEl.setCssStyles({ width: `${timelineWidth}px` });

        this.renderTimelineHeader(headerEl, minDate, totalDays, columnWidth);

        // Render Timeline Body
        this.timelineBodyEl = timelinePane.createDiv({ cls: 'timebox-gantt-timeline-body' });
        this.timelineBodyEl.setCssStyles({
            width: `${timelineWidth}px`,
            height: `${timelineHeight}px`
        });

        // Background grid SVG with Arrow Marker Defs
        const gridSvg = this.createSvgElement('svg', {
            class: 'timebox-gantt-grid-svg',
            width: `${timelineWidth}`,
            height: `${timelineHeight}`
        });

        // Add SVG Defs for Dependency Arrowheads
        const defs = this.createSvgElement('defs', {});

        const makeMarker = (id: string, colorClass: string) => {
            const marker = this.createSvgElement('marker', {
                id,
                viewBox: '0 0 10 10',
                refX: '8',
                refY: '5',
                markerWidth: '6',
                markerHeight: '6',
                orient: 'auto-start-reverse'
            });
            const path = this.createSvgElement('path', {
                d: 'M 0 1 L 10 5 L 0 9 z',
                class: colorClass
            });
            marker.appendChild(path);
            return marker;
        };

        defs.appendChild(makeMarker('gantt-arrow-normal', 'timebox-gantt-marker-normal'));
        defs.appendChild(makeMarker('gantt-arrow-blocked', 'timebox-gantt-marker-blocked'));
        defs.appendChild(makeMarker('gantt-arrow-completed', 'timebox-gantt-marker-completed'));
        gridSvg.appendChild(defs);
        this.timelineBodyEl.appendChild(gridSvg);

        // Draw weekend shading & day grid lines
        for (let i = 0; i < totalDays; i++) {
            const currentDay = minDate.clone().add(i, 'days');
            const x = i * columnWidth;
            const isWeekend = currentDay.isoWeekday() === 6 || currentDay.isoWeekday() === 7;

            if (isWeekend) {
                const weekendRect = this.createSvgElement('rect', {
                    x: `${x}`,
                    y: '0',
                    width: `${columnWidth}`,
                    height: `${timelineHeight}`,
                    class: 'timebox-gantt-weekend-shading'
                });
                gridSvg.appendChild(weekendRect);
            }

            const gridLine = this.createSvgElement('line', {
                x1: `${x}`,
                y1: '0',
                x2: `${x}`,
                y2: `${timelineHeight}`,
                class: 'timebox-gantt-grid-line'
            });
            gridSvg.appendChild(gridLine);
        }

        // Draw Today vertical line
        const todayDiff = today.diff(minDate, 'days');
        if (todayDiff >= 0 && todayDiff < totalDays) {
            const todayX = todayDiff * columnWidth + (columnWidth / 2);
            const todayLine = this.createSvgElement('line', {
                x1: `${todayX}`,
                y1: '0',
                x2: `${todayX}`,
                y2: `${timelineHeight}`,
                class: 'timebox-gantt-today-line'
            });
            gridSvg.appendChild(todayLine);
        }

        // Collect Task Coordinates for Dependency Arrow Rendering
        interface TaskBarCoords {
            rowIndex: number;
            barLeft: number;
            barRight: number;
            centerY: number;
            completed: boolean;
        }
        const taskCoordsByWbs = new Map<string, TaskBarCoords>();

        // Precompute coordinates for each visible task
        visibleRows.forEach((row, rowIndex) => {
            const y = rowIndex * rowHeight;

            // Draw horizontal row dividing line
            const rowLine = this.createSvgElement('line', {
                x1: '0',
                y1: `${y + rowHeight}`,
                x2: `${timelineWidth}`,
                y2: `${y + rowHeight}`,
                class: 'timebox-gantt-row-line'
            });
            gridSvg.appendChild(rowLine);

            if (row.hasDates && (row.startDate || row.dueDate)) {
                const startM = row.startDate ? getMoment(row.startDate, 'YYYY-MM-DD') : getMoment(row.dueDate, 'YYYY-MM-DD');
                const dueM = row.dueDate ? getMoment(row.dueDate, 'YYYY-MM-DD') : startM.clone();
                const startDayIndex = startM.diff(minDate, 'days');
                const duration = Math.max(1, dueM.diff(startM, 'days') + 1);

                const barLeft = startDayIndex * columnWidth;
                const barRight = barLeft + Math.max(14, duration * columnWidth);
                const centerY = y + rowHeight / 2;

                const coords: TaskBarCoords = {
                    rowIndex,
                    barLeft,
                    barRight,
                    centerY,
                    completed: row.task.completed
                };
                taskCoordsByWbs.set(row.wbsCode, coords);
                taskCoordsByWbs.set(String(row.wbsIndex), coords);
            }
        });

        // Render Dependency Connector Lines (SVG)
        const depGroup = this.createSvgElement('g', { class: 'timebox-gantt-dependencies' });
        gridSvg.appendChild(depGroup);

        visibleRows.forEach((row) => {
            if (row.predecessors && row.predecessors.length > 0) {
                const succCoords = taskCoordsByWbs.get(row.wbsCode) || taskCoordsByWbs.get(String(row.wbsIndex));
                if (!succCoords) return;

                row.predecessors.forEach((predKey) => {
                    const predCoords = taskCoordsByWbs.get(predKey);
                    if (!predCoords) return;

                    const startX = predCoords.barRight;
                    const startY = predCoords.centerY;
                    const endX = succCoords.barLeft;
                    const endY = succCoords.centerY;

                    // Orthogonal stepped SVG path
                    let pathD = '';
                    if (endX >= startX + 12) {
                        pathD = `M ${startX} ${startY} L ${startX + 6} ${startY} L ${startX + 6} ${endY} L ${endX} ${endY}`;
                    } else {
                        const midY = startY < endY ? startY + (rowHeight / 2) : startY - (rowHeight / 2);
                        pathD = `M ${startX} ${startY} L ${startX + 8} ${startY} L ${startX + 8} ${midY} L ${endX - 10} ${midY} L ${endX - 10} ${endY} L ${endX} ${endY}`;
                    }

                    let markerId = 'gantt-arrow-normal';
                    let pathClass = 'timebox-gantt-dep-path';

                    if (row.isBlocked) {
                        markerId = 'gantt-arrow-blocked';
                        pathClass += ' is-blocked';
                    } else if (predCoords.completed) {
                        markerId = 'gantt-arrow-completed';
                        pathClass += ' is-completed';
                    }

                    const pathEl = this.createSvgElement('path', {
                        d: pathD,
                        class: pathClass,
                        'marker-end': `url(#${markerId})`
                    });
                    depGroup.appendChild(pathEl);
                });
            }
        });

        // Render Task Bars & Split Weekend Segments
        visibleRows.forEach((row, rowIndex) => {
            if (row.hasDates && (row.startDate || row.dueDate)) {
                this.renderTaskBar(
                    this.timelineBodyEl!,
                    gridSvg,
                    projectData,
                    row,
                    rowIndex,
                    minDate,
                    columnWidth,
                    rowHeight
                );
            }
        });
    }

    private renderTimelineHeader(headerEl: HTMLElement, minDate: moment.Moment, totalDays: number, colWidth: number): void {
        const topRow = headerEl.createDiv({ cls: 'timebox-gantt-header-row is-top' });
        const botRow = headerEl.createDiv({ cls: 'timebox-gantt-header-row is-bottom' });

        let currentMonth = '';
        let monthStartCol = 0;
        let monthDaysCount = 0;

        for (let i = 0; i < totalDays; i++) {
            const date = minDate.clone().add(i, 'days');
            const monthName = date.format('MMMM YYYY');

            if (monthName !== currentMonth) {
                if (currentMonth !== '') {
                    const monthCell = topRow.createDiv({ cls: 'timebox-gantt-header-cell is-month' });
                    monthCell.setCssStyles({
                        left: `${monthStartCol * colWidth}px`,
                        width: `${monthDaysCount * colWidth}px`
                    });
                    monthCell.setText(currentMonth);
                }
                currentMonth = monthName;
                monthStartCol = i;
                monthDaysCount = 1;
            } else {
                monthDaysCount++;
            }

            // Bottom row day cell
            const dayCell = botRow.createDiv({ cls: 'timebox-gantt-header-cell is-day' });
            dayCell.setCssStyles({
                left: `${i * colWidth}px`,
                width: `${colWidth}px`
            });

            if (this.zoomLevel === 'day') {
                dayCell.setText(date.format('D'));
                if (date.isSame(getMoment(), 'day')) {
                    dayCell.addClass('is-today');
                }
            } else if (this.zoomLevel === 'week') {
                if (date.isoWeekday() === 1) {
                    dayCell.setText(`W${date.isoWeek()}`);
                }
            } else {
                if (date.date() === 1) {
                    dayCell.setText(date.format('MMM'));
                }
            }
        }

        // Final month cell
        if (currentMonth !== '') {
            const monthCell = topRow.createDiv({ cls: 'timebox-gantt-header-cell is-month' });
            monthCell.setCssStyles({
                left: `${monthStartCol * colWidth}px`,
                width: `${monthDaysCount * colWidth}px`
            });
            monthCell.setText(currentMonth);
        }
    }

    private renderTaskBar(
        container: HTMLElement,
        gridSvg: SVGElement,
        projectData: ProjectData,
        row: FlattenedGanttRow,
        rowIndex: number,
        minDate: moment.Moment,
        colWidth: number,
        rowHeight: number
    ): void {
        const startM = row.startDate ? getMoment(row.startDate, 'YYYY-MM-DD') : getMoment(row.dueDate, 'YYYY-MM-DD');
        const dueM = row.dueDate ? getMoment(row.dueDate, 'YYYY-MM-DD') : startM.clone();

        const startDayIndex = startM.diff(minDate, 'days');
        const duration = Math.max(1, dueM.diff(startM, 'days') + 1);

        const leftPx = startDayIndex * colWidth;
        const widthPx = duration * colWidth;
        const topPx = rowIndex * rowHeight + 6;
        const barHeight = rowHeight - 12;

        if (row.isMilestone) {
            // Milestone diamond
            const diamondSize = 14;
            const centerX = leftPx + colWidth / 2;
            const centerY = rowIndex * rowHeight + rowHeight / 2;

            const diamond = this.createSvgElement('polygon', {
                points: `${centerX},${centerY - diamondSize / 2} ${centerX + diamondSize / 2},${centerY} ${centerX},${centerY + diamondSize / 2} ${centerX - diamondSize / 2},${centerY}`,
                class: `timebox-gantt-milestone ${row.task.completed ? 'is-completed' : ''}`
            });
            gridSvg.appendChild(diamond);

            // Title label & Resource badge next to milestone
            const label = this.createSvgElement('text', {
                x: `${centerX + diamondSize / 2 + 6}`,
                y: `${centerY + 4}`,
                class: 'timebox-gantt-bar-label'
            });
            label.textContent = `${row.task.cleanTitle}${row.resource ? ` (@${row.resource})` : ''}`;
            gridSvg.appendChild(label);

            return;
        }

        if (row.isParent) {
            // Microsoft Project Summary Bracket Bar
            const isCritSummary = this.showCriticalPath && row.isCritical && !row.task.completed;
            const barGroup = this.createSvgElement('g', {
                class: `timebox-gantt-summary-group ${row.task.completed ? 'is-completed' : ''} ${isCritSummary ? 'is-critical' : ''}`
            });

            const summaryBar = this.createSvgElement('rect', {
                x: `${leftPx}`,
                y: `${topPx + 2}`,
                width: `${Math.max(6, widthPx)}`,
                height: '7',
                class: `timebox-gantt-summary-bar ${isCritSummary ? 'is-critical' : ''}`
            });
            barGroup.appendChild(summaryBar);

            // Left and Right Downward Triangles
            const leftTriangle = this.createSvgElement('polygon', {
                points: `${leftPx},${topPx + 2} ${leftPx + 6},${topPx + 2} ${leftPx},${topPx + 11}`,
                class: 'timebox-gantt-summary-triangle'
            });
            const rightTriangle = this.createSvgElement('polygon', {
                points: `${leftPx + widthPx},${topPx + 2} ${leftPx + widthPx - 6},${topPx + 2} ${leftPx + widthPx},${topPx + 11}`,
                class: 'timebox-gantt-summary-triangle'
            });
            barGroup.appendChild(leftTriangle);
            barGroup.appendChild(rightTriangle);

            gridSvg.appendChild(barGroup);

            // Baseline ghost bar for summary task if baseline is active
            if (this.showBaselines && row.baselineStart && row.baselineFinish) {
                const baseStartM = getMoment(row.baselineStart, 'YYYY-MM-DD');
                const baseDueM = getMoment(row.baselineFinish, 'YYYY-MM-DD');
                const baseStartDay = baseStartM.diff(minDate, 'days');
                const baseDuration = Math.max(1, baseDueM.diff(baseStartM, 'days') + 1);
                const baseLeftPx = baseStartDay * colWidth;
                const baseWidthPx = baseDuration * colWidth;

                const baseBar = container.createDiv({
                    cls: 'timebox-gantt-baseline-bar is-summary-baseline'
                });
                baseBar.setCssStyles({
                    left: `${baseLeftPx}px`,
                    top: `${topPx + barHeight + 1}px`,
                    width: `${Math.max(8, baseWidthPx)}px`,
                    height: '4px'
                });
                baseBar.title = `Baseline 0: ${row.baselineStart} → ${row.baselineFinish}`;
            }

            return;
        }

        // Regular Task Bar with Weekend Split Rendering
        const intervals = row.workingIntervals && row.workingIntervals.length > 0
            ? row.workingIntervals
            : [{ start: row.startDate || '', end: row.dueDate || '' }];

        const isCrit = this.showCriticalPath && row.isCritical && !row.task.completed;

        intervals.forEach((interval, intvIdx) => {
            const intvStartM = interval.start ? getMoment(interval.start, 'YYYY-MM-DD') : startM;
            const intvDueM = interval.end ? getMoment(interval.end, 'YYYY-MM-DD') : intvStartM;

            const intvStartDay = intvStartM.diff(minDate, 'days');
            const intvDuration = Math.max(1, intvDueM.diff(intvStartM, 'days') + 1);

            const intvLeftPx = intvStartDay * colWidth;
            const intvWidthPx = intvDuration * colWidth;

            const barEl = container.createDiv({
                cls: `timebox-gantt-task-bar ${row.task.completed ? 'is-completed' : ''} ${row.isBlocked ? 'is-blocked' : ''} ${isCrit ? 'is-critical' : ''}`
            });

            barEl.setCssStyles({
                left: `${intvLeftPx}px`,
                top: `${topPx}px`,
                width: `${Math.max(16, intvWidthPx)}px`,
                height: `${barHeight}px`
            });

            // Label on the first segment
            if (intvIdx === 0) {
                barEl.createSpan({
                    cls: 'timebox-gantt-task-bar-text',
                    text: row.task.cleanTitle
                });
            }

            // Drag resize handle on the final segment
            if (intvIdx === intervals.length - 1) {
                const resizeHandle = barEl.createDiv({
                    cls: 'timebox-gantt-drag-handle is-right'
                });

                // Resource tag badge beside the final segment
                if (row.resource) {
                    const tagEl = container.createSpan({
                        cls: 'timebox-gantt-resource-tag',
                        text: `@${row.resource}`
                    });
                    tagEl.setCssStyles({
                        left: `${intvLeftPx + Math.max(16, intvWidthPx) + 6}px`,
                        top: `${topPx + 2}px`
                    });
                }

                // Setup Dragging to reschedule (Shift or Resize)
                this.setupTaskBarDrag(barEl, resizeHandle, projectData.file, row, minDate, colWidth);
            }

            // Draw weekend bridge line in SVG between split segments
            if (intvIdx < intervals.length - 1) {
                const nextIntv = intervals[intvIdx + 1];
                const nextStartM = getMoment(nextIntv.start, 'YYYY-MM-DD');
                const nextLeftPx = nextStartM.diff(minDate, 'days') * colWidth;

                const bridgeLine = this.createSvgElement('line', {
                    x1: `${intvLeftPx + intvWidthPx}`,
                    y1: `${topPx + barHeight / 2}`,
                    x2: `${nextLeftPx}`,
                    y2: `${topPx + barHeight / 2}`,
                    class: 'timebox-gantt-weekend-bridge'
                });
                gridSvg.appendChild(bridgeLine);
            }

            // Context Menu on Task Bar
            barEl.addEventListener('contextmenu', (e: MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                this.showTaskContextMenu(e, projectData, row.task);
            });

            // Double click opens TaskInformationModal
            barEl.addEventListener('dblclick', () => {
                new TaskInformationModal(
                    this.app,
                    projectData.file,
                    row.task,
                    this.projectManager,
                    () => void this.render()
                ).open();
            });
        });

        // Baseline ghost comparison bar for regular task
        if (this.showBaselines && row.baselineStart && row.baselineFinish) {
            const baseStartM = getMoment(row.baselineStart, 'YYYY-MM-DD');
            const baseDueM = getMoment(row.baselineFinish, 'YYYY-MM-DD');
            const baseStartDay = baseStartM.diff(minDate, 'days');
            const baseDuration = Math.max(1, baseDueM.diff(baseStartM, 'days') + 1);
            const baseLeftPx = baseStartDay * colWidth;
            const baseWidthPx = baseDuration * colWidth;

            const baseBar = container.createDiv({
                cls: 'timebox-gantt-baseline-bar'
            });
            baseBar.setCssStyles({
                left: `${baseLeftPx}px`,
                top: `${topPx + barHeight + 1}px`,
                width: `${Math.max(8, baseWidthPx)}px`,
                height: '4px'
            });
            baseBar.title = `Baseline 0: ${row.baselineStart} → ${row.baselineFinish}`;
        }
    }

    private setupTaskBarDrag(
        barEl: HTMLElement,
        resizeHandle: HTMLElement,
        projectFile: TFile,
        row: FlattenedGanttRow,
        minDate: moment.Moment,
        colWidth: number
    ): void {
        let isDragging = false;
        let isResizing = false;
        let startClientX = 0;
        const initialStartM = row.startDate ? getMoment(row.startDate, 'YYYY-MM-DD') : getMoment();
        const initialDueM = row.dueDate ? getMoment(row.dueDate, 'YYYY-MM-DD') : initialStartM.clone();

        const onMouseMove = (e: MouseEvent) => {
            if (!isDragging && !isResizing) return;

            const deltaX = e.clientX - startClientX;
            const daysOffset = Math.round(deltaX / colWidth);

            if (daysOffset === 0) return;

            if (isDragging) {
                const newStart = initialStartM.clone().add(daysOffset, 'days');
                const newDue = initialDueM.clone().add(daysOffset, 'days');
                barEl.addClass('is-dragging');
                barEl.title = `${newStart.format('YYYY-MM-DD')} -> ${newDue.format('YYYY-MM-DD')}`;
            } else if (isResizing) {
                const newDue = initialDueM.clone().add(daysOffset, 'days');
                if (newDue.isSameOrAfter(initialStartM)) {
                    barEl.addClass('is-dragging');
                    barEl.title = `Due: ${newDue.format('YYYY-MM-DD')}`;
                }
            }
        };

        const onMouseUp = (e: MouseEvent) => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            barEl.removeClass('is-dragging');

            if (!isDragging && !isResizing) return;

            const deltaX = e.clientX - startClientX;
            const daysOffset = Math.round(deltaX / colWidth);

            if (daysOffset !== 0) {
                void (async () => {
                    if (isDragging) {
                        const rawStart = initialStartM.clone().add(daysOffset, 'days').format('YYYY-MM-DD');
                        const snappedStart = WorkingCalendar.snapToWorkingDay(rawStart);
                        const newDue = WorkingCalendar.addWorkingDays(snappedStart, row.durationDays || 1);

                        await this.projectManager.updateTaskDetails(projectFile, row.task.lineIndex, {
                            startDate: snappedStart,
                            dueDate: newDue
                        });
                    } else if (isResizing) {
                        const newDue = initialDueM.clone().add(daysOffset, 'days');
                        if (newDue.isSameOrAfter(initialStartM)) {
                            const newDueStr = newDue.format('YYYY-MM-DD');
                            const workingDays = WorkingCalendar.calculateWorkingDays(
                                initialStartM.format('YYYY-MM-DD'),
                                newDueStr
                            );
                            await this.projectManager.updateTaskDetails(projectFile, row.task.lineIndex, {
                                dueDate: newDueStr,
                                durationDays: workingDays
                            });
                        }
                    }
                    void this.render();
                })();
            }

            isDragging = false;
            isResizing = false;
        };

        resizeHandle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            isResizing = true;
            startClientX = e.clientX;
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        });

        barEl.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return; // Only left click
            isDragging = true;
            startClientX = e.clientX;
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        });
    }

    private showTaskContextMenu(e: MouseEvent, projectData: ProjectData, task: ProjectTask): void {
        const menu = new Menu();

        menu.addItem((item) => {
            item.setTitle('Task Information...')
                .setIcon('sliders')
                .onClick(() => {
                    new TaskInformationModal(
                        this.app,
                        projectData.file,
                        task,
                        this.projectManager,
                        () => void this.render()
                    ).open();
                });
        });

        menu.addItem((item) => {
            item.setTitle("Schedule in Today's TimeBox")
                .setIcon('calendar-plus')
                .onClick(() => {
                    void this.projectManager.addProjectTaskToToday(
                        task.cleanTitle,
                        projectData.file,
                        this.plugin.settings.timeBoxFolder,
                        this.plugin.settings.dateFormat
                    );
                });
        });

        menu.addItem((item) => {
            item.setTitle(task.completed ? 'Mark Incomplete' : 'Mark Completed')
                .setIcon(task.completed ? 'circle' : 'check-circle-2')
                .onClick(() => {
                    if (!task.completed && task.isBlocked) {
                        new Notice(
                            `⛔ Execution Locked: Predecessor task(s) must be completed first!`,
                            5000
                        );
                        return;
                    }
                    void (async () => {
                        await this.projectManager.toggleProjectTaskCompletion(
                            projectData.file,
                            task.lineIndex,
                            !task.completed
                        );
                        void this.render();
                    })();
                });
        });

        menu.addSeparator();

        menu.addItem((item) => {
            item.setTitle('Delete Task')
                .setIcon('trash-2')
                .setWarning(true)
                .onClick(() => {
                    void (async () => {
                        await this.projectManager.deleteTaskFromProject(projectData.file, task);
                        void this.render();
                    })();
                });
        });

        menu.showAtPosition({ x: e.clientX, y: e.clientY });
    }

    private setupSyncScroll(): void {
        if (!this.wbsBodyEl || !this.timelineScrollEl) return;

        const wbs = this.wbsBodyEl;
        const timeline = this.timelineScrollEl;

        timeline.addEventListener('scroll', () => {
            wbs.scrollTop = timeline.scrollTop;
        });

        wbs.addEventListener('scroll', () => {
            timeline.scrollTop = wbs.scrollTop;
        });
    }

    private scrollToToday(): void {
        if (!this.timelineScrollEl) return;
        const todayLine = this.contentEl.querySelector('.timebox-gantt-today-line') as SVGLineElement;
        if (todayLine) {
            const x = parseFloat(todayLine.getAttribute('x1') || '0');
            const targetScroll = Math.max(0, x - this.timelineScrollEl.clientWidth / 2);
            this.timelineScrollEl.scrollTo({
                left: targetScroll,
                behavior: 'smooth'
            });
        }
    }

    private renderValidationBanner(container: HTMLElement, issues: ValidationIssue[]): void {
        const errors = issues.filter(i => i.severity === 'error');
        const warnings = issues.filter(i => i.severity === 'warning');

        const bannerEl = container.createDiv({
            cls: `timebox-validation-banner ${errors.length > 0 ? 'is-error' : 'is-warning'}`
        });

        const headerRow = bannerEl.createDiv({ cls: 'timebox-validation-header' });
        const iconSpan = headerRow.createSpan({ cls: 'timebox-validation-icon' });
        setIcon(iconSpan, errors.length > 0 ? 'alert-triangle' : 'alert-circle');

        const textSpan = headerRow.createSpan({ cls: 'timebox-validation-text' });
        const msg = errors.length > 0
            ? `Project Validation: ${errors.length} error${errors.length > 1 ? 's' : ''}${warnings.length > 0 ? `, ${warnings.length} warning${warnings.length > 1 ? 's' : ''}` : ''} detected.`
            : `Project Validation: ${warnings.length} warning${warnings.length > 1 ? 's' : ''} detected.`;
        textSpan.setText(msg);

        const toggleBtn = headerRow.createEl('button', {
            cls: 'timebox-validation-details-btn',
            text: 'View Details'
        });

        const detailsEl = bannerEl.createDiv({ cls: 'timebox-validation-details' });
        detailsEl.hide();

        toggleBtn.addEventListener('click', () => {
            if (detailsEl.isShown()) {
                detailsEl.hide();
                toggleBtn.setText('View Details');
            } else {
                detailsEl.show();
                toggleBtn.setText('Hide Details');
            }
        });

        const listEl = detailsEl.createEl('ul', { cls: 'timebox-validation-list' });
        for (const issue of issues) {
            const li = listEl.createEl('li', { cls: `timebox-validation-item is-${issue.severity}` });
            li.createSpan({ cls: `timebox-validation-badge is-${issue.severity}`, text: issue.severity.toUpperCase() });
            li.createSpan({ cls: 'timebox-validation-type', text: `[${issue.code}]` });
            li.createSpan({ cls: 'timebox-validation-message', text: ` ${issue.message}` });
        }
    }

    private renderTaskSheet(container: HTMLElement, projectData: ProjectData, rows: FlattenedGanttRow[]): void {
        const sheetEl = container.createDiv({ cls: 'timebox-task-sheet-pane' });

        // Action Toolbar
        const actionToolbar = sheetEl.createDiv({ cls: 'timebox-sheet-actions' });
        const addBtn = actionToolbar.createEl('button', {
            cls: 'timebox-gantt-action-btn',
            text: '+ Add Task'
        });
        addBtn.addEventListener('click', () => void this.createNewTask(projectData, false));

        const addSubBtn = actionToolbar.createEl('button', {
            cls: 'timebox-gantt-action-btn',
            text: '+ Add Subtask'
        });
        addSubBtn.addEventListener('click', () => void this.createNewTask(projectData, true));

        actionToolbar.createSpan({
            cls: 'timebox-sheet-info-text',
            text: `${rows.length} Tasks | ${projectData.completedCount} Completed | ${projectData.progressPercent}% Overall Progress`
        });

        // Table Wrapper
        const tableWrapper = sheetEl.createDiv({ cls: 'timebox-task-sheet-wrapper' });
        const table = tableWrapper.createEl('table', { cls: 'timebox-task-sheet-table' });

        const thead = table.createEl('thead');
        const headerRow = thead.createEl('tr');
        const headers = [
            { text: '#', width: '50px' },
            { text: 'Done', width: '45px' },
            { text: 'Task Name', width: '280px' },
            { text: 'Description', width: '180px' },
            { text: 'Start', width: '105px' },
            { text: 'Due', width: '105px' },
            { text: 'Dur', width: '60px' },
            { text: 'Work', width: '60px' },
            { text: 'Total Float', width: '80px' },
            { text: 'Free Float', width: '75px' },
            { text: 'Predecessors', width: '110px' },
            { text: 'Resource', width: '110px' },
            { text: '% Complete', width: '85px' },
            { text: 'Critical', width: '70px' },
            { text: '', width: '50px' }
        ];

        for (const h of headers) {
            const th = headerRow.createEl('th', { text: h.text });
            th.setCssStyles({ width: h.width });
        }

        const tbody = table.createEl('tbody');
        rows.forEach((row) => {
            const tr = tbody.createEl('tr', {
                cls: `timebox-task-sheet-row ${row.isParent ? 'is-parent-row' : ''} ${row.task.completed ? 'is-completed' : ''} ${row.isCritical ? 'is-critical-row' : ''}`
            });

            // Double click opens info modal
            tr.addEventListener('dblclick', () => {
                new TaskInformationModal(
                    this.app,
                    projectData.file,
                    row.task,
                    this.projectManager,
                    () => void this.render()
                ).open();
            });

            // 1. WBS
            tr.createEl('td', { cls: 'col-wbs', text: row.wbsCode });

            // 2. Checkbox
            const checkTd = tr.createEl('td', { cls: 'col-check' });
            const chk = checkTd.createEl('input', { type: 'checkbox' });
            chk.checked = row.task.completed;
            chk.disabled = row.isBlocked && !row.task.completed;
            if (row.isBlocked && !row.task.completed) {
                checkTd.title = 'Locked: predecessors incomplete';
            }
            chk.addEventListener('change', () => {
                void (async () => {
                    await this.projectManager.toggleProjectTaskCompletion(projectData.file, row.task.lineIndex, chk.checked);
                    void this.render();
                })();
            });

            // 3. Task Name
            const nameTd = tr.createEl('td', { cls: 'col-name' });
            const indentPx = row.isSubtask ? 20 : 0;
            nameTd.setCssStyles({ paddingLeft: `${10 + indentPx}px` });
            nameTd.createSpan({ cls: 'timebox-sheet-task-title', text: row.task.cleanTitle });
            if (row.isMilestone) {
                nameTd.createSpan({ cls: 'timebox-sheet-milestone-badge', text: '◆ Milestone' });
            }

            // 4. Description
            tr.createEl('td', { cls: 'col-desc', text: row.description || '-' });

            // 5. Start
            tr.createEl('td', { cls: 'col-start', text: row.startDate || '-' });

            // 6. Due
            tr.createEl('td', { cls: 'col-due', text: row.dueDate || '-' });

            // 7. Duration
            tr.createEl('td', { cls: 'col-dur', text: `${row.durationDays}d` });

            // 8. Work
            tr.createEl('td', { cls: 'col-work', text: `${row.workHours}h` });

            // 9. Total Float
            const tfTd = tr.createEl('td', { cls: 'col-float' });
            if (row.totalFloat === 0 && !row.task.completed) {
                tfTd.createSpan({ cls: 'timebox-float-badge is-zero', text: '0d' });
            } else {
                tfTd.setText(`${row.totalFloat}d`);
            }

            // 10. Free Float
            tr.createEl('td', { cls: 'col-free-float', text: `${row.freeFloat}d` });

            // 11. Predecessors
            tr.createEl('td', { cls: 'col-pred', text: row.predecessors.join(', ') || '-' });

            // 12. Resource
            const resTd = tr.createEl('td', { cls: 'col-res' });
            if (row.resource) {
                resTd.createSpan({ cls: 'timebox-sheet-resource-badge', text: `@${row.resource}` });
            } else {
                resTd.setText('-');
            }

            // 13. % Complete
            const compTd = tr.createEl('td', { cls: 'col-pct' });
            compTd.createSpan({ text: `${row.percentComplete}%` });

            // 14. Critical
            const critTd = tr.createEl('td', { cls: 'col-crit' });
            if (row.isCritical && !row.task.completed) {
                critTd.createSpan({ cls: 'timebox-critical-badge', text: '⚡ YES' });
            } else {
                critTd.setText('-');
            }

            // 15. Actions
            const actTd = tr.createEl('td', { cls: 'col-act' });
            const editBtn = actTd.createEl('button', { cls: 'timebox-task-icon-btn', title: 'Edit details' });
            setIcon(editBtn, 'sliders');
            editBtn.addEventListener('click', () => {
                new TaskInformationModal(
                    this.app,
                    projectData.file,
                    row.task,
                    this.projectManager,
                    () => void this.render()
                ).open();
            });
        });
    }

    private renderResourceSheet(container: HTMLElement, projectData: ProjectData, rows: FlattenedGanttRow[]): void {
        const sheetEl = container.createDiv({ cls: 'timebox-resource-sheet-pane' });

        if (!projectData.normalizedProject) {
            sheetEl.createDiv({ cls: 'timebox-empty-view', text: 'No normalized project data available.' });
            return;
        }

        const calDef = projectData.normalizedProject.calendars.find(c => c.id === projectData.normalizedProject!.activeCalendarId)
            || projectData.normalizedProject.calendars[0]
            || ProjectCalendar.createStandardCalendar().toDefinition();
        const calendar = ProjectCalendar.fromDefinition(calDef);
        const usageMap = ResourceEngine.analyze(projectData.normalizedProject, calendar);
        const overAllocations = ResourceEngine.detectOverAllocations(projectData.normalizedProject);

        // Header Summary Banner with Action Button
        const headerBanner = sheetEl.createDiv({ cls: 'timebox-resource-header-banner' });
        const titleArea = headerBanner.createDiv({ cls: 'timebox-resource-header-title' });
        titleArea.createEl('h4', { text: `Project Resources (${usageMap.size})` });
        titleArea.createSpan({ cls: 'timebox-resource-header-sub', text: 'Manage team members, types, capacities, rates, and task assignments.' });

        const addResBtn = headerBanner.createEl('button', { cls: 'mod-cta timebox-add-res-btn' });
        setIcon(addResBtn.createSpan(), 'plus');
        addResBtn.createSpan({ text: ' Add Resource' });
        addResBtn.addEventListener('click', () => {
            new ResourceModal(
                this.app,
                null,
                projectData.normalizedProject?.calendars || [],
                async (resDef) => {
                    await this.projectManager.saveResource(projectData.file, resDef);
                    new Notice(`Added resource: @${resDef.name}`);
                    void this.render();
                }
            ).open();
        });

        if (overAllocations.length > 0) {
            const alertBox = sheetEl.createDiv({ cls: 'timebox-resource-alert-box' });
            const iconSpan = alertBox.createSpan({ cls: 'timebox-alert-icon' });
            setIcon(iconSpan, 'alert-triangle');
            alertBox.createSpan({
                text: ` Resource Conflict: ${overAllocations.length} resource${overAllocations.length > 1 ? 's' : ''} over-allocated! Peak assignment exceeds capacity.`
            });
        }

        // Resources Table
        const tableWrapper = sheetEl.createDiv({ cls: 'timebox-task-sheet-wrapper' });
        const table = tableWrapper.createEl('table', { cls: 'timebox-task-sheet-table' });
        const thead = table.createEl('thead');
        const hRow = thead.createEl('tr');
        [
            'Resource Name',
            'Type',
            'Capacity',
            'Working Hours',
            'Rate / Cost',
            'Assigned Tasks',
            'Total Work',
            'Utilization',
            'Peak Units',
            'Status',
            'Actions'
        ].forEach(h => {
            hRow.createEl('th', { text: h });
        });

        const tbody = table.createEl('tbody');
        if (usageMap.size === 0) {
            const emptyRow = tbody.createEl('tr');
            emptyRow.createEl('td', {
                attr: { colspan: '11' },
                cls: 'timebox-table-empty',
                text: 'No resources defined in this project. Click "+ Add Resource" above or use @name in task titles to assign team members.'
            });
            return;
        }

        for (const summary of usageMap.values()) {
            const tr = tbody.createEl('tr', {
                cls: `timebox-resource-row ${summary.hasOverAllocation ? 'is-overallocated-row' : ''}`
            });

            // 1. Resource Name
            const nameTd = tr.createEl('td', { cls: 'col-res-name' });
            nameTd.createSpan({ cls: 'timebox-resource-pill', text: `@${summary.resource.name}` });

            // 2. Type
            tr.createEl('td', { text: summary.resource.type || 'Work' });

            // 3. Capacity / Max Units
            tr.createEl('td', { text: `${Math.round((summary.resource.maxUnits || 1.0) * 100)}%` });

            // 4. Working Hours / Day
            tr.createEl('td', { text: `${summary.resource.workingHoursPerDay || 8}h/d` });

            // 5. Rate / Cost
            const rateStr = summary.resource.ratePerHour
                ? `$${summary.resource.ratePerHour}/h`
                : (summary.resource.costPerUse ? `$${summary.resource.costPerUse}/use` : '—');
            tr.createEl('td', { text: rateStr });

            // 6. Assigned Tasks Count
            const taskTd = tr.createEl('td');
            const taskCount = summary.assignedTasks.length;
            const taskBadge = taskTd.createSpan({
                cls: 'timebox-assigned-tasks-badge',
                text: `${taskCount} task${taskCount === 1 ? '' : 's'}`
            });
            if (taskCount > 0) {
                taskBadge.title = summary.assignedTasks.map(t => `[WBS ${t.wbsCode}] ${t.title}`).join('\n');
            }

            // 7. Total Work
            tr.createEl('td', { text: `${summary.totalWorkHours}h` });

            // 8. Overall Utilization %
            const utilTd = tr.createEl('td');
            utilTd.setText(`${summary.overallUtilizationPercent}%`);
            if (summary.overallUtilizationPercent > 100) {
                utilTd.addClass('text-danger');
            }

            // 9. Peak Units
            const peakTd = tr.createEl('td');
            const peakPct = Math.round(summary.peakAllocationUnits * 100);
            peakTd.setText(`${peakPct}%`);
            if (summary.hasOverAllocation) {
                peakTd.addClass('text-danger');
            }

            // 10. Status
            const statusTd = tr.createEl('td');
            if (summary.hasOverAllocation) {
                statusTd.createSpan({ cls: 'timebox-status-badge is-danger', text: '⚠️ Over-allocated' });
            } else {
                statusTd.createSpan({ cls: 'timebox-status-badge is-success', text: '✓ Normal' });
            }

            // 11. Actions (Edit, Assign, Delete)
            const actionsTd = tr.createEl('td', { cls: 'timebox-resource-actions-cell' });

            // Edit button
            const editBtn = actionsTd.createEl('button', {
                cls: 'timebox-row-action-btn',
                title: `Edit ${summary.resource.name}`
            });
            setIcon(editBtn, 'sliders');
            editBtn.addEventListener('click', () => {
                new ResourceModal(
                    this.app,
                    summary.resource,
                    projectData.normalizedProject?.calendars || [],
                    async (resDef) => {
                        await this.projectManager.saveResource(projectData.file, resDef);
                        new Notice(`Updated resource: @${resDef.name}`);
                        void this.render();
                    }
                ).open();
            });

            // Assign to task button
            const assignBtn = actionsTd.createEl('button', {
                cls: 'timebox-row-action-btn',
                title: `Assign @${summary.resource.name} to a task`
            });
            setIcon(assignBtn, 'user-plus');
            assignBtn.addEventListener('click', () => {
                new AssignResourceModal(
                    this.app,
                    summary.resource,
                    rows,
                    async (targetRow, units) => {
                        await this.projectManager.assignResourceToTask(
                            projectData.file,
                            targetRow.task.lineIndex,
                            summary.resource.name,
                            units
                        );
                        new Notice(`Assigned @${summary.resource.name} to "${targetRow.task.cleanTitle}"`);
                        void this.render();
                    }
                ).open();
            });

            // Delete button
            const delBtn = actionsTd.createEl('button', {
                cls: 'timebox-row-action-btn is-delete',
                title: `Delete ${summary.resource.name}`
            });
            setIcon(delBtn, 'trash-2');
            delBtn.addEventListener('click', async () => {
                if (confirm(`Are you sure you want to delete resource "@${summary.resource.name}"?`)) {
                    await this.projectManager.deleteResource(projectData.file, summary.resource.id);
                    new Notice(`Deleted resource: @${summary.resource.name}`);
                    void this.render();
                }
            });
        }
    }

    private renderResourceUsage(container: HTMLElement, projectData: ProjectData, rows: FlattenedGanttRow[]): void {
        const usagePane = container.createDiv({ cls: 'timebox-resource-usage-pane' });

        if (!projectData.normalizedProject) {
            usagePane.createDiv({ cls: 'timebox-empty-view', text: 'No normalized project data available.' });
            return;
        }

        const calDef = projectData.normalizedProject.calendars.find(c => c.id === projectData.normalizedProject!.activeCalendarId)
            || projectData.normalizedProject.calendars[0]
            || ProjectCalendar.createStandardCalendar().toDefinition();
        const calendar = ProjectCalendar.fromDefinition(calDef);
        const usageMap = ResourceEngine.analyze(projectData.normalizedProject, calendar);

        // Timeline Window Calculation (14 Days = 2 Weeks)
        const projectStart = projectData.projectStartDate || new Date().toISOString().slice(0, 10);
        const windowMoment = getMoment(projectStart).add(this.resourceUsageStartOffset, 'days');
        const timelineDays: Array<{ dateStr: string; label: string; isWorkDay: boolean }> = [];

        for (let i = 0; i < 14; i++) {
            const curM = getMoment(windowMoment).add(i, 'days');
            const dStr = curM.format('YYYY-MM-DD');
            timelineDays.push({
                dateStr: dStr,
                label: curM.format('ddd DD'),
                isWorkDay: calendar.isWorkingDay(dStr)
            });
        }

        const startDateLabel = timelineDays[0].dateStr;
        const endDateLabel = timelineDays[timelineDays.length - 1].dateStr;

        // Navigation Toolbar
        const navBar = usagePane.createDiv({ cls: 'timebox-usage-nav-bar' });
        const leftControls = navBar.createDiv({ cls: 'timebox-usage-nav-controls' });

        const prevBtn = leftControls.createEl('button', { cls: 'timebox-nav-btn', text: '◀ Prev Week' });
        prevBtn.addEventListener('click', () => {
            this.resourceUsageStartOffset -= 7;
            void this.render();
        });

        const todayBtn = leftControls.createEl('button', { cls: 'timebox-nav-btn', text: 'Today' });
        todayBtn.addEventListener('click', () => {
            const todayStr = new Date().toISOString().slice(0, 10);
            const diffDays = Math.round((new Date(todayStr).getTime() - new Date(projectStart).getTime()) / (1000 * 60 * 60 * 24));
            this.resourceUsageStartOffset = diffDays;
            void this.render();
        });

        const nextBtn = leftControls.createEl('button', { cls: 'timebox-nav-btn', text: 'Next Week ▶' });
        nextBtn.addEventListener('click', () => {
            this.resourceUsageStartOffset += 7;
            void this.render();
        });

        leftControls.createSpan({
            cls: 'timebox-usage-range-label',
            text: `Timeline: ${startDateLabel} → ${endDateLabel}`
        });

        navBar.createSpan({
            cls: 'timebox-usage-legend',
            text: '■ Over-allocated | ■ Allocated | ▨ Non-working Day'
        });

        if (usageMap.size === 0) {
            usagePane.createDiv({
                cls: 'timebox-empty-view',
                text: 'No resources defined or assigned. Add resources in the Resource Sheet or assign @name to tasks.'
            });
            return;
        }

        // Time-Phased Workload Matrix Table
        const tableWrapper = usagePane.createDiv({ cls: 'timebox-usage-table-wrapper' });
        const table = tableWrapper.createEl('table', { cls: 'timebox-usage-table' });
        const thead = table.createEl('thead');
        const hRow = thead.createEl('tr');

        const nameTh = hRow.createEl('th', { cls: 'col-usage-name sticky-col', text: 'Resource / Assigned Task' });
        timelineDays.forEach(d => {
            const th = hRow.createEl('th', {
                cls: `timebox-usage-th ${!d.isWorkDay ? 'is-non-working-day' : ''}`,
                text: d.label
            });
            th.title = `${d.dateStr} (${d.isWorkDay ? 'Working Day' : 'Non-working / Weekend'})`;
        });

        const tbody = table.createEl('tbody');

        for (const [resKey, summary] of usageMap.entries()) {
            const isExpanded = this.expandedResources.has(resKey);

            // 1. Parent Resource Row
            const tr = tbody.createEl('tr', {
                cls: `timebox-usage-resource-row ${summary.hasOverAllocation ? 'has-conflict-row' : ''}`
            });

            const nameTd = tr.createEl('td', { cls: 'col-usage-name sticky-col' });
            const toggleIcon = nameTd.createSpan({ cls: 'timebox-usage-row-chevron' });
            setIcon(toggleIcon, isExpanded ? 'chevron-down' : 'chevron-right');

            const pill = nameTd.createSpan({ cls: 'timebox-resource-pill', text: `@${summary.resource.name}` });
            const metaSpan = nameTd.createSpan({
                cls: 'timebox-usage-row-meta',
                text: ` (${Math.round((summary.resource.maxUnits || 1) * 100)}%, ${summary.resource.workingHoursPerDay || 8}h/d)`
            });

            nameTd.addEventListener('click', () => {
                if (this.expandedResources.has(resKey)) {
                    this.expandedResources.delete(resKey);
                } else {
                    this.expandedResources.add(resKey);
                }
                void this.render();
            });

            // Day Columns for Resource
            timelineDays.forEach(d => {
                const td = tr.createEl('td', { cls: 'timebox-usage-cell' });
                const daily = summary.dailyAllocations.get(d.dateStr);

                if (daily && daily.allocatedHours > 0) {
                    const hours = Math.round(daily.allocatedHours * 10) / 10;
                    if (daily.isOverAllocated) {
                        td.addClass('is-overallocated-cell');
                        td.createDiv({ cls: 'timebox-usage-hours', text: `${hours}h` });
                        td.createSpan({
                            cls: 'timebox-overalloc-badge',
                            text: `${Math.round(daily.allocatedUnits * 100)}%`
                        });
                        td.title = `${summary.resource.name} on ${d.dateStr}: ${hours}h allocated vs ${daily.capacityHours}h capacity! Conflicting tasks: ${daily.taskIds.join(', ')}`;
                    } else {
                        td.addClass('is-allocated-cell');
                        td.createDiv({ cls: 'timebox-usage-hours', text: `${hours}h` });
                        td.title = `${summary.resource.name} on ${d.dateStr}: ${hours}h (${Math.round(daily.allocatedUnits * 100)}%)`;
                    }
                } else {
                    if (!d.isWorkDay) {
                        td.addClass('is-non-working-cell');
                        td.setText('—');
                    } else {
                        td.setText('—');
                    }
                }
            });

            // 2. Child Task Sub-Rows (if expanded)
            if (isExpanded) {
                for (const task of summary.assignedTasks) {
                    const taskTr = tbody.createEl('tr', { cls: 'timebox-usage-task-subrow' });
                    const taskNameTd = taskTr.createEl('td', { cls: 'col-usage-name sticky-col task-subrow-title' });
                    taskNameTd.createSpan({ cls: 'timebox-task-wbs-code', text: `[WBS ${task.wbsCode}] ` });
                    taskNameTd.createSpan({ text: (task as any).cleanTitle || task.title });

                    timelineDays.forEach(d => {
                        const taskTd = taskTr.createEl('td', { cls: 'timebox-usage-cell task-subrow-cell' });
                        const daily = summary.dailyAllocations.get(d.dateStr);
                        const tw = daily?.taskWork.find(w => w.taskId === task.id);

                        if (tw && tw.hours > 0) {
                            taskTd.addClass('is-task-work-cell');
                            taskTd.setText(`${tw.hours}h`);
                            taskTd.title = `Task [WBS ${task.wbsCode}]: ${tw.hours}h on ${d.dateStr}`;
                        } else {
                            if (!d.isWorkDay) {
                                taskTd.addClass('is-non-working-cell');
                            }
                            taskTd.setText('—');
                        }
                    });
                }
            }
        }
    }

    private renderProjectSummary(container: HTMLElement, projectData: ProjectData, rows: FlattenedGanttRow[]): void {
        const summaryPane = container.createDiv({ cls: 'timebox-project-summary-pane' });

        // Header Title
        const header = summaryPane.createDiv({ cls: 'timebox-summary-header' });
        header.createEl('h2', { text: `Project Overview: ${projectData.name}` });
        header.createEl('p', { cls: 'timebox-summary-sub', text: `File: ${projectData.file.path}` });

        // Overall Progress Bar
        const progressContainer = summaryPane.createDiv({ cls: 'timebox-summary-progress-section' });
        const progressHeader = progressContainer.createDiv({ cls: 'timebox-progress-header' });
        progressHeader.createSpan({ text: 'Overall Project Completion' });
        progressHeader.createSpan({ cls: 'timebox-progress-pct-label', text: `${projectData.progressPercent}%` });

        const progressBarOuter = progressContainer.createDiv({ cls: 'timebox-progress-bar-outer' });
        const progressBarInner = progressBarOuter.createDiv({ cls: 'timebox-progress-bar-inner' });
        progressBarInner.setCssStyles({ width: `${Math.min(100, Math.max(0, projectData.progressPercent))}%` });

        // Dynamic Calculations
        const totalTasks = rows.length;
        const completedTasks = projectData.completedCount;
        const remainingTasks = Math.max(0, totalTasks - completedTasks);
        const totalWork = projectData.normalizedProject?.totalWorkHours || rows.reduce((sum, r) => sum + r.workHours, 0);
        const totalCost = projectData.normalizedProject?.totalCost || rows.reduce((sum, r) => sum + ((r.task as any).cost || 0), 0);

        const startDate = projectData.projectStartDate || '—';
        const dueDate = projectData.projectDueDate || '—';
        const totalDurationDays = (startDate !== '—' && dueDate !== '—')
            ? WorkingCalendar.calculateWorkingDays(startDate, dueDate)
            : (rows.length > 0 ? rows.reduce((max, r) => Math.max(max, r.durationDays), 0) : 0);

        const criticalRows = rows.filter(r => r.isCritical && !r.task.completed);
        const criticalPathDuration = criticalRows.reduce((sum, r) => sum + r.durationDays, 0);

        const milestones = rows.filter(r => r.isMilestone);
        const completedMilestones = milestones.filter(m => m.task.completed).length;

        const hasBaseline = !!(projectData.normalizedProject?.baselines && Object.keys(projectData.normalizedProject.baselines).length > 0);

        // 4 Dynamic Primary KPI Cards
        const kpiGrid = summaryPane.createDiv({ cls: 'timebox-summary-kpi-grid' });

        // Card 1: Schedule Timeline (Click -> Gantt)
        const card1 = kpiGrid.createDiv({ cls: 'timebox-kpi-card is-clickable' });
        card1.title = 'Click to switch to Gantt Timeline';
        const icon1 = card1.createSpan({ cls: 'timebox-kpi-icon' });
        setIcon(icon1, 'calendar');
        card1.createEl('div', { cls: 'timebox-kpi-title', text: 'Schedule Timeline' });
        card1.createEl('div', { cls: 'timebox-kpi-value', text: `${startDate} → ${dueDate}` });
        card1.createEl('div', {
            cls: 'timebox-kpi-sub',
            text: `${totalDurationDays} working days • ${remainingTasks} tasks remaining`
        });
        card1.addEventListener('click', () => {
            this.activeView = 'gantt';
            void this.render();
        });

        // Card 2: Tasks & Work (Click -> Task Sheet)
        const card2 = kpiGrid.createDiv({ cls: 'timebox-kpi-card is-clickable' });
        card2.title = 'Click to switch to Task Sheet';
        const icon2 = card2.createSpan({ cls: 'timebox-kpi-icon' });
        setIcon(icon2, 'check-square');
        card2.createEl('div', { cls: 'timebox-kpi-title', text: 'Tasks & Work' });
        card2.createEl('div', { cls: 'timebox-kpi-value', text: `${completedTasks} / ${totalTasks} Tasks` });
        card2.createEl('div', {
            cls: 'timebox-kpi-sub',
            text: `Total Work: ${totalWork}h • ${completedMilestones}/${milestones.length} Milestones`
        });
        card2.addEventListener('click', () => {
            this.activeView = 'task-sheet';
            void this.render();
        });

        // Card 3: Critical Path (Click -> Critical Path Gantt)
        const card3 = kpiGrid.createDiv({ cls: 'timebox-kpi-card is-clickable' });
        card3.title = 'Click to highlight Critical Path on Gantt';
        const icon3 = card3.createSpan({ cls: 'timebox-kpi-icon' });
        setIcon(icon3, 'zap');
        card3.createEl('div', { cls: 'timebox-kpi-title', text: 'Critical Path' });
        card3.createEl('div', { cls: 'timebox-kpi-value', text: `${criticalRows.length} Critical Tasks` });
        card3.createEl('div', {
            cls: 'timebox-kpi-sub',
            text: criticalRows.length > 0 ? `${criticalPathDuration}d critical span • zero float tasks determine finish` : 'All tasks currently flexible'
        });
        card3.addEventListener('click', () => {
            this.activeView = 'gantt';
            this.showCriticalPath = true;
            void this.render();
        });

        // Card 4: Cost & Baselines (Click -> Toggle Baselines)
        const card4 = kpiGrid.createDiv({ cls: 'timebox-kpi-card is-clickable' });
        card4.title = 'Click to toggle baseline comparison in Gantt';
        const icon4 = card4.createSpan({ cls: 'timebox-kpi-icon' });
        setIcon(icon4, 'bar-chart-2');
        card4.createEl('div', { cls: 'timebox-kpi-title', text: 'Cost & Baseline Tracking' });
        card4.createEl('div', { cls: 'timebox-kpi-value', text: `$${totalCost.toLocaleString()}` });
        card4.createEl('div', {
            cls: 'timebox-kpi-sub',
            text: hasBaseline ? 'Baseline 0 Active (Click to overlay plan)' : 'Snapshot plan to track schedule variance'
        });
        card4.addEventListener('click', () => {
            this.activeView = 'gantt';
            this.showBaselines = true;
            void this.render();
        });

        // Critical Path Task Sequence List
        if (criticalRows.length > 0) {
            const critSection = summaryPane.createDiv({ cls: 'timebox-summary-section' });
            critSection.createEl('h3', { text: '⚡ Critical Path Sequence' });
            const critList = critSection.createDiv({ cls: 'timebox-summary-critical-list' });

            criticalRows.forEach((r, idx) => {
                const item = critList.createDiv({ cls: 'timebox-critical-item is-clickable' });
                item.title = 'Click to view task in Gantt';
                item.createSpan({ cls: 'timebox-critical-step', text: `#${idx + 1}` });
                item.createSpan({ cls: 'timebox-critical-wbs', text: `[WBS ${r.wbsCode}]` });
                item.createSpan({ cls: 'timebox-critical-name', text: r.task.cleanTitle });
                item.createSpan({ cls: 'timebox-critical-dates', text: `${r.startDate || '?'} → ${r.dueDate || '?'} (${r.durationDays}d)` });
                item.addEventListener('click', () => {
                    this.activeView = 'gantt';
                    this.selectedTaskLine = r.task.lineIndex;
                    void this.render();
                });
            });
        }

        // Milestones Section
        if (milestones.length > 0) {
            const msSection = summaryPane.createDiv({ cls: 'timebox-summary-section' });
            msSection.createEl('h3', { text: `◆ Project Milestones (${completedMilestones}/${milestones.length})` });
            const msList = msSection.createDiv({ cls: 'timebox-summary-milestone-list' });

            milestones.forEach((m) => {
                const item = msList.createDiv({
                    cls: `timebox-milestone-item is-clickable ${m.task.completed ? 'is-completed' : ''}`
                });
                item.title = 'Click to jump to milestone in Task Sheet';
                item.createSpan({ cls: 'timebox-milestone-icon', text: m.task.completed ? '✅' : '◆' });
                item.createSpan({ cls: 'timebox-milestone-name', text: m.task.cleanTitle });
                item.createSpan({ cls: 'timebox-milestone-date', text: m.dueDate || m.startDate || 'No date' });
                item.addEventListener('click', () => {
                    this.activeView = 'task-sheet';
                    this.selectedTaskLine = m.task.lineIndex;
                    void this.render();
                });
            });
        }
    }

    private createSvgElement<K extends keyof SVGElementTagNameMap>(
        tag: K,
        attrs: Record<string, string>
    ): SVGElementTagNameMap[K] {
        const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
        for (const [key, val] of Object.entries(attrs)) {
            el.setAttribute(key, val);
        }
        return el;
    }
}
