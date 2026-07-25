import { App, FuzzySuggestModal, TFile } from 'obsidian';

export class ProjectSuggestModal extends FuzzySuggestModal<TFile> {
    projectFiles: TFile[];
    onSelect: (selectedProject: TFile) => void;

    constructor(app: App, projectFiles: TFile[], onSelect: (selectedProject: TFile) => void) {
        super(app);
        this.projectFiles = projectFiles;
        this.onSelect = onSelect;
        this.setPlaceholder('Select target project note...');
    }

    getItems(): TFile[] {
        return this.projectFiles;
    }

    getItemText(item: TFile): string {
        return item.basename;
    }

    onChooseItem(item: TFile, evt: MouseEvent | KeyboardEvent): void {
        this.onSelect(item);
    }
}
