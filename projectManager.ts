import { App, TFile, TFolder, Notice, Editor, moment } from 'obsidian';
import { NormalizedProject, NormalizedTask, ProjectBaseline, ResourceDefinition } from './projectModel';
import { MarkdownAdapter } from './markdownAdapter';
import { SchedulingEngine } from './schedulingEngine';
import { ProjectValidator } from './projectValidator';
import { ResourceEngine } from './resourceEngine';
import { ProjectCalendar } from './projectCalendar';
import { ProjectCommandManager } from './projectCommandManager';

const getMoment = (inp?: unknown, fmt?: unknown, strict?: boolean): moment.Moment => 
    (moment as unknown as (i?: unknown, f?: unknown, s?: boolean) => moment.Moment)(inp, fmt, strict);

export class WorkingCalendar {
    /**
     * Return true if the given date falls on a weekend (Saturday or Sunday).
     */
    static isWeekend(date: string | moment.Moment): boolean {
        const m = typeof date === 'string' ? getMoment(date, 'YYYY-MM-DD') : date;
        const dayOfWeek = m.day();
        return dayOfWeek === 0 || dayOfWeek === 6;
    }

    /**
     * If date falls on a weekend, advance forward to next Monday.
     */
    static snapToWorkingDay(dateStr: string): string {
        let m = getMoment(dateStr, 'YYYY-MM-DD');
        while (WorkingCalendar.isWeekend(m)) {
            m = m.add(1, 'days');
        }
        return m.format('YYYY-MM-DD');
    }

    /**
     * Calculate number of working days (Mon-Fri) between startDate and endDate inclusive.
     */
    static calculateWorkingDays(startDate: string, endDate: string): number {
        if (!startDate || !endDate) return 1;
        const start = getMoment(startDate, 'YYYY-MM-DD');
        const end = getMoment(endDate, 'YYYY-MM-DD');
        if (end.isBefore(start)) return 1;

        let workingDays = 0;
        const current = start.clone();
        while (current.isSameOrBefore(end, 'day')) {
            if (!WorkingCalendar.isWeekend(current)) {
                workingDays++;
            }
            current.add(1, 'days');
        }
        return Math.max(1, workingDays);
    }

    /**
     * Add working days (Mon-Fri) to startDate.
     * 1 working day means it starts and finishes on the same day (if weekday).
     */
    static addWorkingDays(startDate: string, workingDays: number): string {
        let current = getMoment(WorkingCalendar.snapToWorkingDay(startDate), 'YYYY-MM-DD');
        if (workingDays <= 1) {
            return current.format('YYYY-MM-DD');
        }

        let daysAdded = 1;
        while (daysAdded < workingDays) {
            current = current.add(1, 'days');
            if (!WorkingCalendar.isWeekend(current)) {
                daysAdded++;
            }
        }
        return current.format('YYYY-MM-DD');
    }

    /**
     * Get contiguous weekday intervals spanning from startDate to endDate for rendering split bars over weekends.
     */
    static getWorkingIntervals(startDate: string, endDate: string): Array<{ start: string; end: string }> {
        const intervals: Array<{ start: string; end: string }> = [];
        let current = getMoment(startDate, 'YYYY-MM-DD');
        const end = getMoment(endDate, 'YYYY-MM-DD');

        let intervalStart: string | null = null;
        let lastWorkingDate: string | null = null;

        while (current.isSameOrBefore(end, 'day')) {
            const isWk = WorkingCalendar.isWeekend(current);
            const dateStr = current.format('YYYY-MM-DD');

            if (!isWk) {
                if (!intervalStart) {
                    intervalStart = dateStr;
                }
                lastWorkingDate = dateStr;
            } else {
                if (intervalStart && lastWorkingDate) {
                    intervals.push({ start: intervalStart, end: lastWorkingDate });
                    intervalStart = null;
                    lastWorkingDate = null;
                }
            }
            current = current.add(1, 'days');
        }

        if (intervalStart && lastWorkingDate) {
            intervals.push({ start: intervalStart, end: lastWorkingDate });
        }

        return intervals.length > 0 ? intervals : [{ start: startDate, end: endDate }];
    }
}

export interface ProjectTask {
    text: string;
    cleanTitle: string;
    rawLine: string;
    completed: boolean;
    lineIndex: number;
    wbsIndex?: number;
    wbsCode?: string;
    projectFilePath: string;
    projectName: string;
    indentationLevel: number;
    subtasks: ProjectTask[];
    parentTaskLineIndex?: number;
    lineCount: number;
    startDate?: string;
    dueDate?: string;
    durationDays: number;
    isMilestone: boolean;
    resource?: string;
    predecessors: string[];
    isBlocked?: boolean;
    isCritical?: boolean;
    totalFloat?: number;
    freeFloat?: number;
    workHours?: number;
    percentComplete?: number;
    constraintType?: string;
    constraintDate?: string;
    workingIntervals?: Array<{ start: string; end: string }>;
    description?: string;
    baselineStart?: string;
    baselineFinish?: string;
}

export interface ProjectData {
    file: TFile;
    name: string;
    path: string;
    tasks: ProjectTask[];
    completedCount: number;
    totalCount: number;
    progressPercent: number;
    projectStartDate?: string;
    projectDueDate?: string;
    hasProjectTitleTask?: boolean;
    startTaskNumber?: number;
    normalizedProject?: NormalizedProject;
}


export class ProjectManager {
    app: App;
    internalModifiedPaths: Set<string> = new Set();

    constructor(app: App) {
        this.app = app;
    }

    markInternalModification(path: string): void {
        this.internalModifiedPaths.add(path);
        window.setTimeout(() => {
            this.internalModifiedPaths.delete(path);
        }, 1500);
    }

    isInternalModification(path: string): boolean {
        return this.internalModifiedPaths.has(path);
    }

    /**
     * Strip any checklist markdown prefix (including callout quote bars) to prevent '- [ ] - [ ]'.
     */
    static stripTaskCheckbox(text: string): string {
        return MarkdownAdapter.stripTaskCheckbox(text);
    }

    /**
     * Clean presentation boundary: strips PM-specific scheduling tokens from a task string.
     * Preserves task title and Timebox wikilinks (e.g. [[Project]]).
     */
    static stripProjectMetadata(text: string): string {
        return MarkdownAdapter.stripProjectMetadata(text);
    }

    /**
     * Parse start and due dates, duration, milestone flag, resource, predecessors, and clean title.
     */
    parseTaskDates(text: string): {
        startDate?: string;
        dueDate?: string;
        durationDays: number;
        isMilestone: boolean;
        cleanTitle: string;
        resource?: string;
        predecessors: string[];
        description?: string;
    } {
        const startMatch = text.match(/🛫\s*(\d{4}-\d{2}-\d{2})/);
        const dueMatch = text.match(/📅\s*(\d{4}-\d{2}-\d{2})/);
        const durMatch = text.match(/⏳\s*(\d+)d?/);
        const isMilestoneExplicit = /#milestone\b/i.test(text);

        const resourceMatch = text.match(/\[assigned::\s*([^\]]+)\]/i) || text.match(/@([a-zA-Z0-9_\-\.]+)/);
        const resource = resourceMatch ? resourceMatch[1].trim() : undefined;

        const descMatch = text.match(/\[desc::\s*([^\]]+)\]/i) || text.match(/📝\s*([^\n🛫📅⏳@#\[]+)/);
        const description = descMatch ? descMatch[1].trim() : undefined;

        const predMatch = text.match(/dependsOn::\s*#?([0-9a-zA-Z.,_+\-\s#]+)/i) || text.match(/after:\s*#?([0-9a-zA-Z.,_+\-\s#]+)/i);
        const predecessors: string[] = [];
        if (predMatch && predMatch[1]) {
            const items = predMatch[1].split(',').map(s => s.replace(/#/g, '').trim()).filter(s => s.length > 0);
            predecessors.push(...items);
        }

        const startDate = startMatch ? startMatch[1] : undefined;
        let dueDate = dueMatch ? dueMatch[1] : undefined;
        const cleanTitle = ProjectManager.stripProjectMetadata(text);

        let durationDays = 1;
        let isMilestone = isMilestoneExplicit;

        if (durMatch) {
            durationDays = Math.max(1, parseInt(durMatch[1], 10));
            if (startDate && !dueDate) {
                dueDate = WorkingCalendar.addWorkingDays(startDate, durationDays);
            }
        }

        if (startDate && dueDate) {
            durationDays = WorkingCalendar.calculateWorkingDays(startDate, dueDate);
            if (durationDays <= 1 && isMilestoneExplicit) {
                isMilestone = true;
            }
        } else if (dueDate && !startDate) {
            isMilestone = true;
            durationDays = 1;
        } else if (startDate && !dueDate) {
            durationDays = 1;
        } else {
            durationDays = 0;
        }

        return {
            startDate,
            dueDate,
            durationDays,
            isMilestone,
            cleanTitle,
            resource,
            predecessors,
            description
        };
    }

    /**
     * Get all project files located in the designated projects folder.
     */
    getProjectFiles(projectsFolder: string): TFile[] {
        const folder = this.app.vault.getFolderByPath(projectsFolder);
        if (!folder) return [];

        const files: TFile[] = [];
        const collectMarkdownFiles = (targetFolder: TFolder) => {
            for (const child of targetFolder.children) {
                if (child instanceof TFile && child.extension === 'md') {
                    files.push(child);
                } else if (child instanceof TFolder) {
                    collectMarkdownFiles(child);
                }
            }
        };

        collectMarkdownFiles(folder);
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
            const leadingWhitespace = line.match(/^[\s\t]*/)?.[0] || '';
            const indentSpaces = leadingWhitespace.replace(/\t/g, '  ').length;

            if (trimmed.startsWith('- [ ]') || trimmed.startsWith('- [x]') || trimmed.startsWith('- [X]')) {
                const isCompleted = trimmed.startsWith('- [x]') || trimmed.startsWith('- [X]');
                const text = trimmed.replace(/^-\s*\[[ xX]\]\s*/, '');

                totalCount++;
                if (isCompleted) {
                    completedCount++;
                }

                const dateInfo = this.parseTaskDates(text);

                if (indentSpaces === 0 || !currentTopLevelTask) {
                    const task: ProjectTask = {
                        text,
                        cleanTitle: dateInfo.cleanTitle,
                        rawLine: line,
                        completed: isCompleted,
                        lineIndex: i,
                        projectFilePath: file.path,
                        projectName: file.basename,
                        indentationLevel: indentSpaces,
                        subtasks: [],
                        lineCount: 1,
                        startDate: dateInfo.startDate,
                        dueDate: dateInfo.dueDate,
                        durationDays: dateInfo.durationDays,
                        isMilestone: dateInfo.isMilestone,
                        resource: dateInfo.resource,
                        predecessors: dateInfo.predecessors,
                        description: dateInfo.description
                    };
                    topLevelTasks.push(task);
                    currentTopLevelTask = task;
                } else {
                    const subtask: ProjectTask = {
                        text,
                        cleanTitle: dateInfo.cleanTitle,
                        rawLine: line,
                        completed: isCompleted,
                        lineIndex: i,
                        projectFilePath: file.path,
                        projectName: file.basename,
                        indentationLevel: indentSpaces,
                        subtasks: [],
                        parentTaskLineIndex: currentTopLevelTask.lineIndex,
                        lineCount: 1,
                        startDate: dateInfo.startDate,
                        dueDate: dateInfo.dueDate,
                        durationDays: dateInfo.durationDays,
                        isMilestone: dateInfo.isMilestone,
                        resource: dateInfo.resource,
                        predecessors: dateInfo.predecessors,
                        description: dateInfo.description
                    };
                    currentTopLevelTask.subtasks.push(subtask);
                    currentTopLevelTask.lineCount++;
                }
            } else if (currentTopLevelTask && indentSpaces > 0 && !trimmed.startsWith('#') && trimmed.length > 0) {
                const target = currentTopLevelTask.subtasks.length > 0
                    ? currentTopLevelTask.subtasks[currentTopLevelTask.subtasks.length - 1]
                    : currentTopLevelTask;
                target.lineCount++;
                if (!target.description) {
                    target.description = trimmed;
                } else if (!target.description.includes(trimmed)) {
                    target.description += ' ' + trimmed;
                }
            }
        }

        let startTaskNumber = 1;
        if (content.startsWith('---')) {
            const endFm = content.indexOf('\n---', 3);
            if (endFm !== -1) {
                const fmBlock = content.substring(3, endFm);
                const match = fmBlock.match(/startTaskNumber:\s*(\d+)/i) || fmBlock.match(/startTask:\s*(\d+)/i);
                if (match) {
                    startTaskNumber = parseInt(match[1], 10);
                } else if (/projectTitleTask:\s*true/i.test(fmBlock)) {
                    startTaskNumber = 2;
                }
            }
        }
        const cache = this.app.metadataCache.getFileCache(file);
        if (cache?.frontmatter) {
            if (cache.frontmatter['startTaskNumber'] !== undefined) {
                startTaskNumber = Number(cache.frontmatter['startTaskNumber']);
            } else if (cache.frontmatter['projectTitleTask'] === true) {
                startTaskNumber = 2;
            }
        }
        const hasProjectTitleTask = startTaskNumber === 2;

        // Assign WBS numbers and build flattened index for dependency resolution
        const allTasks: ProjectTask[] = [];
        let wbsCounter = 1;
        for (let pIdx = 0; pIdx < topLevelTasks.length; pIdx++) {
            const parent = topLevelTasks[pIdx];
            if (hasProjectTitleTask && pIdx === 0) {
                parent.wbsIndex = 0;
                parent.wbsCode = '0';
                allTasks.push(parent);
                for (let sIdx = 0; sIdx < parent.subtasks.length; sIdx++) {
                    const sub = parent.subtasks[sIdx];
                    sub.wbsIndex = wbsCounter++;
                    sub.wbsCode = `0.${sIdx + 1}`;
                    allTasks.push(sub);
                }
            } else {
                const effectiveTopIndex = hasProjectTitleTask ? pIdx : pIdx + 1;
                parent.wbsIndex = wbsCounter++;
                parent.wbsCode = `${effectiveTopIndex}`;
                allTasks.push(parent);
                for (let sIdx = 0; sIdx < parent.subtasks.length; sIdx++) {
                    const sub = parent.subtasks[sIdx];
                    sub.wbsIndex = wbsCounter++;
                    sub.wbsCode = `${effectiveTopIndex}.${sIdx + 1}`;
                    allTasks.push(sub);
                }
            }
        }

        // Compute blocked status and working intervals
        for (const t of allTasks) {
            if (t.predecessors && t.predecessors.length > 0) {
                t.isBlocked = t.predecessors.some(predCode => {
                    const predTask = allTasks.find(other =>
                        other.wbsCode === predCode ||
                        String(other.wbsIndex) === predCode ||
                        String(other.lineIndex) === predCode
                    );
                    return predTask ? !predTask.completed : false;
                });
            } else {
                t.isBlocked = false;
            }

            if (t.startDate && t.dueDate) {
                t.durationDays = WorkingCalendar.calculateWorkingDays(t.startDate, t.dueDate);
                t.workingIntervals = WorkingCalendar.getWorkingIntervals(t.startDate, t.dueDate);
            }
        }

        // Calculate summary spans for parent tasks with subtasks
        for (const parent of topLevelTasks) {
            if (parent.subtasks.length > 0) {
                let minStart: string | undefined = parent.startDate;
                let maxDue: string | undefined = parent.dueDate;

                for (const sub of parent.subtasks) {
                    const subStart = sub.startDate || sub.dueDate;
                    const subDue = sub.dueDate || sub.startDate;

                    if (subStart) {
                        if (!minStart || subStart < minStart) {
                            minStart = subStart;
                        }
                    }
                    if (subDue) {
                        if (!maxDue || subDue > maxDue) {
                            maxDue = subDue;
                        }
                    }
                }

                if (minStart) parent.startDate = minStart;
                if (maxDue) parent.dueDate = maxDue;

                if (parent.startDate && parent.dueDate) {
                    parent.durationDays = WorkingCalendar.calculateWorkingDays(parent.startDate, parent.dueDate);
                    parent.workingIntervals = WorkingCalendar.getWorkingIntervals(parent.startDate, parent.dueDate);
                }
            }
        }

        // Calculate overall project boundaries
        let projectStartDate: string | undefined;
        let projectDueDate: string | undefined;

        const taskListForDates = hasProjectTitleTask && topLevelTasks.length > 1 ? topLevelTasks.slice(1) : topLevelTasks;
        for (const task of taskListForDates) {
            const s = task.startDate || task.dueDate;
            const d = task.dueDate || task.startDate;
            if (s && (!projectStartDate || s < projectStartDate)) {
                projectStartDate = s;
            }
            if (d && (!projectDueDate || d > projectDueDate)) {
                projectDueDate = d;
            }
        }

        // If topLevelTasks[0] is the Project Title and has no dates or we want it to span the project:
        if (hasProjectTitleTask && topLevelTasks.length > 0) {
            const titleTask = topLevelTasks[0];
            if (!titleTask.startDate && projectStartDate) {
                titleTask.startDate = projectStartDate;
            }
            if (!titleTask.dueDate && projectDueDate) {
                titleTask.dueDate = projectDueDate;
            }
            if (titleTask.startDate && titleTask.dueDate) {
                titleTask.durationDays = WorkingCalendar.calculateWorkingDays(titleTask.startDate, titleTask.dueDate);
                titleTask.workingIntervals = WorkingCalendar.getWorkingIntervals(titleTask.startDate, titleTask.dueDate);
            }
            totalCount = Math.max(0, totalCount - 1);
            if (titleTask.completed) {
                completedCount = Math.max(0, completedCount - 1);
            }
        }

        // Integrate CPM Normalized Scheduling Engine
        let normalizedProject: NormalizedProject | undefined;
        try {
            const parsedNorm = MarkdownAdapter.parseProject(file.path, file.basename, content);
            normalizedProject = SchedulingEngine.schedule(parsedNorm);
            normalizedProject.validationIssues = ProjectValidator.validate(normalizedProject);

            // Sync CPM calculated fields onto ProjectTasks
            const syncTaskWithNormalized = (pt: ProjectTask) => {
                const nt = normalizedProject?.tasks.find(t => t.lineIndex === pt.lineIndex);
                if (nt) {
                    if (nt.calculatedStart) pt.startDate = nt.calculatedStart;
                    if (nt.calculatedFinish) pt.dueDate = nt.calculatedFinish;
                    if (nt.durationDays !== undefined) pt.durationDays = nt.durationDays;
                    pt.isCritical = nt.isCritical;
                    pt.totalFloat = nt.totalFloat;
                    pt.freeFloat = nt.freeFloat;
                    pt.workHours = nt.workHours;
                    pt.percentComplete = nt.percentComplete;
                    pt.isBlocked = nt.isBlocked;
                    if (nt.workingIntervals && nt.workingIntervals.length > 0) {
                        pt.workingIntervals = nt.workingIntervals;
                    }
                    pt.constraintType = nt.constraintType;
                    pt.constraintDate = nt.constraintDate;
                    if (nt.baseline) {
                        pt.baselineStart = nt.baseline.start;
                        pt.baselineFinish = nt.baseline.finish;
                    }
                }
                for (const sub of pt.subtasks) {
                    syncTaskWithNormalized(sub);
                }
            };

            for (const top of topLevelTasks) {
                syncTaskWithNormalized(top);
            }

            if (normalizedProject.projectStartDate) {
                projectStartDate = normalizedProject.projectStartDate;
            }
            if (normalizedProject.projectFinishDate) {
                projectDueDate = normalizedProject.projectFinishDate;
            }
        } catch (e) {
            console.warn('[TimeBox] Error executing normalized scheduling engine:', e);
        }

        const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

        return {
            file,
            name: file.basename,
            path: file.path,
            tasks: topLevelTasks,
            completedCount,
            totalCount,
            progressPercent,
            projectStartDate,
            projectDueDate,
            hasProjectTitleTask,
            startTaskNumber,
            normalizedProject
        };
    }

    /**
     * Save a baseline snapshot into project frontmatter. Supports Baseline 0 through 10.
     */
    async saveProjectBaseline(projectFile: TFile, baselineId: string = '0', baselineName?: string): Promise<void> {
        const content = await this.app.vault.read(projectFile);
        const normalized = MarkdownAdapter.parseProject(projectFile.path, projectFile.basename, content);
        const scheduled = SchedulingEngine.schedule(normalized);
        const updated = SchedulingEngine.saveBaseline(scheduled, baselineId, baselineName);

        await this.app.fileManager.processFrontMatter(projectFile, (frontmatter) => {
            if (!frontmatter['baselines']) frontmatter['baselines'] = {};
            frontmatter['baselines'][baselineId] = updated.baselines[baselineId];
            frontmatter['activeBaselineId'] = baselineId;
        });
        this.markInternalModification(projectFile.path);
    }

    /**
     * Change the active baseline comparison in project frontmatter.
     */
    async setActiveBaseline(projectFile: TFile, baselineId?: string): Promise<void> {
        await this.app.fileManager.processFrontMatter(projectFile, (frontmatter) => {
            if (baselineId) {
                frontmatter['activeBaselineId'] = baselineId;
            } else {
                delete frontmatter['activeBaselineId'];
            }
        });
        this.markInternalModification(projectFile.path);
    }

    /**
     * Delete a baseline snapshot from project frontmatter.
     */
    async deleteProjectBaseline(projectFile: TFile, baselineId: string): Promise<void> {
        await this.app.fileManager.processFrontMatter(projectFile, (frontmatter) => {
            if (frontmatter['baselines'] && frontmatter['baselines'][baselineId]) {
                delete frontmatter['baselines'][baselineId];
            }
            if (frontmatter['activeBaselineId'] === baselineId) {
                const remaining = Object.keys(frontmatter['baselines'] || {});
                if (remaining.length > 0) {
                    frontmatter['activeBaselineId'] = remaining[0];
                } else {
                    delete frontmatter['activeBaselineId'];
                }
            }
        });
        this.markInternalModification(projectFile.path);
    }

    /**
     * Clear all baselines from project frontmatter.
     */
    async clearAllBaselines(projectFile: TFile): Promise<void> {
        await this.app.fileManager.processFrontMatter(projectFile, (frontmatter) => {
            delete frontmatter['baselines'];
            delete frontmatter['activeBaselineId'];
        });
        this.markInternalModification(projectFile.path);
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
        dateFormat: string,
        showNotice = true
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

        const cleanTask = ProjectManager.stripProjectMetadata(taskText);
        if (!cleanTask) return;

        const taskLine = `- [ ] ${cleanTask} [[${projectFile.basename}]]`;

        // Check if content already contains this clean task
        const lines = content.split('\n');
        const cleanCompare = cleanTask.toLowerCase();
        const alreadyInToday = lines.some(l => {
            const cleanL = ProjectManager.stripProjectMetadata(l).replace(/\[\[[^\]]+\]\]/g, '').trim().toLowerCase();
            return cleanL.length > 2 && cleanL === cleanCompare;
        });

        if (alreadyInToday) {
            if (showNotice) {
                new Notice(`Task already in today's TimeBox: "${cleanTask.substring(0, 30)}..."`);
            }
            return;
        }

        let insertIndex = -1;
        let isCallout = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.toLowerCase().includes('tasks') || line.includes('📋')) {
                insertIndex = i + 1;
                if (line.includes('> [!')) {
                    isCallout = true;
                }
                while (
                    insertIndex < lines.length &&
                    (lines[insertIndex].trim() === '' ||
                        lines[insertIndex].trim() === '- [ ]' ||
                        lines[insertIndex].trim() === '> - [ ]' ||
                        lines[insertIndex].trim() === '- [ ] ' ||
                        lines[insertIndex].trim() === '> - [ ] ')
                ) {
                    insertIndex++;
                }
                break;
            }
        }

        const formattedTaskLine = isCallout ? `> ${taskLine}` : taskLine;

        if (insertIndex !== -1) {
            lines.splice(insertIndex, 0, formattedTaskLine);
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

        if (showNotice) {
            new Notice(`Added task to today's TimeBox: "${cleanTask.substring(0, 30)}..."`);
        }
    }

    /**
     * Add a task to a target project note.
     * Enforces deduplication and prevents '- [ ] - [ ]'.
     */
    async addTaskToProject(projectFile: TFile, taskText: string, showNotice = false): Promise<void> {
        const content = await this.app.vault.read(projectFile);
        const cleanTask = ProjectManager.stripTaskCheckbox(taskText);
        if (!cleanTask) return;
        const taskLine = `- [ ] ${cleanTask}`;

        const lines = content.split('\n');
        const cleanNewTask = ProjectManager.stripProjectMetadata(taskText).replace(/\[\[[^\]]+\]\]/g, '').trim().toLowerCase();
        const alreadyExists = lines.some(line => {
            const cleanExisting = ProjectManager.stripProjectMetadata(line).replace(/\[\[[^\]]+\]\]/g, '').trim().toLowerCase();
            return cleanExisting.length > 2 && cleanExisting === cleanNewTask;
        });

        if (alreadyExists) {
            return;
        }

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

        const cleanSub = ProjectManager.stripTaskCheckbox(subtaskText);
        if (!cleanSub) return;

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

        const subtaskLine = `  - [ ] ${cleanSub}`;
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
     * Add or update a resource definition in project note frontmatter.
     */
    async saveResource(projectFile: TFile, resource: ResourceDefinition): Promise<void> {
        await this.app.fileManager.processFrontMatter(projectFile, (frontmatter) => {
            if (!Array.isArray(frontmatter['resources'])) {
                frontmatter['resources'] = [];
            }
            const resList = frontmatter['resources'];
            const existingIdx = resList.findIndex((r: any) => 
                (r.id && r.id.toLowerCase() === resource.id.toLowerCase()) || 
                (r.name && r.name.toLowerCase() === resource.name.toLowerCase())
            );

            const resRecord: any = {
                id: resource.id,
                name: resource.name,
                type: resource.type || 'Work',
                maxUnits: resource.maxUnits !== undefined ? resource.maxUnits : 1.0,
                workingHoursPerDay: resource.workingHoursPerDay || 8,
                ratePerHour: resource.ratePerHour || 0
            };
            if (resource.costPerUse !== undefined) resRecord.costPerUse = resource.costPerUse;
            if (resource.calendarId) resRecord.calendarId = resource.calendarId;
            if (resource.notes) resRecord.notes = resource.notes;

            if (existingIdx >= 0) {
                resList[existingIdx] = resRecord;
            } else {
                resList.push(resRecord);
            }
        });
        this.markInternalModification(projectFile.path);
    }

    /**
     * Delete a resource definition from project note frontmatter.
     */
    async deleteResource(projectFile: TFile, resourceId: string): Promise<void> {
        await this.app.fileManager.processFrontMatter(projectFile, (frontmatter) => {
            if (Array.isArray(frontmatter['resources'])) {
                const targetKey = resourceId.toLowerCase();
                frontmatter['resources'] = frontmatter['resources'].filter((r: any) => 
                    (r.id && r.id.toLowerCase() !== targetKey) && 
                    (r.name && r.name.toLowerCase() !== targetKey)
                );
            }
        });
        this.markInternalModification(projectFile.path);
    }

    /**
     * Assign a resource to a task line in a project file.
     */
    async assignResourceToTask(projectFile: TFile, taskLineIndex: number, resourceName: string, units: number = 1.0): Promise<void> {
        const content = await this.app.vault.read(projectFile);
        const lines = content.split('\n');
        if (taskLineIndex < 0 || taskLineIndex >= lines.length) return;

        let line = lines[taskLineIndex];
        const cleanRes = resourceName.replace(/^@/, '').trim();
        const tag = units === 1.0 ? `@${cleanRes}` : `[assigned:: @${cleanRes}:${Math.round(units * 100)}%]`;

        if (!line.toLowerCase().includes(`@${cleanRes.toLowerCase()}`)) {
            lines[taskLineIndex] = `${line.trimEnd()} ${tag}`;
            this.markInternalModification(projectFile.path);
            await this.app.vault.modify(projectFile, lines.join('\n'));
        }
    }

    /**
     * Toggle or set completion of a task in a project note.
     */
    async toggleProjectTaskCompletion(projectFile: TFile, lineIndex: number, completed?: boolean): Promise<void> {
        const content = await this.app.vault.read(projectFile);
        const lines = content.split('\n');

        if (lineIndex < 0 || lineIndex >= lines.length) return;

        let line = lines[lineIndex];
        const isCurrentlyCompleted = line.includes('- [x]') || line.includes('- [X]');
        const newStatus = completed !== undefined ? completed : !isCurrentlyCompleted;

        if (newStatus) {
            line = line.replace(/- \[[ ]\]/, '- [x]');
        } else {
            line = line.replace(/- \[[xX]\]/, '- [ ]');
        }

        lines[lineIndex] = line;

        this.markInternalModification(projectFile.path);
        await this.app.vault.modify(projectFile, lines.join('\n'));
    }

    /**
     * Update start and/or due dates for a task line in a project file.
     */
    async updateTaskDatesInFile(
        projectFile: TFile,
        lineIndex: number,
        newStartDate?: string,
        newDueDate?: string
    ): Promise<void> {
        const content = await this.app.vault.read(projectFile);
        const lines = content.split('\n');

        if (lineIndex < 0 || lineIndex >= lines.length) return;

        let line = lines[lineIndex];
        if (!line.trim().startsWith('- [')) return;

        // Clean existing 🛫 and 📅 tokens
        line = line
            .replace(/🛫\s*\d{4}-\d{2}-\d{2}/g, '')
            .replace(/📅\s*\d{4}-\d{2}-\d{2}/g, '')
            .replace(/\s+/g, ' ')
            .trimEnd();

        const dateTokens: string[] = [];
        if (newStartDate) {
            dateTokens.push(`🛫 ${newStartDate}`);
        }
        if (newDueDate) {
            dateTokens.push(`📅 ${newDueDate}`);
        }

        if (dateTokens.length > 0) {
            line = `${line} ${dateTokens.join(' ')}`;
        }

        lines[lineIndex] = line;

        this.markInternalModification(projectFile.path);
        await this.app.vault.modify(projectFile, lines.join('\n'));
    }

    /**
     * Set starting task designation (Task #1 or Task #2 when Task #1 is Project Title) in frontmatter.
     */
    async setProjectStartTask(projectFile: TFile, startTaskNumber: number): Promise<void> {
        await this.app.fileManager.processFrontMatter(projectFile, (frontmatter) => {
            frontmatter['startTaskNumber'] = startTaskNumber;
            if (startTaskNumber === 2) {
                frontmatter['projectTitleTask'] = true;
            } else {
                delete frontmatter['projectTitleTask'];
            }
        });
        this.markInternalModification(projectFile.path);
    }

    /**
     * Update general project settings in note frontmatter.
     */
    async saveProjectSettings(
        projectFile: TFile,
        settings: {
            title?: string;
            projectStartDate?: string;
            deadline?: string;
            scheduleMode?: 'forward' | 'backward';
            startTaskNumber?: number;
            activeCalendarId?: string;
        }
    ): Promise<void> {
        await this.app.fileManager.processFrontMatter(projectFile, (frontmatter) => {
            if (settings.title !== undefined) frontmatter['title'] = settings.title;
            if (settings.projectStartDate !== undefined) frontmatter['projectStartDate'] = settings.projectStartDate;
            if (settings.deadline !== undefined) {
                if (settings.deadline) {
                    frontmatter['deadline'] = settings.deadline;
                } else {
                    delete frontmatter['deadline'];
                }
            }
            if (settings.scheduleMode !== undefined) frontmatter['scheduleMode'] = settings.scheduleMode;
            if (settings.startTaskNumber !== undefined) {
                frontmatter['startTaskNumber'] = settings.startTaskNumber;
                if (settings.startTaskNumber === 2) {
                    frontmatter['projectTitleTask'] = true;
                } else {
                    delete frontmatter['projectTitleTask'];
                }
            }
            if (settings.activeCalendarId !== undefined) {
                frontmatter['activeCalendarId'] = settings.activeCalendarId;
            }
        });
        this.markInternalModification(projectFile.path);
    }

    /**
     * Save calendars list to project frontmatter.
     */
    async saveCalendars(projectFile: TFile, calendars: any[], activeCalendarId?: string): Promise<void> {
        await this.app.fileManager.processFrontMatter(projectFile, (frontmatter) => {
            frontmatter['calendars'] = calendars;
            if (activeCalendarId) {
                frontmatter['activeCalendarId'] = activeCalendarId;
            }
        });
        this.markInternalModification(projectFile.path);
    }

    /**
     * Add or update a calendar definition in project frontmatter.
     */
    async saveCalendar(projectFile: TFile, calendar: any, makeActive: boolean = false): Promise<void> {
        await this.app.fileManager.processFrontMatter(projectFile, (frontmatter) => {
            if (!Array.isArray(frontmatter['calendars'])) {
                frontmatter['calendars'] = [ProjectCalendar.createStandardCalendar().toDefinition()];
            }
            const list = frontmatter['calendars'];
            const idx = list.findIndex((c: any) => c.id === calendar.id);
            if (idx >= 0) {
                list[idx] = calendar;
            } else {
                list.push(calendar);
            }
            if (makeActive) {
                frontmatter['activeCalendarId'] = calendar.id;
            }
        });
        this.markInternalModification(projectFile.path);
    }

    /**
     * Delete a calendar from project frontmatter.
     */
    async deleteCalendar(projectFile: TFile, calendarId: string): Promise<void> {
        await this.app.fileManager.processFrontMatter(projectFile, (frontmatter) => {
            if (Array.isArray(frontmatter['calendars'])) {
                frontmatter['calendars'] = frontmatter['calendars'].filter((c: any) => c.id !== calendarId);
            }
            if (frontmatter['activeCalendarId'] === calendarId) {
                frontmatter['activeCalendarId'] = 'standard';
            }
        });
        this.markInternalModification(projectFile.path);
    }

    /**
     * Update full task details (title, dates, duration, resource, predecessors, milestone) in project file.
     */
    async updateTaskDetails(
        projectFile: TFile,
        lineIndex: number,
        updates: {
            title?: string;
            description?: string;
            startDate?: string;
            dueDate?: string;
            durationDays?: number;
            resource?: string;
            predecessors?: string[];
            isMilestone?: boolean;
            completed?: boolean;
        }
    ): Promise<void> {
        const content = await this.app.vault.read(projectFile);
        const lines = content.split('\n');

        if (lineIndex < 0 || lineIndex >= lines.length) return;

        let line = lines[lineIndex];
        if (!line.trim().startsWith('- [')) return;

        const leadingWhitespace = line.match(/^[\s\t]*/)?.[0] || '';
        let checkbox = line.includes('- [x]') || line.includes('- [X]') ? '- [x]' : '- [ ]';
        if (updates.completed !== undefined) {
            checkbox = updates.completed ? '- [x]' : '- [ ]';
        }

        const currentParsed = this.parseTaskDates(line);
        const rawTitle = updates.title !== undefined ? updates.title.trim() : currentParsed.cleanTitle;
        const title = rawTitle.replace(/^(\s*-\s*\[[ xX]\]\s*)+/g, '').trim();
        const description = updates.description !== undefined ? updates.description.trim() : currentParsed.description;
        let startDate = updates.startDate !== undefined ? updates.startDate : currentParsed.startDate;
        let dueDate = updates.dueDate !== undefined ? updates.dueDate : currentParsed.dueDate;
        let duration = updates.durationDays !== undefined ? updates.durationDays : currentParsed.durationDays;
        const resource = updates.resource !== undefined ? updates.resource.trim() : currentParsed.resource;
        const predecessors = updates.predecessors !== undefined ? updates.predecessors : currentParsed.predecessors;
        const isMilestone = updates.isMilestone !== undefined ? updates.isMilestone : currentParsed.isMilestone;

        if (startDate) {
            startDate = WorkingCalendar.snapToWorkingDay(startDate);
        }

        if (updates.durationDays !== undefined && startDate && updates.dueDate === undefined) {
            dueDate = WorkingCalendar.addWorkingDays(startDate, duration);
        } else if (startDate && dueDate) {
            duration = WorkingCalendar.calculateWorkingDays(startDate, dueDate);
        }

        const tokens: string[] = [];
        if (startDate) tokens.push(`🛫 ${startDate}`);
        if (dueDate) tokens.push(`📅 ${dueDate}`);
        if (duration > 1 && !isMilestone) tokens.push(`⏳ ${duration}d`);
        if (resource) tokens.push(`@${resource.replace(/^@/, '')}`);
        if (predecessors && predecessors.length > 0) tokens.push(`dependsOn:: ${predecessors.join(', ')}`);
        if (description) tokens.push(`[desc:: ${description}]`);
        if (isMilestone) tokens.push(`#milestone`);

        const tokenStr = tokens.length > 0 ? ` ${tokens.join(' ')}` : '';
        lines[lineIndex] = `${leadingWhitespace}${checkbox} ${title}${tokenStr}`;

        this.markInternalModification(projectFile.path);
        await this.app.vault.modify(projectFile, lines.join('\n'));
    }

    /**
     * Indent task line in project file to become a subtask.
     */
    async indentTask(projectFile: TFile, lineIndex: number): Promise<void> {
        const content = await this.app.vault.read(projectFile);
        const lines = content.split('\n');
        if (lineIndex < 0 || lineIndex >= lines.length) return;

        lines[lineIndex] = `  ${lines[lineIndex]}`;
        this.markInternalModification(projectFile.path);
        await this.app.vault.modify(projectFile, lines.join('\n'));
    }

    /**
     * Outdent task line in project file.
     */
    async outdentTask(projectFile: TFile, lineIndex: number): Promise<void> {
        const content = await this.app.vault.read(projectFile);
        const lines = content.split('\n');
        if (lineIndex < 0 || lineIndex >= lines.length) return;

        lines[lineIndex] = lines[lineIndex].replace(/^( {1,2}|\t)/, '');
        this.markInternalModification(projectFile.path);
        await this.app.vault.modify(projectFile, lines.join('\n'));
    }

    /**
     * Insert a new task line in project file after the specified line index.
     */
    async insertTaskAt(
        projectFile: TFile,
        afterLineIndex: number,
        title: string,
        startDate?: string,
        dueDate?: string,
        durationDays?: number,
        resource?: string,
        isSubtask = false,
        description?: string,
        predecessors?: string[]
    ): Promise<number> {
        const content = await this.app.vault.read(projectFile);
        const lines = content.split('\n');

        const indent = isSubtask ? '  ' : '';
        const tokens: string[] = [];
        if (startDate) tokens.push(`🛫 ${startDate}`);
        if (dueDate) tokens.push(`📅 ${dueDate}`);
        if (durationDays && durationDays > 1) tokens.push(`⏳ ${durationDays}d`);
        if (resource) tokens.push(`@${resource.replace(/^@/, '')}`);
        if (predecessors && predecessors.length > 0) tokens.push(`dependsOn:: ${predecessors.join(', ')}`);
        if (description) tokens.push(`[desc:: ${description.trim()}]`);

        const tokenStr = tokens.length > 0 ? ` ${tokens.join(' ')}` : '';
        const sanitizedTitle = title.replace(/^(\s*-\s*\[[ xX]\]\s*)+/g, '').trim();
        const taskLine = `${indent}- [ ] ${sanitizedTitle}${tokenStr}`;

        const insertIndex = Math.min(lines.length, Math.max(0, afterLineIndex + 1));
        lines.splice(insertIndex, 0, taskLine);

        this.markInternalModification(projectFile.path);
        await this.app.vault.modify(projectFile, lines.join('\n'));
        return insertIndex;
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
        const taskBlocks: string[][] = tasks.map(task => lines.slice(task.lineIndex, task.lineIndex + task.lineCount));

        // Reorder taskBlocks array
        const [movedBlock] = taskBlocks.splice(sourceIndex, 1);
        taskBlocks.splice(targetIndex, 0, movedBlock);

        // Replace task section in lines
        const firstTaskLineIndex = tasks[0].lineIndex;
        const lastTaskEndIndex = tasks[tasks.length - 1].lineIndex + tasks[tasks.length - 1].lineCount;

        const reorderedLines: string[] = [];
        for (const block of taskBlocks) {
            reorderedLines.push(...block);
        }
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
        interface EditorTaskBlock { start: number; count: number; lines: string[]; }
        const taskBlocks: EditorTaskBlock[] = [];
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

        const cleanSource = ProjectManager.stripProjectMetadata(cleanedTaskText).replace(/\[\[[^\]]+\]\]/g, '').trim().toLowerCase();
        if (cleanSource.length < 2) return;

        const targetFiles: TFile[] = [];
        if (isDailyNote) {
            targetFiles.push(...this.getProjectFiles(projectsFolder));
        } else if (isProjectFile) {
            const timeFolder = this.app.vault.getFolderByPath(timeBoxFolder);
            if (timeFolder instanceof TFolder) {
                const collectTimeboxFiles = (targetFolder: TFolder) => {
                    for (const child of targetFolder.children) {
                        if (child instanceof TFile && child.extension === 'md') {
                            targetFiles.push(child);
                        } else if (child instanceof TFolder) {
                            collectTimeboxFiles(child);
                        }
                    }
                };
                collectTimeboxFiles(timeFolder);
            }
        }

        for (const targetFile of targetFiles) {
            if (targetFile.path === sourceFile.path) continue;

            const content = await this.app.vault.read(targetFile);
            const lines = content.split('\n');
            let modified = false;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (line.includes('- [ ]') || line.includes('- [x]') || line.includes('- [X]')) {
                    const cleanTarget = ProjectManager.stripProjectMetadata(line).replace(/\[\[[^\]]+\]\]/g, '').trim().toLowerCase();
                    if (cleanTarget === cleanSource) {
                        const currentStatus = line.includes('- [x]') || line.includes('- [X]');
                        if (currentStatus !== isCompleted) {
                            lines[i] = isCompleted
                                ? line.replace(/- \[[ ]\]/, '- [x]')
                                : line.replace(/- \[[xX]\]/, '- [ ]');
                            modified = true;
                        }
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

