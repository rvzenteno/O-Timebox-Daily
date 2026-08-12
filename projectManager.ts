import { App, TFile, Notice, Editor, moment } from 'obsidian';

const getMoment = (inp?: unknown, fmt?: unknown, strict?: boolean): moment.Moment => 
    (moment as unknown as (i?: unknown, f?: unknown, s?: boolean) => moment.Moment)(inp, fmt, strict);

export interface ProjectTask {
    text: string;
    rawLine: string;
    completed: boolean;
    lineIndex: number;
    projectFilePath: string;
    projectName: string;
    indentationLevel: number;
    subtasks: ProjectTask[];
    parentTaskLineIndex?: number;
    lineCount: number;
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
    internalModifiedPaths: Set<string> = new Set();

    constructor(app: App) {
        this.app = app;
    }

    markInternalModification(path: string): void {
        this.internalModifiedPaths.add(path);
        setTimeout(() => {
            this.internalModifiedPaths.delete(path);
        }, 1500);
    }

    isInternalModification(path: string): boolean {
        return this.internalModifiedPaths.has(path);
    }

    /**
     * Get all project files located in the designated projects folder.
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
     * Resolve a wiki-link string to a project file.
     */
    resolveProjectFile(linkText: string, projectsFolder: string): TFile | null {
        const projectFiles = this.getProjectFiles(projectsFolder);
        const targetPath = linkText.split('|')[0].trim();
        const cleanedLink = targetPath.replace(/^.*[\\/]/, '').replace(/\.md$/, '').toLowerCase();

        for (const file of projectFiles) {
            if (file.basename.toLowerCase() === cleanedLink || file.path.toLowerCase().endsWith(cleanedLink + '.md')) {
                return file;
            }
        }
        return null;
    }

    /**
     * Parse a project file to extract task items, nested subtasks, and progress data.
     */
    async parseProjectData(file: TFile): Promise<ProjectData> {
        const content = await this.app.vault.read(file);
        const lines = content.split('\n');
        const topLevelTasks: ProjectTask[] = [];

        let completedCount = 0;
        let totalCount = 0;

        let currentTopLevelTask: ProjectTask | null = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed.startsWith('- [ ]') || trimmed.startsWith('- [x]') || trimmed.startsWith('- [X]')) {
                const isCompleted = trimmed.startsWith('- [x]') || trimmed.startsWith('- [X]');
                const text = trimmed.replace(/^-\s*\[[ xX]\]\s*/, '');
                
                const leadingWhitespace = line.match(/^[\s\t]*/)?.[0] || '';
                const indentSpaces = leadingWhitespace.replace(/\t/g, '  ').length;

                totalCount++;
                if (isCompleted) {
                    completedCount++;
                }

                if (indentSpaces === 0 || !currentTopLevelTask) {
                    const task: ProjectTask = {
                        text,
                        rawLine: line,
                        completed: isCompleted,
                        lineIndex: i,
                        projectFilePath: file.path,
                        projectName: file.basename,
                        indentationLevel: indentSpaces,
                        subtasks: [],
                        lineCount: 1
                    };
                    topLevelTasks.push(task);
                    currentTopLevelTask = task;
                } else {
                    const subtask: ProjectTask = {
                        text,
                        rawLine: line,
                        completed: isCompleted,
                        lineIndex: i,
                        projectFilePath: file.path,
                        projectName: file.basename,
                        indentationLevel: indentSpaces,
                        subtasks: [],
                        parentTaskLineIndex: currentTopLevelTask.lineIndex,
                        lineCount: 1
                    };
                    currentTopLevelTask.subtasks.push(subtask);
                    currentTopLevelTask.lineCount++;
                }
            }
        }

        const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

        return {
            file,
            name: file.basename,
            path: file.path,
            tasks: topLevelTasks,
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

        this.markInternalModification(filePath);
        const newFile = await this.app.vault.create(filePath, template);
        new Notice(`Created project note: ${sanitizedName}`);
        return newFile;
    }

    /**
     * Add a task to today's TimeBox file under Tasks section.
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

        const folder = this.app.vault.getAbstractFileByPath(timeBoxFolder);
        if (!folder) {
            await this.app.vault.createFolder(timeBoxFolder);
        }

        const targetFile = this.app.vault.getAbstractFileByPath(todayPath);
        let content = '';

        if (targetFile instanceof TFile) {
            content = await this.app.vault.read(targetFile);
        } else {
            content = `# Timebox - ${today.format('dddd, MMMM Do YYYY')}\n\n## 📋 Tasks\n- [ ] \n`;
        }

        const taskLine = `- [ ] ${taskText} [[${projectFile.basename}]]`;

        if (content.includes(taskText)) {
            return;
        }

        const lines = content.split('\n');
        let insertIndex = -1;

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

        this.markInternalModification(todayPath);
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

        this.markInternalModification(projectFile.path);
        await this.app.vault.modify(projectFile, lines.join('\n'));
        if (showNotice) {
            new Notice(`Added task to ${projectFile.basename}`);
        }
    }

    /**
     * Add a nested subtask under a parent task line in a project note.
     */
    async addSubtaskToProject(projectFile: TFile, parentTaskLineIndex: number, subtaskText: string): Promise<void> {
        const content = await this.app.vault.read(projectFile);
        const lines = content.split('\n');

        if (parentTaskLineIndex < 0 || parentTaskLineIndex >= lines.length) {
            return;
        }

        let insertIndex = parentTaskLineIndex + 1;
        while (insertIndex < lines.length) {
            const line = lines[insertIndex];
            const leadingWhitespace = line.match(/^[\s\t]*/)?.[0] || '';
            const indentSpaces = leadingWhitespace.replace(/\t/g, '  ').length;
            
            if (line.trim().startsWith('- [') && indentSpaces > 0) {
                insertIndex++;
            } else {
                break;
            }
        }

        const subtaskLine = `  - [ ] ${subtaskText}`;
        lines.splice(insertIndex, 0, subtaskLine);

        this.markInternalModification(projectFile.path);
        await this.app.vault.modify(projectFile, lines.join('\n'));
        new Notice(`Added subtask to ${projectFile.basename}`);
    }

    /**
     * Delete a task (and its nested subtasks) from a project note.
     */
    async deleteTaskFromProject(projectFile: TFile, task: ProjectTask): Promise<void> {
        const content = await this.app.vault.read(projectFile);
        const lines = content.split('\n');

        if (task.lineIndex < 0 || task.lineIndex >= lines.length) {
            return;
        }

        lines.splice(task.lineIndex, task.lineCount);

        this.markInternalModification(projectFile.path);
        await this.app.vault.modify(projectFile, lines.join('\n'));
        new Notice(`Deleted task from ${projectFile.basename}`);
    }

    /**
     * Reorder top-level tasks in a project note (Drag and Drop).
     */
    async reorderProjectTasks(projectFile: TFile, sourceIndex: number, targetIndex: number): Promise<void> {
        const projData = await this.parseProjectData(projectFile);
        const tasks = projData.tasks;

        if (
            sourceIndex < 0 ||
            sourceIndex >= tasks.length ||
            targetIndex < 0 ||
            targetIndex >= tasks.length ||
            sourceIndex === targetIndex
        ) {
            return;
        }

        const content = await this.app.vault.read(projectFile);
        const lines = content.split('\n');

        // Extract task blocks (lines array for each top level task and its subtasks)
        const taskBlocks = tasks.map(task => lines.slice(task.lineIndex, task.lineIndex + task.lineCount));

        // Reorder taskBlocks array
        const [movedBlock] = taskBlocks.splice(sourceIndex, 1);
        taskBlocks.splice(targetIndex, 0, movedBlock);

        // Replace task section in lines
        const firstTaskLineIndex = tasks[0].lineIndex;
        const lastTaskEndIndex = tasks[tasks.length - 1].lineIndex + tasks[tasks.length - 1].lineCount;

        const reorderedLines = taskBlocks.flat();
        lines.splice(firstTaskLineIndex, lastTaskEndIndex - firstTaskLineIndex, ...reorderedLines);

        this.markInternalModification(projectFile.path);
        await this.app.vault.modify(projectFile, lines.join('\n'));
    }

    /**
     * Move active task line (and its subtasks) up or down inside an active editor note.
     */
    async moveTaskLineInEditor(editor: Editor, direction: 'up' | 'down'): Promise<void> {
        const cursor = editor.getCursor();
        const totalLines = editor.lineCount();
        const currentLineIndex = cursor.line;

        const fileContent = editor.getValue();
        const lines = fileContent.split('\n');
        
        const currentLine = lines[currentLineIndex];
        if (!currentLine.trim().startsWith('- [')) {
            new Notice('Cursor must be on a task line to move it');
            return;
        }

        // Parse line blocks for current file
        const taskBlocks: { start: number; count: number; lines: string[] }[] = [];
        let i = 0;
        while (i < totalLines) {
            const line = lines[i];
            const trimmed = line.trim();
            if (trimmed.startsWith('- [')) {
                const leadingWhitespace = line.match(/^[\s\t]*/)?.[0] || '';
                const indent = leadingWhitespace.replace(/\t/g, '  ').length;
                if (indent === 0 || taskBlocks.length === 0) {
                    taskBlocks.push({ start: i, count: 1, lines: [line] });
                } else {
                    taskBlocks[taskBlocks.length - 1].count++;
                    taskBlocks[taskBlocks.length - 1].lines.push(line);
                }
            }
            i++;
        }

        const activeBlockIdx = taskBlocks.findIndex(
            b => currentLineIndex >= b.start && currentLineIndex < b.start + b.count
        );

        if (activeBlockIdx === -1) return;

        const targetBlockIdx = direction === 'up' ? activeBlockIdx - 1 : activeBlockIdx + 1;
        if (targetBlockIdx < 0 || targetBlockIdx >= taskBlocks.length) return;

        const activeBlock = taskBlocks[activeBlockIdx];
        const targetBlock = taskBlocks[targetBlockIdx];

        // Swap task blocks in document
        const newLines = [...lines];
        const minStart = Math.min(activeBlock.start, targetBlock.start);
        const maxEnd = Math.max(activeBlock.start + activeBlock.count, targetBlock.start + targetBlock.count);

        const firstBlock = direction === 'up' ? activeBlock : targetBlock;
        const secondBlock = direction === 'up' ? targetBlock : activeBlock;

        const combinedSwapped = [...firstBlock.lines, ...secondBlock.lines];
        newLines.splice(minStart, maxEnd - minStart, ...combinedSwapped);

        editor.setValue(newLines.join('\n'));

        // Restore cursor offset
        const lineOffset = direction === 'up' ? -targetBlock.count : targetBlock.count;
        editor.setCursor({ line: currentLineIndex + lineOffset, ch: cursor.ch });
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

        const baseTaskText = cleanedTaskText.replace(/\[\[[^\]]+\]\]/g, '').trim();

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
                this.markInternalModification(targetFile.path);
                await this.app.vault.modify(targetFile, lines.join('\n'));
            }
        }
    }
}

