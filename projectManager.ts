import { App, TFile, Notice, moment } from 'obsidian';

const getMoment = (inp?: unknown, fmt?: unknown, strict?: boolean): moment.Moment => 
    (moment as unknown as (i?: unknown, f?: unknown, s?: boolean) => moment.Moment)(inp, fmt, strict);

export interface ProjectTask {
    text: string;
    rawLine: string;
    completed: boolean;
    lineIndex: number;
    projectFilePath: string;
    projectName: string;
}

export interface ProjectData {
    file: TFile;
    name: string;
    path: string;
    tasks: ProjectTask[];
    completedCount: number;
    totalCount: number;
    progressPercent: number;
}

export class ProjectManager {
    app: App;

    constructor(app: App) {
        this.app = app;
    }

    /**
     * Get all project files located in the designated projects folder, or tagged with #project.
     */
    getProjectFiles(projectsFolder: string): TFile[] {
        const files: TFile[] = [];
        const vaultFiles = this.app.vault.getFiles();

        const cleanedFolder = projectsFolder.replace(/\/$/, '').toLowerCase();

        for (const file of vaultFiles) {
            if (file.extension !== 'md') continue;

            const inProjectsFolder = file.path.toLowerCase().startsWith(cleanedFolder + '/');

            if (inProjectsFolder) {
                files.push(file);
            }
        }

        return files.sort((a, b) => a.basename.localeCompare(b.basename));
    }

    /**
     * Resolve a wiki-link string (e.g. "MyProject" or "TimeBox/Projects/MyProject") to a project file.
     */
    resolveProjectFile(linkText: string, projectsFolder: string): TFile | null {
        const projectFiles = this.getProjectFiles(projectsFolder);
        const cleanedLink = linkText.replace(/^.*[\\/]/, '').replace(/\.md$/, '').toLowerCase();

        for (const file of projectFiles) {
            if (file.basename.toLowerCase() === cleanedLink || file.path.toLowerCase().endsWith(cleanedLink + '.md')) {
                return file;
            }
        }
        return null;
    }

    /**
     * Parse a project file to extract task items and progress data.
     */
    async parseProjectData(file: TFile): Promise<ProjectData> {
        const content = await this.app.vault.read(file);
        const lines = content.split('\n');
        const tasks: ProjectTask[] = [];

        let completedCount = 0;
        let totalCount = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed.startsWith('- [ ]') || trimmed.startsWith('- [x]') || trimmed.startsWith('- [X]')) {
                const isCompleted = trimmed.startsWith('- [x]') || trimmed.startsWith('- [X]');
                const text = trimmed.replace(/^-\s*\[[ xX]\]\s*/, '');

                tasks.push({
                    text,
                    rawLine: line,
                    completed: isCompleted,
                    lineIndex: i,
                    projectFilePath: file.path,
                    projectName: file.basename
                });

                totalCount++;
                if (isCompleted) {
                    completedCount++;
                }
            }
        }

        const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

        return {
            file,
            name: file.basename,
            path: file.path,
            tasks,
            completedCount,
            totalCount,
            progressPercent
        };
    }

    /**
     * Get parsed data for all projects in vault.
     */
    async getAllProjectsData(projectsFolder: string): Promise<ProjectData[]> {
        const projectFiles = this.getProjectFiles(projectsFolder);
        const projectsData: ProjectData[] = [];

        for (const file of projectFiles) {
            const data = await this.parseProjectData(file);
            projectsData.push(data);
        }

        return projectsData;
    }

    /**
     * Create a new Project Note in the projects folder.
     */
    async createProjectFile(projectName: string, projectsFolder: string): Promise<TFile> {
        // Ensure folder exists
        const folder = this.app.vault.getAbstractFileByPath(projectsFolder);
        if (!folder) {
            await this.app.vault.createFolder(projectsFolder);
        }

        const sanitizedName = projectName.replace(/[\\/:*?"<>|]/g, '-').trim();
        const filePath = `${projectsFolder}/${sanitizedName}.md`;

        const existingFile = this.app.vault.getAbstractFileByPath(filePath);
        if (existingFile instanceof TFile) {
            new Notice(`Project note "${sanitizedName}" already exists`);
            return existingFile;
        }

        const template = `---
type: project
created: ${getMoment().format('YYYY-MM-DD')}
---
# 🌐 Project: ${sanitizedName}

## 📋 Tasks
- [ ] Initial project task

## 📝 Notes
`;

        const newFile = await this.app.vault.create(filePath, template);
        new Notice(`Created project note: ${sanitizedName}`);
        return newFile;
    }

    /**
     * Add a task to today's TimeBox file under Tasks or a Project section.
     */
    async addProjectTaskToToday(
        taskText: string,
        projectFile: TFile,
        timeBoxFolder: string,
        dateFormat: string
    ): Promise<void> {
        const today = getMoment();
        const format = dateFormat || 'YYYY-MM-DD';
        const todayFileName = `${today.format(format)}.md`;
        const todayPath = `${timeBoxFolder}/${todayFileName}`;

        // Ensure timebox folder
        const folder = this.app.vault.getAbstractFileByPath(timeBoxFolder);
        if (!folder) {
            await this.app.vault.createFolder(timeBoxFolder);
        }

        const targetFile = this.app.vault.getAbstractFileByPath(todayPath);
        let content = '';

        if (targetFile instanceof TFile) {
            content = await this.app.vault.read(targetFile);
        } else {
            // Basic fallback template if daily file doesn't exist yet
            content = `# Timebox - ${today.format('dddd, MMMM Do YYYY')}\n\n## 📋 Tasks\n- [ ] \n`;
        }

        const taskLine = `- [ ] ${taskText} [[${projectFile.basename}]]`;

        // Don't add duplicate if already present in today's file
        if (content.includes(taskText)) {
            return;
        }

        const lines = content.split('\n');
        let insertIndex = -1;

        // Try to insert under Tasks heading
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes('tasks') || lines[i].includes('📋')) {
                insertIndex = i + 1;
                while (insertIndex < lines.length && (lines[insertIndex].trim() === '' || lines[insertIndex].trim() === '- [ ]')) {
                    insertIndex++;
                }
                break;
            }
        }

        if (insertIndex !== -1) {
            lines.splice(insertIndex, 0, taskLine);
            content = lines.join('\n');
        } else {
            content += `\n\n## 📋 Tasks\n${taskLine}\n`;
        }

        if (targetFile instanceof TFile) {
            await this.app.vault.modify(targetFile, content);
        } else {
            await this.app.vault.create(todayPath, content);
        }

        new Notice(`Added task to today's TimeBox: "${taskText.substring(0, 30)}..."`);
    }

    /**
     * Add a task to a target project note.
     */
    async addTaskToProject(projectFile: TFile, taskText: string, showNotice = false): Promise<void> {
        const content = await this.app.vault.read(projectFile);
        const taskLine = `- [ ] ${taskText}`;

        if (content.includes(taskText)) {
            return;
        }

        const lines = content.split('\n');
        let insertIndex = -1;

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes('tasks') || lines[i].includes('📋')) {
                insertIndex = i + 1;
                while (insertIndex < lines.length && lines[insertIndex].trim() === '') {
                    insertIndex++;
                }
                break;
            }
        }

        if (insertIndex !== -1) {
            lines.splice(insertIndex, 0, taskLine);
        } else {
            lines.push('\n## 📋 Tasks', taskLine);
        }

        await this.app.vault.modify(projectFile, lines.join('\n'));
        if (showNotice) {
            new Notice(`Added task to ${projectFile.basename}`);
        }
    }

    /**
     * Bi-directional task status sync between daily notes and project notes.
     */
    async syncTaskCompletion(
        sourceFile: TFile,
        cleanedTaskText: string,
        isCompleted: boolean,
        projectsFolder: string,
        timeBoxFolder: string
    ): Promise<void> {
        if (!cleanedTaskText || cleanedTaskText.length < 3) return;

        const isDailyNote = sourceFile.path.startsWith(timeBoxFolder);
        const isProjectFile = this.getProjectFiles(projectsFolder).some(f => f.path === sourceFile.path);

        if (!isDailyNote && !isProjectFile) return;

        // Strip project link brackets from text if present for matching (e.g. "[[ProjectName]]")
        const baseTaskText = cleanedTaskText.replace(/\[\[[^\]]+\]\]/g, '').trim();

        // Targets to sync: if source is daily note, sync project files; if source is project file, sync daily notes
        const targetFiles: TFile[] = [];
        if (isDailyNote) {
            targetFiles.push(...this.getProjectFiles(projectsFolder));
        } else if (isProjectFile) {
            const vaultFiles = this.app.vault.getFiles();
            targetFiles.push(...vaultFiles.filter(f => f.path.startsWith(timeBoxFolder) && f.extension === 'md'));
        }

        for (const targetFile of targetFiles) {
            if (targetFile.path === sourceFile.path) continue;

            const content = await this.app.vault.read(targetFile);
            if (!content.includes(baseTaskText)) continue;

            const lines = content.split('\n');
            let modified = false;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (line.includes(baseTaskText) && (line.includes('- [ ]') || line.includes('- [x]') || line.includes('- [X]'))) {
                    const currentStatus = line.includes('- [x]') || line.includes('- [X]');
                    if (currentStatus !== isCompleted) {
                        lines[i] = isCompleted
                            ? line.replace(/- \[[ ]\]/, '- [x]')
                            : line.replace(/- \[[xX]\]/, '- [ ]');
                        modified = true;
                    }
                }
            }

            if (modified) {
                await this.app.vault.modify(targetFile, lines.join('\n'));
            }
        }
    }
}
