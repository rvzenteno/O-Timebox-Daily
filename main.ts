import { App, Plugin, PluginSettingTab, Setting, TFile, Notice, moment } from 'obsidian';

interface TimeBoxSettings {
    timeBoxFolder: string;
    autoOpenOnStartup: boolean;
    timeBoxTemplate: string;
    carryForwardTasks: boolean;
    carryForwardBrainDumps: boolean;
}

const DEFAULT_SETTINGS: TimeBoxSettings = {
    timeBoxFolder: 'TimeBox',
    autoOpenOnStartup: true,
    timeBoxTemplate: '## 🎯 Today\'s Focus\n\n## ⏰ Time Blocks\n\n### Morning (6:00 - 12:00)\n- [ ] \n\n### Afternoon (12:00 - 18:00)\n- [ ] \n\n### Evening (18:00 - 22:00)\n- [ ] \n\n## 📝 Tasks\n- [ ] \n\n## 🧠 Brain Dump\n\n\n## 📊 Daily Review\n\n### What went well:\n\n### What could improve:\n\n### Tomorrow\'s priorities:\n',
    carryForwardTasks: true,
    carryForwardBrainDumps: true
};

export default class TimeBoxPlugin extends Plugin {
    settings: TimeBoxSettings;

    async onload() {
        await this.loadSettings();

        // Add ribbon icon
        this.addRibbonIcon('calendar-clock', 'Open Today\'s TimeBox', async () => {
            await this.openTodayTimeBox();
        });

        // Add command
        this.addCommand({
            id: 'open-today-timebox',
            name: 'Open today\'s timebox',
            callback: async () => {
                await this.openTodayTimeBox();
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

        // Auto-open on startup if enabled
        if (this.settings.autoOpenOnStartup) {
this.app.workspace.onLayoutReady(() => {
            void this.openTodayTimeBox();
        });
}

        // Add settings tab
        this.addSettingTab(new TimeBoxSettingTab(this.app, this));
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    getDateFileName(date: moment.Moment): string {
        return `${date.format('YYYY-MM-DD')}.md`;
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

    async openTodayTimeBox() {
        const today = moment();
        const todayPath = this.getTimeBoxPath(today);

        await this.ensureTimeBoxFolder();

        let file = this.app.vault.getAbstractFileByPath(todayPath);

        if (!file) {
            // Create today's file
            const content = await this.createTodayTimeBoxContent(today);
            file = await this.app.vault.create(todayPath, content);
            new Notice('Created today\'s timebox');
        }

        // Open the file
        const leaf = this.app.workspace.getLeaf(false);
if (file instanceof TFile) {
    await leaf.openFile(file);
}

}
    async createTodayTimeBoxContent(today: moment.Moment): Promise<string> {
        let content = `# TimeBox - ${today.format('dddd, MMMM Do YYYY')}\n\n`;

        // Carry forward items from yesterday if enabled
        if (this.settings.carryForwardTasks || this.settings.carryForwardBrainDumps) {
            const carriedContent = await this.getCarriedForwardContent();
            if (carriedContent) {
                content += carriedContent + '\n\n---\n\n';
            }
        }

        content += this.settings.timeBoxTemplate;

        return content;
    }

    async carryForwardFromYesterday(): Promise<void> {
        const today = moment();
        const todayPath = this.getTimeBoxPath(today);
        
        const abstractFile = this.app.vault.getAbstractFileByPath(todayPath);

if (!(abstractFile instanceof TFile)) {
    return;
}

const file = abstractFile;

        
        if (!file) {
            new Notice('Today\'s timebox doesn\'t exist yet. Opening it will carry forward items.');
            await this.openTodayTimeBox();
            return;
        }

        const carriedContent = await this.getCarriedForwardContent();
        
        if (!carriedContent) {
            new Notice('No incomplete items to carry forward.');
            return;
        }

        const currentContent = await this.app.vault.read(file);
        
        // Check if content was already carried forward
        if (currentContent.includes('## 📤 Carried Forward')) {
            new Notice('Items already carried forward today.');
            return;
        }

        // Insert carried content after the title
        const lines = currentContent.split('\n');
        const titleIndex = lines.findIndex(line => line.startsWith('# TimeBox'));
        
        if (titleIndex !== -1) {
            lines.splice(titleIndex + 1, 0, '', carriedContent, '', '---', '');
            const newContent = lines.join('\n');
            await this.app.vault.modify(file, newContent);
            new Notice('Carried forward incomplete items.');
        }
    }

    async getCarriedForwardContent(): Promise<string> {
        const incompleteTasks: string[] = [];
        const brainDumps: string[] = [];
        const maxDaysBack = 14;
        
        // Search backwards up to 14 days to find incomplete tasks
        for (let daysBack = 1; daysBack <= maxDaysBack; daysBack++) {
            const pastDate = moment().subtract(daysBack, 'days');
            const pastPath = this.getTimeBoxPath(pastDate);
const abstractPastFile = this.app.vault.getAbstractFileByPath(pastPath);
if (!(abstractPastFile instanceof TFile)) {
    continue;
}
const pastFile = abstractPastFile;

            if (!pastFile) {
                // No file for this day, continue to previous day
                continue;
            }

            const content = await this.app.vault.read(pastFile);
            const lines = content.split('\n');
            let inBrainDumpSection = false;
            let inTimeBlockSection = false;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                // Check if we're entering a time block section (Morning, Afternoon, Evening)
                if (line.includes('Morning') || line.includes('Afternoon') || line.includes('Evening')) {
                    if (line.startsWith('###') || line.startsWith('##')) {
                        inTimeBlockSection = true;
                        continue;
                    }
                }

                // Check if we're in brain dump section
                if (line.includes('🧠 Brain Dump') || line.includes('Brain Dump')) {
                    inBrainDumpSection = true;
                    inTimeBlockSection = false;
                    continue;
                }

                // Exit time block section or brain dump section on next heading
                if ((inTimeBlockSection || inBrainDumpSection) && line.startsWith('#')) {
                    // Check if it's NOT another time block heading
                    if (!(line.includes('Morning') || line.includes('Afternoon') || line.includes('Evening'))) {
                        inTimeBlockSection = false;
                    }
                    if (!line.includes('Brain Dump')) {
                        inBrainDumpSection = false;
                    }
                }

                // Collect incomplete tasks (but NOT from time block sections)
                if (this.settings.carryForwardTasks && line.includes('- [ ]') && !inTimeBlockSection) {
                    const taskText = line.trim();
                    if (taskText.length > 6) { // Not empty
                        // Check for duplicates before adding
                        if (!incompleteTasks.includes(taskText)) {
                            incompleteTasks.push(taskText);
                        }
                    }
                }

                // Collect brain dump items
                if (this.settings.carryForwardBrainDumps && inBrainDumpSection) {
                    const trimmed = line.trim();
                    if (trimmed && !trimmed.startsWith('#') && trimmed.length > 0) {
                        let brainDumpItem = trimmed;
                        // Check if it's a bullet point or regular text
                        if (!trimmed.startsWith('-') && !trimmed.startsWith('*')) {
                            brainDumpItem = `- ${trimmed}`;
                        }
                        // Check for duplicates before adding
                        if (!brainDumps.includes(brainDumpItem)) {
                            brainDumps.push(brainDumpItem);
                        }
                    }
                }
            }
        }

        if (incompleteTasks.length === 0 && brainDumps.length === 0) {
            return '';
        }

        let carriedContent = '## 📤 Carried Forward from Yesterday\n\n';

        if (incompleteTasks.length > 0) {
            carriedContent += '### Incomplete Tasks\n';
            carriedContent += incompleteTasks.join('\n') + '\n\n';
        }

        if (brainDumps.length > 0) {
            carriedContent += '### Brain Dump Items\n';
            carriedContent += brainDumps.join('\n') + '\n';
        }

        return carriedContent;
    }
}

class TimeBoxSettingTab extends PluginSettingTab {
    plugin: TimeBoxPlugin;

    constructor(app: App, plugin: TimeBoxPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        new Setting(containerEl)
            .setName('Configuration').setHeading();

        new Setting(containerEl)
            .setName('Timebox folder')
            .setDesc('Folder where TimeBox files will be stored')
            .addText(text => text
                .setPlaceholder('TimeBox')
                .setValue(this.plugin.settings.timeBoxFolder)
                .onChange(async (value) => {
                    this.plugin.settings.timeBoxFolder = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Auto-open on startup')
            .setDesc('Automatically open today\'s TimeBox when Obsidian starts')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoOpenOnStartup)
                .onChange(async (value) => {
                    this.plugin.settings.autoOpenOnStartup = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Carry forward incomplete tasks')
            .setDesc('Automatically move unchecked tasks from yesterday to today')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.carryForwardTasks)
                .onChange(async (value) => {
                    this.plugin.settings.carryForwardTasks = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Carry forward brain dump items')
            .setDesc('Automatically move brain dump items from yesterday to today')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.carryForwardBrainDumps)
                .onChange(async (value) => {
                    this.plugin.settings.carryForwardBrainDumps = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Timebox template')
            .setDesc('Default template for new TimeBox pages')
            .addTextArea(text => {
                text
                    .setPlaceholder('Enter your template...')
                    .setValue(this.plugin.settings.timeBoxTemplate)
                    .onChange(async (value) => {
                        this.plugin.settings.timeBoxTemplate = value;
                        await this.plugin.saveSettings();
                    });
                text.inputEl.rows = 15;
                text.inputEl.cols = 50;
            });

    }
}
