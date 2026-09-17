import { App, Modal, Setting, Notice } from 'obsidian';
import { SavedViewDefinition, TaskSheetFilterState, TaskGroupingMode, TaskDiscoveryEngine } from './taskDiscoveryEngine';

export class SavedViewModal extends Modal {
    private savedViews: SavedViewDefinition[];
    private currentFilterState: TaskSheetFilterState;
    private currentVisibleColumns: string[];
    private currentGroupingMode: TaskGroupingMode;
    private onSaveCallback: (updatedViews: SavedViewDefinition[], selectedViewId: string) => Promise<void>;
    private newViewName: string = '';

    constructor(
        app: App,
        savedViews: SavedViewDefinition[],
        currentFilterState: TaskSheetFilterState,
        currentVisibleColumns: string[],
        currentGroupingMode: TaskGroupingMode,
        onSaveCallback: (updatedViews: SavedViewDefinition[], selectedViewId: string) => Promise<void>
    ) {
        super(app);
        this.savedViews = [...savedViews];
        this.currentFilterState = { ...currentFilterState };
        this.currentVisibleColumns = [...currentVisibleColumns];
        this.currentGroupingMode = currentGroupingMode;
        this.onSaveCallback = onSaveCallback;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('timebox-saved-views-modal');

        contentEl.createEl('h2', { text: 'Saved Views Management' });
        contentEl.createEl('p', {
            cls: 'setting-item-description',
            text: 'Save your current search, filters, columns, and grouping as a reusable custom view. Saved views are stored in plugin settings and never pollute project markdown notes.'
        });

        // Save Current Section
        new Setting(contentEl)
            .setName('Save current view')
            .setDesc('Enter a name to save the active view configuration.')
            .addText(text => text
                .setPlaceholder('e.g. Electrical Critical Path')
                .setValue(this.newViewName)
                .onChange(val => this.newViewName = val))
            .addButton(btn => btn
                .setButtonText('Save View')
                .setCta()
                .onClick(async () => {
                    const name = this.newViewName.trim();
                    if (!name) {
                        new Notice('Please enter a view name.');
                        return;
                    }
                    const newId = 'custom-' + Date.now();
                    const newDef: SavedViewDefinition = {
                        id: newId,
                        name,
                        isSystemPreset: false,
                        filterState: {
                            ...this.currentFilterState,
                            quickFilters: [...TaskDiscoveryEngine.getActiveQuickFilters(this.currentFilterState)],
                            quickFilter: TaskDiscoveryEngine.getActiveQuickFilters(this.currentFilterState)[0] || 'all'
                        },
                        visibleColumnIds: [...this.currentVisibleColumns],
                        groupingMode: this.currentGroupingMode
                    };
                    this.savedViews.push(newDef);
                    await this.onSaveCallback(this.savedViews, newId);
                    new Notice(`Saved view "${name}"`);
                    this.close();
                }));

        // Existing Views List
        contentEl.createEl('h3', { text: 'Available Views' });
        const listContainer = contentEl.createDiv({ cls: 'timebox-saved-views-list' });

        for (const view of this.savedViews) {
            const setting = new Setting(listContainer)
                .setName(view.name)
                .setDesc(
                    view.isSystemPreset
                        ? `System Preset • Grouped by ${view.groupingMode.toUpperCase()} • ${view.visibleColumnIds.length} columns`
                        : `Custom View • Grouped by ${view.groupingMode.toUpperCase()} • ${view.visibleColumnIds.length} columns`
                );

            if (!view.isSystemPreset) {
                setting.addButton(btn => btn
                    .setButtonText('Delete')
                    .setWarning()
                    .onClick(async () => {
                        this.savedViews = this.savedViews.filter(v => v.id !== view.id);
                        await this.onSaveCallback(this.savedViews, 'default');
                        new Notice(`Deleted view "${view.name}"`);
                        this.onOpen();
                    }));
            }
        }
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
