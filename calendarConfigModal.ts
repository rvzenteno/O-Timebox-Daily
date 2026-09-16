import { App, Modal, TFile, Notice, setIcon } from 'obsidian';
import { CalendarDefinition, CalendarException } from './projectModel';
import { ProjectManager } from './projectManager';
import { ProjectCalendar } from './projectCalendar';

export class CalendarConfigModal extends Modal {
    private projectFile: TFile;
    private calendars: CalendarDefinition[];
    private activeCalendarId: string;
    private projectManager: ProjectManager;
    private onSaveCallback: () => void;

    private selectedCalendarId: string;
    private workingDaysSet: Set<number>;
    private holidaysList: string[];
    private exceptionsList: CalendarException[];

    constructor(
        app: App,
        projectFile: TFile,
        calendars: CalendarDefinition[],
        activeCalendarId: string,
        projectManager: ProjectManager,
        onSaveCallback: () => void
    ) {
        super(app);
        this.projectFile = projectFile;
        // Deep clone calendars so edits are isolated until saved
        this.calendars = JSON.parse(JSON.stringify(calendars));
        if (this.calendars.length === 0) {
            this.calendars.push(ProjectCalendar.createStandardCalendar().toDefinition());
        }
        this.activeCalendarId = activeCalendarId || this.calendars[0].id;
        this.projectManager = projectManager;
        this.onSaveCallback = onSaveCallback;

        this.selectedCalendarId = this.activeCalendarId;
        const current = this.getCurrentCalendar();
        this.workingDaysSet = new Set(current.workingDays || [1, 2, 3, 4, 5]);
        this.holidaysList = [...(current.holidays || [])];
        this.exceptionsList = JSON.parse(JSON.stringify(current.exceptions || []));
    }

    private getCurrentCalendar(): CalendarDefinition {
        return this.calendars.find(c => c.id === this.selectedCalendarId) || this.calendars[0];
    }

    private syncCurrentToState(): void {
        const cal = this.getCurrentCalendar();
        cal.workingDays = Array.from(this.workingDaysSet).sort();
        cal.holidays = [...this.holidaysList].sort();
        cal.exceptions = JSON.parse(JSON.stringify(this.exceptionsList));
    }

    private switchCalendar(newId: string): void {
        this.syncCurrentToState();
        this.selectedCalendarId = newId;
        const next = this.getCurrentCalendar();
        this.workingDaysSet = new Set(next.workingDays || [1, 2, 3, 4, 5]);
        this.holidaysList = [...(next.holidays || [])];
        this.exceptionsList = JSON.parse(JSON.stringify(next.exceptions || []));
        this.renderContent();
    }

    onOpen(): void {
        this.renderContent();
    }

    private renderContent(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('timebox-calendar-modal');

        const currentCal = this.getCurrentCalendar();

        // Header
        const header = contentEl.createDiv({ cls: 'timebox-modal-header' });
        header.createEl('h3', { text: 'Calendar & Working Time Configuration' });

        // Calendar Selector bar
        const topBar = contentEl.createDiv({ cls: 'timebox-calendar-top-bar' });
        
        const selectGroup = topBar.createDiv({ cls: 'timebox-cal-select-group' });
        selectGroup.createEl('label', { text: 'Select Calendar:' });
        const calSelect = selectGroup.createEl('select');
        for (const cal of this.calendars) {
            const opt = calSelect.createEl('option', {
                value: cal.id,
                text: `${cal.name}${cal.id === this.activeCalendarId ? ' ★ (Active)' : ''}`
            });
            if (cal.id === this.selectedCalendarId) opt.selected = true;
        }
        calSelect.addEventListener('change', () => {
            this.switchCalendar(calSelect.value);
        });

        // Add New Calendar Button
        const addCalBtn = topBar.createEl('button', {
            cls: 'timebox-btn-secondary',
            text: '+ New Calendar'
        });
        addCalBtn.addEventListener('click', () => {
            const newId = `calendar-${Date.now()}`;
            const newCal: CalendarDefinition = {
                id: newId,
                name: `Custom Calendar ${this.calendars.length + 1}`,
                workingDays: [1, 2, 3, 4, 5],
                hoursPerDay: 8,
                holidays: [],
                exceptions: []
            };
            this.syncCurrentToState();
            this.calendars.push(newCal);
            this.switchCalendar(newId);
        });

        // Delete Calendar Button
        const deleteCalBtn = topBar.createEl('button', {
            cls: `timebox-btn-danger ${this.calendars.length <= 1 ? 'is-disabled' : ''}`,
            text: 'Delete Calendar'
        });
        if (this.calendars.length > 1) {
            deleteCalBtn.addEventListener('click', () => {
                if (confirm(`Delete calendar "${currentCal.name}"?`)) {
                    this.calendars = this.calendars.filter(c => c.id !== currentCal.id);
                    if (this.activeCalendarId === currentCal.id) {
                        this.activeCalendarId = this.calendars[0].id;
                    }
                    this.switchCalendar(this.calendars[0].id);
                }
            });
        }

        // Form Section
        const form = contentEl.createDiv({ cls: 'timebox-task-info-form' });

        // Calendar Name
        const nameRow = form.createDiv({ cls: 'timebox-form-row' });
        nameRow.createEl('label', { text: 'Calendar Name:' });
        const nameInput = nameRow.createEl('input', { type: 'text', value: currentCal.name });
        nameInput.addEventListener('input', () => {
            currentCal.name = nameInput.value;
        });

        // Hours per Day
        const hoursRow = form.createDiv({ cls: 'timebox-form-row' });
        hoursRow.createEl('label', { text: 'Working Hours / Day:' });
        const hoursInput = hoursRow.createEl('input', {
            type: 'number',
            value: String(currentCal.hoursPerDay || 8)
        });
        hoursInput.min = '1';
        hoursInput.max = '24';
        hoursInput.step = '0.5';
        hoursInput.addEventListener('input', () => {
            const val = parseFloat(hoursInput.value);
            if (!isNaN(val) && val > 0) {
                currentCal.hoursPerDay = val;
            }
        });

        // Active checkbox
        const activeRow = form.createDiv({ cls: 'timebox-form-row flags-row full-width' });
        const activeLabel = activeRow.createEl('label', { cls: 'timebox-checkbox-label' });
        const activeCheck = activeLabel.createEl('input', { type: 'checkbox' });
        activeCheck.checked = this.activeCalendarId === currentCal.id;
        activeLabel.createSpan({ text: ' Set as active project calendar' });
        activeCheck.addEventListener('change', () => {
            if (activeCheck.checked) {
                this.activeCalendarId = currentCal.id;
            }
        });

        // Weekly Working Days Section
        const daysSection = contentEl.createDiv({ cls: 'timebox-cal-section' });
        daysSection.createEl('h4', { text: 'Standard Working Days' });
        const daysContainer = daysSection.createDiv({ cls: 'timebox-day-pills-container' });

        const daysOfWeek = [
            { id: 0, label: 'Sun', name: 'Sunday' },
            { id: 1, label: 'Mon', name: 'Monday' },
            { id: 2, label: 'Tue', name: 'Tuesday' },
            { id: 3, label: 'Wed', name: 'Wednesday' },
            { id: 4, label: 'Thu', name: 'Thursday' },
            { id: 5, label: 'Fri', name: 'Friday' },
            { id: 6, label: 'Sat', name: 'Saturday' }
        ];

        for (const day of daysOfWeek) {
            const isWorking = this.workingDaysSet.has(day.id);
            const pill = daysContainer.createEl('button', {
                cls: `timebox-day-pill ${isWorking ? 'is-active' : ''}`,
                text: day.label,
                title: `${day.name}: ${isWorking ? 'Working Day' : 'Non-Working'}`
            });
            pill.addEventListener('click', () => {
                if (this.workingDaysSet.has(day.id)) {
                    if (this.workingDaysSet.size > 1) {
                        this.workingDaysSet.delete(day.id);
                        pill.removeClass('is-active');
                    } else {
                        new Notice('A calendar must have at least one working day');
                    }
                } else {
                    this.workingDaysSet.add(day.id);
                    pill.addClass('is-active');
                }
            });
        }

        // Holidays Section
        const holidaysSection = contentEl.createDiv({ cls: 'timebox-cal-section' });
        holidaysSection.createEl('h4', { text: `Holidays & Non-Working Days (${this.holidaysList.length})` });

        // Add Holiday Bar
        const addHoliBar = holidaysSection.createDiv({ cls: 'timebox-cal-inline-add' });
        const holiDateInput = addHoliBar.createEl('input', { type: 'date' });
        const addHoliBtn = addHoliBar.createEl('button', {
            cls: 'timebox-btn-secondary',
            text: '+ Add Holiday'
        });
        addHoliBtn.addEventListener('click', () => {
            const val = holiDateInput.value;
            if (!val) {
                new Notice('Please select a date for the holiday');
                return;
            }
            if (this.holidaysList.includes(val)) {
                new Notice('Holiday already exists on this date');
                return;
            }
            this.holidaysList.push(val);
            this.holidaysList.sort();
            this.renderContent();
        });

        // Holidays List
        if (this.holidaysList.length > 0) {
            const holiListEl = holidaysSection.createDiv({ cls: 'timebox-cal-tag-list' });
            for (const hDate of this.holidaysList) {
                const tag = holiListEl.createSpan({ cls: 'timebox-cal-date-tag' });
                tag.createSpan({ text: hDate });
                const delBtn = tag.createSpan({ cls: 'timebox-tag-delete', text: '✕' });
                delBtn.addEventListener('click', () => {
                    this.holidaysList = this.holidaysList.filter(d => d !== hDate);
                    this.renderContent();
                });
            }
        } else {
            holidaysSection.createDiv({ cls: 'timebox-cal-empty', text: 'No holidays defined for this calendar.' });
        }

        // Exceptions Section
        const exSection = contentEl.createDiv({ cls: 'timebox-cal-section' });
        exSection.createEl('h4', { text: `Calendar Exceptions (${this.exceptionsList.length})` });

        // Add Exception Bar
        const addExBar = exSection.createDiv({ cls: 'timebox-cal-inline-add-ex' });
        const exDateInput = addExBar.createEl('input', { type: 'date' });
        const exTypeSelect = addExBar.createEl('select');
        exTypeSelect.createEl('option', { value: 'false', text: 'Non-Working' });
        exTypeSelect.createEl('option', { value: 'true', text: 'Working (Overtime)' });
        const exNameInput = addExBar.createEl('input', {
            type: 'text',
            placeholder: 'Reason / Exception name (optional)'
        });
        const addExBtn = addExBar.createEl('button', {
            cls: 'timebox-btn-secondary',
            text: '+ Add Exception'
        });
        addExBtn.addEventListener('click', () => {
            const dateVal = exDateInput.value;
            if (!dateVal) {
                new Notice('Please select a date for the exception');
                return;
            }
            const isWorking = exTypeSelect.value === 'true';
            const name = exNameInput.value.trim() || undefined;

            this.exceptionsList = this.exceptionsList.filter(e => e.date !== dateVal);
            this.exceptionsList.push({ date: dateVal, isWorking, name });
            this.exceptionsList.sort((a, b) => a.date.localeCompare(b.date));
            this.renderContent();
        });

        // Exceptions Table / List
        if (this.exceptionsList.length > 0) {
            const exTable = exSection.createEl('table', { cls: 'timebox-cal-exceptions-table' });
            const thead = exTable.createEl('thead');
            const headRow = thead.createEl('tr');
            headRow.createEl('th', { text: 'Date' });
            headRow.createEl('th', { text: 'Type' });
            headRow.createEl('th', { text: 'Description' });
            headRow.createEl('th', { text: 'Action' });

            const tbody = exTable.createEl('tbody');
            for (const ex of this.exceptionsList) {
                const tr = tbody.createEl('tr');
                tr.createEl('td', { text: ex.date });
                const typeTd = tr.createEl('td');
                typeTd.createSpan({
                    cls: `timebox-status-badge ${ex.isWorking ? 'is-working' : 'is-non-working'}`,
                    text: ex.isWorking ? 'Working' : 'Non-Working'
                });
                tr.createEl('td', { text: ex.name || '—' });
                const actTd = tr.createEl('td');
                const delBtn = actTd.createEl('button', { cls: 'timebox-icon-btn-sm', text: '✕' });
                delBtn.addEventListener('click', () => {
                    this.exceptionsList = this.exceptionsList.filter(e => e.date !== ex.date);
                    this.renderContent();
                });
            }
        } else {
            exSection.createDiv({ cls: 'timebox-cal-empty', text: 'No exceptions defined.' });
        }

        // Footer Actions
        const footer = contentEl.createDiv({ cls: 'timebox-modal-footer-split' });
        const cancelBtn = footer.createEl('button', { cls: 'timebox-btn-secondary', text: 'Cancel' });
        cancelBtn.addEventListener('click', () => this.close());

        const saveBtn = footer.createEl('button', { cls: 'timebox-btn-primary', text: 'Save Calendar Settings' });
        saveBtn.addEventListener('click', async () => {
            this.syncCurrentToState();
            await this.projectManager.saveCalendars(this.projectFile, this.calendars, this.activeCalendarId);
            new Notice(`Saved ${this.calendars.length} calendar(s) to project`);
            this.close();
            this.onSaveCallback();
        });
    }
}
