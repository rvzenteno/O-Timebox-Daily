import { App, Modal, Setting } from 'obsidian';
import {
    TaskSheetColumnDef,
    ALL_TASKSHEET_COLUMNS,
    DEFAULT_TASKSHEET_COLUMNS,
    PRESET_EXECUTION_COLUMNS,
    PRESET_VARIANCE_COLUMNS,
    PRESET_FLOAT_COLUMNS
} from './taskSheetModel';

export class ColumnVisibilityModal extends Modal {
    private currentSelected: Set<string>;
    private onApply: (selectedCols: string[]) => Promise<void>;

    constructor(app: App, initialSelected: string[], onApply: (selectedCols: string[]) => Promise<void>) {
        super(app);
        this.currentSelected = new Set(initialSelected.length > 0 ? initialSelected : DEFAULT_TASKSHEET_COLUMNS);
        this.onApply = onApply;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('timebox-column-modal');

        contentEl.createEl('h2', { text: 'Task Sheet Columns & Customization' });

        const desc = contentEl.createEl('p', {
            cls: 'setting-item-description',
            text: 'Configure visible columns in the Task Sheet. Preferences are saved to your settings without polluting project notes.'
        });

        // Presets Bar
        const presetContainer = contentEl.createDiv({ cls: 'timebox-column-presets-container' });
        presetContainer.createEl('span', { cls: 'timebox-column-preset-label', text: 'Presets: ' });

        const presets = [
            { label: 'Standard Plan', cols: DEFAULT_TASKSHEET_COLUMNS },
            { label: 'Execution & Actuals', cols: PRESET_EXECUTION_COLUMNS },
            { label: 'Variance & Controls', cols: PRESET_VARIANCE_COLUMNS },
            { label: 'Float & CPM Analysis', cols: PRESET_FLOAT_COLUMNS },
            { label: 'Select All', cols: ALL_TASKSHEET_COLUMNS.map(c => c.id) },
            { label: 'Reset Defaults', cols: DEFAULT_TASKSHEET_COLUMNS }
        ];

        for (const preset of presets) {
            const btn = presetContainer.createEl('button', {
                cls: 'timebox-column-preset-btn',
                text: preset.label
            });
            btn.addEventListener('click', () => {
                this.currentSelected = new Set(preset.cols);
                this.renderColumnList(listContainer);
            });
        }

        // Column List Container
        const listContainer = contentEl.createDiv({ cls: 'timebox-column-groups-container' });
        this.renderColumnList(listContainer);

        // Footer buttons
        const footer = contentEl.createDiv({ cls: 'modal-button-container timebox-column-modal-footer' });
        
        const cancelBtn = footer.createEl('button', { text: 'Cancel' });
        cancelBtn.addEventListener('click', () => this.close());

        const applyBtn = footer.createEl('button', {
            cls: 'mod-cta',
            text: 'Apply Columns'
        });
        applyBtn.addEventListener('click', () => {
            void (async () => {
                // Keep order matching ALL_TASKSHEET_COLUMNS
                const orderedSelected = ALL_TASKSHEET_COLUMNS
                    .filter(c => this.currentSelected.has(c.id))
                    .map(c => c.id);
                // Ensure at least task name is visible
                if (!orderedSelected.includes('name')) {
                    orderedSelected.unshift('name');
                }
                await this.onApply(orderedSelected);
                this.close();
            })();
        });
    }

    private renderColumnList(container: HTMLElement): void {
        container.empty();

        const categories: Array<{ id: TaskSheetColumnDef['category']; title: string }> = [
            { id: 'core', title: 'Core & Structure' },
            { id: 'schedule', title: 'Planned Schedule' },
            { id: 'actuals', title: 'Execution & Actuals' },
            { id: 'baseline', title: 'Baseline & Variance' },
            { id: 'analysis', title: 'Critical Path & Float' }
        ];

        for (const cat of categories) {
            const cols = ALL_TASKSHEET_COLUMNS.filter(c => c.category === cat.id);
            if (cols.length === 0) continue;

            const groupEl = container.createDiv({ cls: 'timebox-column-group' });
            groupEl.createEl('h3', { cls: 'timebox-column-group-title', text: cat.title });

            const grid = groupEl.createDiv({ cls: 'timebox-column-grid' });
            for (const col of cols) {
                const itemEl = grid.createDiv({ cls: 'timebox-column-item' });
                
                const labelEl = itemEl.createEl('label', { cls: 'timebox-column-label' });
                const checkbox = labelEl.createEl('input', { type: 'checkbox' });
                checkbox.checked = this.currentSelected.has(col.id);

                checkbox.addEventListener('change', () => {
                    if (checkbox.checked) {
                        this.currentSelected.add(col.id);
                    } else {
                        // Prevent unchecking task name
                        if (col.id === 'name') {
                            checkbox.checked = true;
                            return;
                        }
                        this.currentSelected.delete(col.id);
                    }
                });

                const textSpan = labelEl.createSpan({ cls: 'timebox-column-name', text: col.label });
                itemEl.createEl('div', { cls: 'timebox-column-desc', text: col.description });
            }
        }
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
