import { App, Modal, TFile, Notice } from 'obsidian';
import { ProjectManager } from './projectManager';

export class StatusDateModal extends Modal {
    private projectFile: TFile;
    private currentStatusDate?: string;
    private projectManager: ProjectManager;
    private onSaveCallback: () => void;

    private dateInput!: HTMLInputElement;

    constructor(
        app: App,
        projectFile: TFile,
        currentStatusDate: string | undefined,
        projectManager: ProjectManager,
        onSaveCallback: () => void
    ) {
        super(app);
        this.projectFile = projectFile;
        this.currentStatusDate = currentStatusDate;
        this.projectManager = projectManager;
        this.onSaveCallback = onSaveCallback;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('timebox-settings-modal');

        const header = contentEl.createDiv({ cls: 'timebox-modal-header' });
        header.createEl('h3', { text: 'Project Status Date' });

        const form = contentEl.createDiv({ cls: 'timebox-task-info-form' });

        const descRow = form.createDiv({ cls: 'timebox-form-row full-width' });
        descRow.createEl('p', {
            text: 'The Status Date establishes the execution tracking boundary. Completed and in-progress actuals are tracked up to this date, and remaining uncompleted work forecasts forward from here without altering your original planned schedule.',
            cls: 'timebox-modal-description'
        });

        // Date input
        const dateRow = form.createDiv({ cls: 'timebox-form-row full-width' });
        dateRow.createEl('label', { text: 'Status Date (YYYY-MM-DD):' });
        this.dateInput = dateRow.createEl('input', {
            type: 'date',
            value: this.currentStatusDate || ''
        });

        // Quick presets
        const presetsRow = form.createDiv({ cls: 'timebox-form-row full-width timebox-status-presets' });
        const todayBtn = presetsRow.createEl('button', {
            cls: 'timebox-btn-secondary',
            text: 'Set to Today'
        });
        todayBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.dateInput.value = new Date().toISOString().slice(0, 10);
        });

        const clearBtn = presetsRow.createEl('button', {
            cls: 'timebox-btn-secondary mod-warning',
            text: 'Clear Status Date'
        });
        clearBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.dateInput.value = '';
        });

        // Footer Actions
        const footer = contentEl.createDiv({ cls: 'timebox-modal-footer-split' });
        const cancelBtn = footer.createEl('button', { cls: 'timebox-btn-secondary', text: 'Cancel' });
        cancelBtn.addEventListener('click', () => this.close());

        const saveBtn = footer.createEl('button', { cls: 'timebox-btn-primary', text: 'Apply Status Date' });
        saveBtn.addEventListener('click', async () => {
            await this.handleSave();
        });
    }

    private async handleSave(): Promise<void> {
        const val = this.dateInput.value.trim() || undefined;
        await this.projectManager.setStatusDate(this.projectFile, val);
        if (val) {
            new Notice(`Project status date set to ${val}`);
        } else {
            new Notice(`Cleared project status date`);
        }
        this.close();
        this.onSaveCallback();
    }
}
