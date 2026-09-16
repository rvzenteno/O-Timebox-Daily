import { App, Modal, TFile, Notice } from 'obsidian';
import { ProjectData, ProjectManager } from './projectManager';
import { ProjectBaseline } from './projectModel';

export class BaselineModal extends Modal {
    private projectFile: TFile;
    private projectData: ProjectData;
    private projectManager: ProjectManager;
    private onSaveCallback: () => void;

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
        this.renderContent();
    }

    private renderContent(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('timebox-baseline-modal');

        const baselines: Record<string, ProjectBaseline> = this.projectData.normalizedProject?.baselines || {};
        const activeBaselineId = this.projectData.normalizedProject?.activeBaselineId;

        // Header
        const header = contentEl.createDiv({ cls: 'timebox-modal-header' });
        header.createEl('h3', { text: `Baseline Management: ${this.projectData.name}` });

        // Active Baseline Selector Banner
        const activeBanner = contentEl.createDiv({ cls: 'timebox-baseline-active-banner' });
        activeBanner.createEl('label', { text: 'Active Comparison Baseline:' });
        const activeSelect = activeBanner.createEl('select');

        const noneOpt = activeSelect.createEl('option', { value: '', text: 'None (Disable Variance Comparison)' });
        if (!activeBaselineId) noneOpt.selected = true;

        for (let i = 0; i <= 10; i++) {
            const bId = String(i);
            const b = baselines[bId] || baselines[`baseline${bId}`];
            if (b) {
                const opt = activeSelect.createEl('option', {
                    value: b.id,
                    text: `${b.name} (${b.savedAt ? b.savedAt.slice(0, 10) : 'Saved'})`
                });
                if (b.id === activeBaselineId || `baseline${b.id}` === activeBaselineId) {
                    opt.selected = true;
                }
            }
        }

        activeSelect.addEventListener('change', async () => {
            const val = activeSelect.value || undefined;
            await this.projectManager.setActiveBaseline(this.projectFile, val);
            if (this.projectData.normalizedProject) {
                this.projectData.normalizedProject.activeBaselineId = val;
            }
            new Notice(val ? `Active comparison set to ${val}` : 'Baseline comparison disabled');
            this.renderContent();
            this.onSaveCallback();
        });

        // Capture New Baseline Section
        const captureSection = contentEl.createDiv({ cls: 'timebox-cal-section' });
        captureSection.createEl('h4', { text: 'Capture New Baseline Snapshot' });

        const captureBar = captureSection.createDiv({ cls: 'timebox-baseline-capture-bar' });
        captureBar.createSpan({ text: 'Slot:' });
        const slotSelect = captureBar.createEl('select');
        for (let i = 0; i <= 10; i++) {
            const bId = String(i);
            const exists = !!(baselines[bId] || baselines[`baseline${bId}`]);
            slotSelect.createEl('option', {
                value: bId,
                text: `Baseline ${i}${exists ? ' (Overwrite)' : ' (Empty)'}`
            });
        }

        captureBar.createSpan({ text: 'Name:' });
        const nameInput = captureBar.createEl('input', {
            type: 'text',
            placeholder: 'e.g. Baseline 0 (Project Approval)'
        });
        nameInput.value = `Baseline ${slotSelect.value}`;

        slotSelect.addEventListener('change', () => {
            nameInput.value = `Baseline ${slotSelect.value}`;
        });

        const captureBtn = captureBar.createEl('button', {
            cls: 'timebox-btn-primary',
            text: 'Capture Baseline'
        });
        captureBtn.addEventListener('click', async () => {
            const slot = slotSelect.value;
            const name = nameInput.value.trim() || `Baseline ${slot}`;
            await this.projectManager.saveProjectBaseline(this.projectFile, slot, name);
            new Notice(`Captured schedule as ${name}`);
            this.close();
            this.onSaveCallback();
        });

        // Baselines List Table
        const listSection = contentEl.createDiv({ cls: 'timebox-cal-section' });
        listSection.createEl('h4', { text: 'Baseline Snapshots (0–10)' });

        const table = listSection.createEl('table', { cls: 'timebox-cal-exceptions-table' });
        const thead = table.createEl('thead');
        const headRow = thead.createEl('tr');
        headRow.createEl('th', { text: 'Slot' });
        headRow.createEl('th', { text: 'Baseline Name' });
        headRow.createEl('th', { text: 'Date Captured' });
        headRow.createEl('th', { text: 'Work (h)' });
        headRow.createEl('th', { text: 'Cost ($)' });
        headRow.createEl('th', { text: 'Status' });
        headRow.createEl('th', { text: 'Action' });

        const tbody = table.createEl('tbody');
        let capturedCount = 0;

        for (let i = 0; i <= 10; i++) {
            const bId = String(i);
            const b = baselines[bId] || baselines[`baseline${bId}`];
            const tr = tbody.createEl('tr');

            tr.createEl('td', { text: `#${i}` });

            if (b) {
                capturedCount++;
                const isActive = b.id === activeBaselineId || `baseline${b.id}` === activeBaselineId;
                tr.createEl('td', { text: b.name });
                tr.createEl('td', { text: b.savedAt ? b.savedAt.slice(0, 16).replace('T', ' ') : '—' });
                tr.createEl('td', { text: String((b as any).totalWorkHours || '—') });
                tr.createEl('td', { text: (b as any).totalCost !== undefined ? `$${(b as any).totalCost.toLocaleString()}` : '—' });

                const statusTd = tr.createEl('td');
                if (isActive) {
                    statusTd.createSpan({ cls: 'timebox-status-badge is-working', text: 'Active' });
                } else {
                    const setBtn = statusTd.createEl('button', { cls: 'timebox-btn-secondary', text: 'Set Active' });
                    setBtn.addEventListener('click', async () => {
                        await this.projectManager.setActiveBaseline(this.projectFile, b.id);
                        new Notice(`Active baseline set to ${b.name}`);
                        this.renderContent();
                        this.onSaveCallback();
                    });
                }

                const actTd = tr.createEl('td');
                const delBtn = actTd.createEl('button', { cls: 'timebox-icon-btn-sm', text: '✕' });
                delBtn.title = 'Delete this baseline snapshot';
                delBtn.addEventListener('click', async () => {
                    if (confirm(`Delete ${b.name}?`)) {
                        await this.projectManager.deleteProjectBaseline(this.projectFile, b.id);
                        new Notice(`Deleted ${b.name}`);
                        this.renderContent();
                        this.onSaveCallback();
                    }
                });
            } else {
                tr.createEl('td', { text: '—', cls: 'timebox-text-muted' });
                tr.createEl('td', { text: 'Empty', cls: 'timebox-text-muted' });
                tr.createEl('td', { text: '—', cls: 'timebox-text-muted' });
                tr.createEl('td', { text: '—', cls: 'timebox-text-muted' });
                tr.createEl('td', { text: '—', cls: 'timebox-text-muted' });

                const actTd = tr.createEl('td');
                const quickCapBtn = actTd.createEl('button', { cls: 'timebox-btn-secondary', text: 'Capture' });
                quickCapBtn.addEventListener('click', async () => {
                    await this.projectManager.saveProjectBaseline(this.projectFile, bId, `Baseline ${i}`);
                    new Notice(`Captured Baseline ${i}`);
                    this.renderContent();
                    this.onSaveCallback();
                });
            }
        }

        // Footer Actions
        const footer = contentEl.createDiv({ cls: 'timebox-modal-footer-split' });
        const closeBtn = footer.createEl('button', { cls: 'timebox-btn-secondary', text: 'Close' });
        closeBtn.addEventListener('click', () => this.close());

        if (capturedCount > 0) {
            const clearBtn = footer.createEl('button', { cls: 'timebox-btn-danger', text: 'Clear All Baselines' });
            clearBtn.addEventListener('click', async () => {
                if (confirm('Clear ALL baselines for this project? This cannot be undone.')) {
                    await this.projectManager.clearAllBaselines(this.projectFile);
                    new Notice('Cleared all baselines');
                    this.renderContent();
                    this.onSaveCallback();
                }
            });
        }
    }
}
