import { App, Modal, TFile, Notice } from 'obsidian';
import { ProjectData, ProjectManager } from './projectManager';
import { CalendarDefinition } from './projectModel';
import { CalendarConfigModal } from './calendarConfigModal';

export class ProjectSettingsModal extends Modal {
    private projectFile: TFile;
    private projectData: ProjectData;
    private projectManager: ProjectManager;
    private onSaveCallback: () => void;

    private titleInput!: HTMLInputElement;
    private startDateInput!: HTMLInputElement;
    private deadlineInput!: HTMLInputElement;
    private scheduleModeSelect!: HTMLSelectElement;
    private startTaskSelect!: HTMLSelectElement;
    private activeCalendarSelect!: HTMLSelectElement;

    constructor(
        app: App,
        projectFile: TFile,
        projectData: ProjectData,
        projectManager: ProjectManager,
        onSaveCallback: () => void
    ) {
        super(app);
        this.projectFile = projectFile;
        this.projectData = projectData;
        this.projectManager = projectManager;
        this.onSaveCallback = onSaveCallback;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('timebox-settings-modal');

        const header = contentEl.createDiv({ cls: 'timebox-modal-header' });
        header.createEl('h3', { text: `Project Settings: ${this.projectData.name}` });

        const form = contentEl.createDiv({ cls: 'timebox-task-info-form' });

        // Title
        const titleRow = form.createDiv({ cls: 'timebox-form-row full-width' });
        titleRow.createEl('label', { text: 'Project Title / Name:' });
        this.titleInput = titleRow.createEl('input', {
            type: 'text',
            value: this.projectData.normalizedProject?.name || this.projectData.name
        });

        // Start Date
        const startRow = form.createDiv({ cls: 'timebox-form-row' });
        startRow.createEl('label', { text: 'Project Start Date:' });
        this.startDateInput = startRow.createEl('input', {
            type: 'date',
            value: this.projectData.normalizedProject?.projectStartDate || this.projectData.projectStartDate || ''
        });

        // Deadline
        const deadlineRow = form.createDiv({ cls: 'timebox-form-row' });
        deadlineRow.createEl('label', { text: 'Target Project Deadline:' });
        this.deadlineInput = deadlineRow.createEl('input', {
            type: 'date',
            value: this.projectData.normalizedProject?.projectDeadline || ''
        });

        // Scheduling Direction
        const modeRow = form.createDiv({ cls: 'timebox-form-row' });
        modeRow.createEl('label', { text: 'Scheduling Direction:' });
        this.scheduleModeSelect = modeRow.createEl('select');
        const fwdOpt = this.scheduleModeSelect.createEl('option', { value: 'forward', text: 'Forward (From Start Date)' });
        const bwdOpt = this.scheduleModeSelect.createEl('option', { value: 'backward', text: 'Backward (From Deadline)' });
        if (this.projectData.normalizedProject?.schedulingDirection === 'backward') {
            bwdOpt.selected = true;
        } else {
            fwdOpt.selected = true;
        }

        // Start Task Number
        const startTaskRow = form.createDiv({ cls: 'timebox-form-row' });
        startTaskRow.createEl('label', { text: 'Starting Task Designation:' });
        this.startTaskSelect = startTaskRow.createEl('select');
        const st1 = this.startTaskSelect.createEl('option', { value: '1', text: 'Task #1 is First Task' });
        const st2 = this.startTaskSelect.createEl('option', { value: '2', text: 'Task #2 (Task #1 is Project Title)' });
        if ((this.projectData.startTaskNumber || 1) === 2) {
            st2.selected = true;
        } else {
            st1.selected = true;
        }

        // Active Calendar
        const calRow = form.createDiv({ cls: 'timebox-form-row full-width' });
        calRow.createEl('label', { text: 'Active Project Calendar:' });
        const calSelectWrapper = calRow.createDiv({ cls: 'timebox-calendar-select-wrapper' });
        this.activeCalendarSelect = calSelectWrapper.createEl('select');

        const calendars: CalendarDefinition[] = this.projectData.normalizedProject?.calendars || [];
        const activeCalId = this.projectData.normalizedProject?.activeCalendarId || 'standard';

        for (const cal of calendars) {
            const opt = this.activeCalendarSelect.createEl('option', {
                value: cal.id,
                text: `${cal.name} (${cal.hoursPerDay}h/day, ${cal.workingDays.length} days/wk)`
            });
            if (cal.id === activeCalId) opt.selected = true;
        }

        const configCalBtn = calSelectWrapper.createEl('button', {
            cls: 'timebox-btn-secondary',
            text: '📅 Configure Calendars...'
        });
        configCalBtn.addEventListener('click', (e) => {
            e.preventDefault();
            new CalendarConfigModal(
                this.app,
                this.projectFile,
                calendars,
                activeCalId,
                this.projectManager,
                async () => {
                    this.close();
                    this.onSaveCallback();
                }
            ).open();
        });

        // Footer Actions
        const footer = contentEl.createDiv({ cls: 'timebox-modal-footer-split' });
        const cancelBtn = footer.createEl('button', { cls: 'timebox-btn-secondary', text: 'Cancel' });
        cancelBtn.addEventListener('click', () => this.close());

        const saveBtn = footer.createEl('button', { cls: 'timebox-btn-primary', text: 'Save Project Settings' });
        saveBtn.addEventListener('click', async () => {
            await this.handleSave();
        });
    }

    private async handleSave(): Promise<void> {
        const title = this.titleInput.value.trim();
        const projectStartDate = this.startDateInput.value.trim() || undefined;
        const deadline = this.deadlineInput.value.trim() || undefined;
        const scheduleMode = this.scheduleModeSelect.value as 'forward' | 'backward';
        const startTaskNumber = parseInt(this.startTaskSelect.value, 10) || 1;
        const activeCalendarId = this.activeCalendarSelect.value;

        await this.projectManager.saveProjectSettings(this.projectFile, {
            title,
            projectStartDate,
            deadline,
            scheduleMode,
            startTaskNumber,
            activeCalendarId
        });

        new Notice(`Saved project settings for "${title || this.projectData.name}"`);
        this.close();
        this.onSaveCallback();
    }
}
