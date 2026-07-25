import { App, Plugin, PluginSettingTab, Setting, TFile, Notice, AbstractInputSuggest, Editor, WorkspaceLeaf, moment } from 'obsidian';
import { ProjectManager } from './projectManager';
import { ProjectDashboardView, TIMEBOX_PROJECT_VIEW_TYPE } from './projectDashboardView';
import { ProjectSuggestModal } from './projectSuggestModal';
import { WhatsNewModal } from './whatsNewModal';

const getMoment = (inp?: unknown, fmt?: unknown, strict?: boolean): moment.Moment => 
    (moment as unknown as (i?: unknown, f?: unknown, s?: boolean) => moment.Moment)(inp, fmt, strict);

export interface TimeBoxSettings {
    timeBoxFolder: string;
    projectsFolder: string;
    enableProjectSync: boolean;
    autoPushProjectTasksToToday: boolean;
    hideCompletedProjectTasks: boolean;
    autoOpenOnStartup: boolean;
    lastSeenVersion: string;
    timeBoxTemplate: string;
    useTemplateFile: boolean;
    templateFilePath: string;
    carryForwardTasks: boolean;
    carryForwardBrainDumps: boolean;
    dateFormat: string;
    rolloverMergeMode: 'section' | 'merge';
    addNavigationLinks: boolean;
}

const DEFAULT_SETTINGS: TimeBoxSettings = {
    timeBoxFolder: 'TimeBox',
    projectsFolder: 'TimeBox/Projects',
    enableProjectSync: true,
    autoPushProjectTasksToToday: true,
    hideCompletedProjectTasks: false,
    autoOpenOnStartup: true,
    lastSeenVersion: '',
    timeBoxTemplate: '## 🎯 Today\'s Focus\n\n## ⏰ Time Blocks\n\n### Morning (6:00 - 12:00)\n- [ ] \n\n### Afternoon (12:00 - 18:00)\n- [ ] \n\n### Evening (18:00 - 22:00)\n- [ ] \n\n## 📝 Tasks\n- [ ] \n\n## 🧠 Brain Dump\n\n\n## 📊 Daily Review\n\n### What went well:\n\n### What could improve:\n\n### Tomorrow\'s priorities:\n',
    useTemplateFile: false,
    templateFilePath: '',
    carryForwardTasks: true,
    carryForwardBrainDumps: true,
    dateFormat: 'YYYY-MM-DD',
    rolloverMergeMode: 'section',
    addNavigationLinks: true
};

export default class TimeBoxPlugin extends Plugin {
    settings: TimeBoxSettings;
    projectManager: ProjectManager;

    async onload() {
        await this.loadSettings();
        this.projectManager = new ProjectManager(this.app);

        // Register custom view for project dashboard
        this.registerView(
            TIMEBOX_PROJECT_VIEW_TYPE,
            (leaf) => new ProjectDashboardView(leaf, this)
        );

        // Add ribbon icon for today's timebox
        this.addRibbonIcon('calendar-clock', 'Open today\'s timebox', async () => {
            await this.openTimeBoxForDate(getMoment());
        });

        // Add ribbon icon for projects dashboard
        this.addRibbonIcon('kanban', 'Open projects dashboard', async () => {
            await this.activateProjectDashboardView();
        });

        // Add commands
        this.addCommand({
            id: 'open-today-timebox',
            name: 'Open today\'s timebox',
            callback: async () => {
                await this.openTimeBoxForDate(getMoment());
            }
        });

        this.addCommand({
            id: 'open-yesterday-timebox',
            name: 'Open yesterday\'s timebox',
            callback: async () => {
                await this.openTimeBoxForDate(getMoment().subtract(1, 'days'));
            }
        });

        this.addCommand({
            id: 'open-tomorrow-timebox',
            name: 'Open tomorrow\'s timebox',
            callback: async () => {
                await this.openTimeBoxForDate(getMoment().add(1, 'days'));
            }
        });

        this.addCommand({
            id: 'open-projects-dashboard',
            name: 'Open TimeBox projects dashboard',
            callback: async () => {
                await this.activateProjectDashboardView();
            }
        });

        // Add command to assign active task line to a project
        this.addCommand({
            id: 'assign-task-to-project',
            name: 'Assign task line to a project...',
            editorCallback: (editor: Editor) => {
                this.assignCurrentTaskToProject(editor);
            }
        });

        // Add command to manually carry forward
        this.addCommand({
            id: 'carry-forward-tasks',
            name: 'Carry forward incomplete items from yesterday',
            callback: async () => {
                await this.carryForwardFromYesterday();
            }
        });

        // Add command to move task to tomorrow
        this.addCommand({
            id: 'move-task-to-tomorrow',
            name: 'Move task/line to tomorrow\'s timebox',
            editorCallback: async (editor: Editor) => {
                await this.moveTaskToTomorrow(editor);
            }
        });

        // Add command for release notes and support
        this.addCommand({
            id: 'open-whats-new',
            name: 'What\'s new & support...',
            callback: () => {
                new WhatsNewModal(this.app, this.manifest.version).open();
            }
        });

        // Add context menu items
        this.registerEvent(
            this.app.workspace.on('editor-menu', (menu, editor) => {
                menu.addItem((item) => {
                    item
                        .setTitle('Move task to tomorrow')
                        .setIcon('arrow-right-circle')
                        .onClick(async () => {
                            await this.moveTaskToTomorrow(editor);
                        });
                });
                menu.addItem((item) => {
                    item
                        .setTitle('Assign task to project...')
                        .setIcon('folder-plus')
                        .onClick(() => {
                            this.assignCurrentTaskToProject(editor);
                        });
                });
            })
        );

        // Bi-directional task status sync & auto-push event listener
        this.registerEvent(
            this.app.vault.on('modify', async (file) => {
                if (!(file instanceof TFile)) return;

                const isDaily = file.path.startsWith(this.settings.timeBoxFolder);
                const isProject = file.path.startsWith(this.settings.projectsFolder);
                if (!isDaily && !isProject) return;

                const content = await this.app.vault.read(file);
                const lines = content.split('\n');

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('- [x]') || trimmed.startsWith('- [X]') || trimmed.startsWith('- [ ]')) {
                        const isCompleted = trimmed.startsWith('- [x]') || trimmed.startsWith('- [X]');
                        const cleanedText = trimmed.replace(/^-\s*\[[ xX]\]\s*/, '');

                        if (this.settings.enableProjectSync) {
                            await this.projectManager.syncTaskCompletion(
                                file,
                                cleanedText,
                                isCompleted,
                                this.settings.projectsFolder,
                                this.settings.timeBoxFolder
                            );
                        }

                        if (isProject && !isCompleted && this.settings.autoPushProjectTasksToToday && cleanedText.length > 2) {
                            await this.projectManager.addProjectTaskToToday(
                                cleanedText,
                                file,
                                this.settings.timeBoxFolder,
                                this.settings.dateFormat
                            );
                        }

                        if (isDaily && cleanedText.includes('[[')) {
                            const linkRegex = /\[\[([^\]]+)\]\]/g;
                            let match: RegExpExecArray | null;
                            while ((match = linkRegex.exec(cleanedText)) !== null) {
                                const projectLink = match[1];
                                if (projectLink) {
                                    const targetProject = this.projectManager.resolveProjectFile(projectLink, this.settings.projectsFolder);
                                    if (targetProject) {
                                        const baseTaskText = cleanedText.replace(/\[\[[^\]]+\]\]/g, '').trim();
                                        if (baseTaskText.length > 1) {
                                            await this.projectManager.addTaskToProject(targetProject, baseTaskText);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            })
        );

        // Auto-initialize blank files when opened
        this.registerEvent(
            this.app.workspace.on('file-open', async (file) => {
                if (file instanceof TFile && file.path.startsWith(this.settings.timeBoxFolder)) {
                    if (file.stat.size === 0) {
                        const dateStr = file.basename;
                        const fileDate = getMoment(dateStr, this.settings.dateFormat, true);
                        if (fileDate.isValid()) {
                            const content = await this.createTimeBoxContentForDate(fileDate);
                            await this.app.vault.modify(file, content);
                            new Notice(`Initialized timebox for ${fileDate.format('YYYY-MM-DD')}`);
                        }
                    }
                }
            })
        );

        // Auto-open on startup if enabled & check for version update notes
        this.app.workspace.onLayoutReady(() => {
            if (this.settings.autoOpenOnStartup) {
                void this.openTimeBoxForDate(getMoment());
                void this.activateProjectDashboardView();
            }
            if (this.settings.lastSeenVersion !== this.manifest.version) {
                new WhatsNewModal(this.app, this.manifest.version).open();
                this.settings.lastSeenVersion = this.manifest.version;
                void this.saveSettings();
            }
        });

        // Add settings tab
        this.addSettingTab(new TimeBoxSettingTab(this.app, this));
    }

    async activateProjectDashboardView(): Promise<void> {
        const { workspace } = this.app;
        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(TIMEBOX_PROJECT_VIEW_TYPE);

        if (leaves.length > 0) {
            leaf = leaves[0];
        } else {
            leaf = workspace.getRightLeaf(false);
            if (leaf) {
                await leaf.setViewState({
                    type: TIMEBOX_PROJECT_VIEW_TYPE,
                    active: true
                });
            }
        }

        if (leaf) {
            workspace.setActiveLeaf(leaf, { focus: true });
            if (leaf.view instanceof ProjectDashboardView) {
                await leaf.view.render();
            }
            const rightSplit = (workspace as unknown as { rightSplit?: { expand?: () => void } }).rightSplit;
            if (rightSplit && typeof rightSplit.expand === 'function') {
                rightSplit.expand();
            }
        }
    }

    assignCurrentTaskToProject(editor: Editor): void {
        const cursor = editor.getCursor();
        const lineText = editor.getLine(cursor.line).trim();
        if (!lineText) {
            new Notice('Current line is empty');
            return;
        }

        const projectFiles = this.projectManager.getProjectFiles(this.settings.projectsFolder);
        if (projectFiles.length === 0) {
            new Notice(`No project notes found in "${this.settings.projectsFolder}". Create one first!`);
            return;
        }

        const modal = new ProjectSuggestModal(this.app, projectFiles, (selectedProject) => {
            void (async () => {
                const cleanedText = lineText.replace(/^-\s*\[[ xX]\]\s*/, '');
                const updatedLine = lineText.includes('[[')
                    ? lineText
                    : lineText.startsWith('-')
                    ? `${lineText} [[${selectedProject.basename}]]`
                    : `- [ ] ${lineText} [[${selectedProject.basename}]]`;

                editor.setLine(cursor.line, updatedLine);
                await this.projectManager.addTaskToProject(selectedProject, cleanedText, true);
            })();
        });

        modal.open();
    }

    async moveTaskToTomorrow(editor: Editor): Promise<void> {
        const cursor = editor.getCursor();
        const lineText = editor.getLine(cursor.line);
        if (!lineText.trim()) {
            new Notice('Current line is empty');
            return;
        }

        // Determine base date relative to active file, or default to today
        const activeFile = this.app.workspace.getActiveFile();
        let baseDate = getMoment();
        if (activeFile && activeFile.path.startsWith(this.settings.timeBoxFolder)) {
            const dateStr = activeFile.basename;
            const fileDate = getMoment(dateStr, this.settings.dateFormat, true);
            if (fileDate.isValid()) {
                baseDate = fileDate;
            }
        }

        const targetDate = getMoment(baseDate).add(1, 'days');
        const targetPath = this.getTimeBoxPath(targetDate);
        await this.ensureTimeBoxFolder();

        const targetFile = this.app.vault.getAbstractFileByPath(targetPath);
        let targetContent = '';
        if (targetFile instanceof TFile) {
            targetContent = await this.app.vault.read(targetFile);
        } else {
            targetContent = await this.createTimeBoxContentForDate(targetDate);
        }

        const cleanedLine = lineText.trim();
        let itemToInsert = cleanedLine;
        if (cleanedLine.includes('- [x]')) {
            itemToInsert = cleanedLine.replace('- [x]', '- [ ]');
        } else if (!cleanedLine.startsWith('-')) {
            itemToInsert = `- [ ] ${cleanedLine}`;
        }

        const updatedContent = this.insertUnderHeading(targetContent, ['tasks', '📋 Tasks'], [itemToInsert]);

        if (targetFile instanceof TFile) {
            await this.app.vault.modify(targetFile, updatedContent);
        } else {
            await this.app.vault.create(targetPath, updatedContent);
        }

        // Delete the line from current editor
        editor.replaceRange('', { line: cursor.line, ch: 0 }, { line: cursor.line + 1, ch: 0 });
        new Notice(`Moved task to ${targetDate.format('YYYY-MM-DD')}'s timebox`);
    }

    async loadSettings() {
        const loadedData = (await this.loadData()) as Partial<TimeBoxSettings> | null;
        this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData || {});
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    getDateFileName(date: moment.Moment): string {
        const format = this.settings.dateFormat || 'YYYY-MM-DD';
        return `${date.format(format)}.md`;
    }

    getTimeBoxPath(date: moment.Moment): string {
        return `${this.settings.timeBoxFolder}/${this.getDateFileName(date)}`;
    }

    async ensureTimeBoxFolder() {
        const folder = this.app.vault.getAbstractFileByPath(this.settings.timeBoxFolder);
        if (!folder) {
            await this.app.vault.createFolder(this.settings.timeBoxFolder);
        }
    }

    async openTimeBoxForDate(date: moment.Moment) {
        const path = this.getTimeBoxPath(date);

        await this.ensureTimeBoxFolder();

        let file = this.app.vault.getAbstractFileByPath(path);

        if (!file) {
            // Create the file
            const content = await this.createTimeBoxContentForDate(date);
            file = await this.app.vault.create(path, content);
            new Notice(`Created timebox for ${date.format('YYYY-MM-DD')}`);
        }

        // Open the file
        const leaf = this.app.workspace.getLeaf(false);
        if (file instanceof TFile) {
            await leaf.openFile(file);
        }
    }

    async createTimeBoxContentForDate(date: moment.Moment): Promise<string> {
        const titleFormat = 'dddd, MMMM Do YYYY';
        let content = `# Timebox - ${date.format(titleFormat)}\n\n`;

        if (this.settings.addNavigationLinks) {
            const yesterdayDate = getMoment(date).subtract(1, 'days');
            const tomorrowDate = getMoment(date).add(1, 'days');
            const yesterdayFileBase = this.getDateFileName(yesterdayDate).replace(/\.md$/, '');
            const tomorrowFileBase = this.getDateFileName(tomorrowDate).replace(/\.md$/, '');
            content += `[[${this.settings.timeBoxFolder}/${yesterdayFileBase}|◀ Yesterday]] | [[${this.settings.timeBoxFolder}/${tomorrowFileBase}|Tomorrow ▶]]\n\n`;
        }

        let templateContent = this.settings.timeBoxTemplate;
        if (this.settings.useTemplateFile && this.settings.templateFilePath) {
            const templateFile = this.app.vault.getAbstractFileByPath(this.settings.templateFilePath);
            if (templateFile instanceof TFile) {
                templateContent = await this.app.vault.read(templateFile);
            } else {
                new Notice(`Template file not found at: ${this.settings.templateFilePath}. Using default template.`);
            }
        }

        // Replace placeholders
        const format = this.settings.dateFormat || 'YYYY-MM-DD';
        
        // 1. Match {{date:FORMAT}}
        templateContent = templateContent.replace(/\{\{date:([^}]+)\}\}/g, (_match, customFormat: string) => {
            return date.format(customFormat);
        });
        // 2. Match {{date}}
        templateContent = templateContent.replace(/\{\{date\}\}/g, date.format(format));

        // 3. Match {{yesterday:FORMAT}} and {{yesterday}}
        templateContent = templateContent.replace(/\{\{yesterday:([^}]+)\}\}/g, (_match, customFormat: string) => {
            return getMoment(date).subtract(1, 'days').format(customFormat);
        });
        templateContent = templateContent.replace(/\{\{yesterday\}\}/g, getMoment(date).subtract(1, 'days').format(format));

        // 4. Match {{tomorrow:FORMAT}} and {{tomorrow}}
        templateContent = templateContent.replace(/\{\{tomorrow:([^}]+)\}\}/g, (_match, customFormat: string) => {
            return getMoment(date).add(1, 'days').format(customFormat);
        });
        templateContent = templateContent.replace(/\{\{tomorrow\}\}/g, getMoment(date).add(1, 'days').format(format));

        // Carry forward items from yesterday if enabled
        if (this.settings.carryForwardTasks || this.settings.carryForwardBrainDumps) {
            const { incompleteTasks, brainDumps } = await this.getCarriedForwardItems();
            
            if (incompleteTasks.length > 0 || brainDumps.length > 0) {
                if (this.settings.rolloverMergeMode === 'merge') {
                    if (this.settings.carryForwardTasks) {
                        templateContent = this.insertUnderHeading(templateContent, ['tasks', '📋 Tasks'], incompleteTasks);
                    }
                    if (this.settings.carryForwardBrainDumps) {
                        templateContent = this.insertUnderHeading(templateContent, ['brain dump', '🧠 Brain Dump', 'braindump'], brainDumps);
                    }
                } else {
                    let carriedContent = '## 📤 Carried forward from yesterday\n\n';
                    if (incompleteTasks.length > 0) {
                        carriedContent += '### Incomplete tasks\n' + incompleteTasks.join('\n') + '\n\n';
                    }
                    if (brainDumps.length > 0) {
                        carriedContent += '### Brain dump items\n' + brainDumps.join('\n') + '\n\n';
                    }
                    content += carriedContent + '---\n\n';
                }
            }
        }

        content += templateContent;
        return content;
    }

    insertUnderHeading(content: string, headingKeywords: string[], items: string[]): string {
        if (items.length === 0) return content;
        
        const lines = content.split('\n');
        let insertIndex = -1;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.startsWith('#')) {
                const lowerLine = line.toLowerCase();
                if (headingKeywords.some(keyword => lowerLine.includes(keyword.toLowerCase()))) {
                    insertIndex = i + 1;
                    // Skip trailing blank lines or placeholder checklists immediately following the heading
                    while (insertIndex < lines.length && 
                           (lines[insertIndex].trim() === '' || 
                            lines[insertIndex].trim() === '- [ ]' ||
                            lines[insertIndex].trim() === '- [ ] ')) {
                        insertIndex++;
                    }
                    break;
                }
            }
        }
        
        if (insertIndex !== -1) {
            lines.splice(insertIndex, 0, ...items);
            return lines.join('\n');
        } else {
            return content + '\n\n' + items.join('\n');
        }
    }

    async carryForwardFromYesterday(): Promise<void> {
        const today = getMoment();
        const todayPath = this.getTimeBoxPath(today);
        const abstractFile = this.app.vault.getAbstractFileByPath(todayPath);

        if (!(abstractFile instanceof TFile)) {
            new Notice('Today\'s timebox doesn\'t exist yet. Creating it will automatically carry forward items.');
            await this.openTimeBoxForDate(today);
            return;
        }

        const file = abstractFile;
        const currentContent = await this.app.vault.read(file);
        
        if (currentContent.includes('## 📤 Carried forward') || currentContent.includes('## 📤 Carried Forward')) {
            new Notice('Items already carried forward today.');
            return;
        }

        const { incompleteTasks, brainDumps } = await this.getCarriedForwardItems();
        
        if (incompleteTasks.length === 0 && brainDumps.length === 0) {
            new Notice('No incomplete items to carry forward.');
            return;
        }

        let newContent = currentContent;
        if (this.settings.rolloverMergeMode === 'merge') {
            // Filter out items already in the document to prevent duplicates
            const filteredTasks = incompleteTasks.filter(task => !currentContent.includes(task));
            const filteredBrainDumps = brainDumps.filter(item => !currentContent.includes(item));

            if (filteredTasks.length === 0 && filteredBrainDumps.length === 0) {
                new Notice('No new incomplete items to carry forward.');
                return;
            }

            if (this.settings.carryForwardTasks) {
                newContent = this.insertUnderHeading(newContent, ['tasks', '📋 Tasks'], filteredTasks);
            }
            if (this.settings.carryForwardBrainDumps) {
                newContent = this.insertUnderHeading(newContent, ['brain dump', '🧠 Brain Dump', 'braindump'], filteredBrainDumps);
            }
        } else {
            let carriedContent = '## 📤 Carried forward from yesterday\n\n';
            if (incompleteTasks.length > 0) {
                carriedContent += '### Incomplete tasks\n' + incompleteTasks.join('\n') + '\n\n';
            }
            if (brainDumps.length > 0) {
                carriedContent += '### Brain dump items\n' + brainDumps.join('\n') + '\n\n';
            }

            const lines = currentContent.split('\n');
            const titleIndex = lines.findIndex(line => line.startsWith('# Timebox'));
            if (titleIndex !== -1) {
                lines.splice(titleIndex + 1, 0, '', carriedContent, '---', '');
                newContent = lines.join('\n');
            } else {
                newContent = carriedContent + '---\n\n' + currentContent;
            }
        }

        await this.app.vault.modify(file, newContent);
        new Notice('Carried forward incomplete items.');
    }

    async wasTaskCompletedBetween(incompleteTaskText: string, daysBackFromOriginal: number): Promise<boolean> {
        const completedTaskText = incompleteTaskText.replace('- [ ]', '- [x]');

        for (let daysBack = daysBackFromOriginal - 1; daysBack >= 0; daysBack--) {
            const checkDate = getMoment().subtract(daysBack, 'days');
            const checkPath = this.getTimeBoxPath(checkDate);
            const abstractCheckFile = this.app.vault.getAbstractFileByPath(checkPath);

            if (!(abstractCheckFile instanceof TFile)) {
                continue;
            }

            const content = await this.app.vault.read(abstractCheckFile);
            if (content.includes(completedTaskText)) {
                return true;
            }
        }

        return false;
    }

    async getCarriedForwardItems(): Promise<{ incompleteTasks: string[], brainDumps: string[] }> {
        const incompleteTasks: string[] = [];
        const brainDumps: string[] = [];
        const maxDaysBack = 14;

        for (let daysBack = 1; daysBack <= maxDaysBack; daysBack++) {
            const pastDate = getMoment().subtract(daysBack, 'days');
            const pastPath = this.getTimeBoxPath(pastDate);
            const abstractPastFile = this.app.vault.getAbstractFileByPath(pastPath);
            if (!(abstractPastFile instanceof TFile)) {
                continue;
            }
            const pastFile = abstractPastFile;
            const content = await this.app.vault.read(pastFile);
            const lines = content.split('\n');
            let inBrainDumpSection = false;
            let inTimeBlockSection = false;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                if (line.includes('Morning') || line.includes('Afternoon') || line.includes('Evening')) {
                    if (line.startsWith('###') || line.startsWith('##')) {
                        inTimeBlockSection = true;
                        continue;
                    }
                }

                if (line.includes('🧠 Brain Dump') || line.includes('Brain Dump')) {
                    inBrainDumpSection = true;
                    inTimeBlockSection = false;
                    continue;
                }

                if ((inTimeBlockSection || inBrainDumpSection) && line.startsWith('#')) {
                    if (!(line.includes('Morning') || line.includes('Afternoon') || line.includes('Evening'))) {
                        inTimeBlockSection = false;
                    }
                    if (!line.includes('Brain Dump')) {
                        inBrainDumpSection = false;
                    }
                }

                if (this.settings.carryForwardTasks && line.includes('- [ ]') && !inTimeBlockSection) {
                    const taskText = line.trim();
                    if (taskText.length > 5) {
                        if (!incompleteTasks.includes(taskText)) {
                            const wasCompletedLater = await this.wasTaskCompletedBetween(taskText, daysBack);
                            if (!wasCompletedLater) {
                                incompleteTasks.push(taskText);
                            }
                        }
                    }
                }

                if (this.settings.carryForwardBrainDumps && inBrainDumpSection) {
                    const trimmed = line.trim();
                    if (trimmed && !trimmed.startsWith('#') && trimmed.length > 0) {
                        let brainDumpItem = trimmed;
                        if (!trimmed.startsWith('-') && !trimmed.startsWith('*')) {
                            brainDumpItem = `- ${trimmed}`;
                        }
                        if (!brainDumps.includes(brainDumpItem)) {
                            brainDumps.push(brainDumpItem);
                        }
                    }
                }
            }
        }
        return { incompleteTasks, brainDumps };
    }
}

class TimeBoxSettingTab extends PluginSettingTab {
    plugin: TimeBoxPlugin;

    constructor(app: App, plugin: TimeBoxPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    getSettingDefinitions() {
        return [];
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        new Setting(containerEl)
            .setName('Configuration').setHeading();

        new Setting(containerEl)
            .setName('Timebox folder')
            .setDesc('Folder where timebox files will be stored')
            .addText(text => text
                .setPlaceholder('Timebox')
                .setValue(this.plugin.settings.timeBoxFolder)
                .onChange((value) => {
                    this.plugin.settings.timeBoxFolder = value;
                    this.plugin.saveSettings().catch(console.error);
                }));

        new Setting(containerEl)
            .setName('Projects folder')
            .setDesc('Folder where master project notes are stored')
            .addText(text => text
                .setPlaceholder('TimeBox/Projects')
                .setValue(this.plugin.settings.projectsFolder)
                .onChange((value) => {
                    this.plugin.settings.projectsFolder = value || 'TimeBox/Projects';
                    this.plugin.saveSettings().catch(console.error);
                }));

        new Setting(containerEl)
            .setName('Enable bi-directional project sync')
            .setDesc('Automatically sync task completion status between daily notes and project notes')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableProjectSync)
                .onChange((value) => {
                    this.plugin.settings.enableProjectSync = value;
                    this.plugin.saveSettings().catch(console.error);
                }));

        new Setting(containerEl)
            .setName("Auto-push new project tasks to Today's TimeBox")
            .setDesc("Automatically add any new task created inside a Project Note directly into today's daily note")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoPushProjectTasksToToday)
                .onChange((value) => {
                    this.plugin.settings.autoPushProjectTasksToToday = value;
                    this.plugin.saveSettings().catch(console.error);
                }));

        new Setting(containerEl)
            .setName("Hide completed tasks in Projects Dashboard")
            .setDesc("Hide finished (- [x]) tasks from the sidebar project cards by default")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.hideCompletedProjectTasks)
                .onChange((value) => {
                    this.plugin.settings.hideCompletedProjectTasks = value;
                    this.plugin.saveSettings().catch(console.error);
                }));

        new Setting(containerEl)
            .setName('Date format')
            .setDesc('The format used to name daily timebox files. Example: YYYY-MM-DD (2026-06-04) or YYYY/MM-DD to group them in subfolders.')
            .addText(text => text
                .setPlaceholder('YYYY-MM-DD')
                .setValue(this.plugin.settings.dateFormat)
                .onChange((value) => {
                    this.plugin.settings.dateFormat = value || 'YYYY-MM-DD';
                    this.plugin.saveSettings().catch(console.error);
                }));

        new Setting(containerEl)
            .setName('Add daily navigation links')
            .setDesc('Add yesterday and tomorrow navigation links at the top of daily notes')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.addNavigationLinks)
                .onChange((value) => {
                    this.plugin.settings.addNavigationLinks = value;
                    this.plugin.saveSettings().catch(console.error);
                }));

        new Setting(containerEl)
            .setName('Auto-open on startup')
            .setDesc('Automatically open today\'s timebox when Obsidian starts')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoOpenOnStartup)
                .onChange((value) => {
                    this.plugin.settings.autoOpenOnStartup = value;
                    this.plugin.saveSettings().catch(console.error);
                }));

        new Setting(containerEl)
            .setName('Carry forward incomplete tasks')
            .setDesc('Automatically move unchecked tasks from yesterday to today')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.carryForwardTasks)
                .onChange((value) => {
                    this.plugin.settings.carryForwardTasks = value;
                    this.plugin.saveSettings().catch(console.error);
                }));

        new Setting(containerEl)
            .setName('Carry forward brain dump items')
            .setDesc('Automatically move brain dump items from yesterday to today')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.carryForwardBrainDumps)
                .onChange((value) => {
                    this.plugin.settings.carryForwardBrainDumps = value;
                    this.plugin.saveSettings().catch(console.error);
                }));

        new Setting(containerEl)
            .setName('Rollover merge mode')
            .setDesc('Choose where incomplete items are inserted in today\'s note')
            .addDropdown(dropdown => dropdown
                .addOption('section', 'Separate rollover section (Default)')
                .addOption('merge', 'Merge into respective template headings')
                .setValue(this.plugin.settings.rolloverMergeMode)
                .onChange((value: 'section' | 'merge') => {
                    this.plugin.settings.rolloverMergeMode = value;
                    this.plugin.saveSettings().catch(console.error);
                }));

        new Setting(containerEl)
            .setName('Use external template file')
            .setDesc('Use a markdown file from your vault as a template instead of the text box below')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.useTemplateFile)
                .onChange((value) => {
                    this.plugin.settings.useTemplateFile = value;
                    this.plugin.saveSettings().catch(console.error);
                }));

        new Setting(containerEl)
            .setName('Template file path')
            .setDesc('Relative path to the markdown template in your vault (e.g. templates/timebox.md)')
            .addText(text => {
                text
                    .setPlaceholder('templates/timebox.md')
                    .setValue(this.plugin.settings.templateFilePath)
                    .onChange((value) => {
                        this.plugin.settings.templateFilePath = value;
                        this.plugin.saveSettings().catch(console.error);
                    });
                new FileSuggest(this.app, text.inputEl);
            });

        new Setting(containerEl)
            .setName('Timebox default template')
            .setDesc('Fallback inline template used when not using an external template file')
            .addTextArea(text => {
                text
                    .setPlaceholder('Enter your template...')
                    .setValue(this.plugin.settings.timeBoxTemplate)
                    .onChange((value) => {
                        this.plugin.settings.timeBoxTemplate = value;
                        this.plugin.saveSettings().catch(console.error);
                    });
                text.inputEl.rows = 15;
                text.inputEl.cols = 50;
            });

        new Setting(containerEl)
            .setName('Support & Release Notes')
            .setHeading();

        new Setting(containerEl)
            .setName("What's New in TimeBox Daily")
            .setDesc("View release notes, latest features, and developer support options")
            .addButton(btn => btn
                .setButtonText("View What's New")
                .setCta()
                .onClick(() => {
                    new WhatsNewModal(this.app, this.plugin.manifest.version).open();
                }));
    }
}

class FileSuggest extends AbstractInputSuggest<TFile> {
    inputEl: HTMLInputElement;

    constructor(app: App, inputEl: HTMLInputElement) {
        super(app, inputEl);
        this.inputEl = inputEl;
    }

    getSuggestions(inputStr: string): TFile[] {
        const lowerCaseInputStr = inputStr.toLowerCase();
        const files = this.app.vault.getFiles();
        return files.filter(file => 
            file.extension === 'md' && 
            file.path.toLowerCase().includes(lowerCaseInputStr)
        );
    }

    renderSuggestion(file: TFile, el: HTMLElement): void {
        el.setText(file.path);
    }

    selectSuggestion(file: TFile): void {
        this.inputEl.value = file.path;
        this.inputEl.dispatchEvent(new Event('input'));
        this.close();
    }
}
