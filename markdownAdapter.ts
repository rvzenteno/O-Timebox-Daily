import {
    NormalizedProject,
    NormalizedTask,
    TaskDependency,
    DependencyType,
    ConstraintType,
    ResourceAssignment,
    CalendarDefinition,
    CalendarException,
    ProjectBaseline,
    ResourceDefinition
} from './projectModel';
import { ProjectCalendar } from './projectCalendar';

export class MarkdownAdapter {
    /**
     * Strip any checklist markdown prefix (including callout quote bars) to prevent '- [ ] - [ ]'.
     */
    static stripTaskCheckbox(text: string): string {
        if (!text) return '';
        return text.replace(/^(\s*(?:>\s*)?-\s*\[[ xX]\]\s*)+/g, '').trim();
    }

    /**
     * Clean presentation boundary: strips PM-specific scheduling tokens from a task string.
     * Preserves task title and Timebox wikilinks (e.g. [[Project]]).
     */
    static stripProjectMetadata(text: string): string {
        if (!text) return '';
        return text
            .replace(/^(\s*(?:>\s*)?-\s*\[[ xX]\]\s*)+/g, '') // remove checkboxes
            .replace(/🛫\s*\d{4}-\d{2}-\d{2}/g, '')            // Start date
            .replace(/📅\s*\d{4}-\d{2}-\d{2}/g, '')            // Due/Finish date
            .replace(/⏳\s*\d+d?/g, '')                        // Duration
            .replace(/dependsOn::\s*#?[0-9a-zA-Z.,_+\-\s#]+/gi, '') // Dependencies
            .replace(/after:\s*#?[0-9a-zA-Z.,_+\-\s#]+/gi, '')      // After predecessor
            .replace(/\[assigned::\s*[^\]]+\]/gi, '')               // Resource assignment bracket
            .replace(/(^|\s)@[a-zA-Z0-9_\-\.]+(\(\d+%\))?/g, '$1')  // Inline resource @name or @name(100%)
            .replace(/\[desc::\s*[^\]]+\]/gi, '')                   // Description bracket
            .replace(/📝\s*[^\n🛫📅⏳@#\[]+/g, '')                 // Description memo
            .replace(/\[priority::\s*[^\]]+\]/gi, '')               // Priority bracket
            .replace(/\[costCode::\s*[^\]]+\]/gi, '')               // Cost code bracket
            .replace(/\[constraint::\s*[^\]]+\]/gi, '')             // Constraint bracket
            .replace(/\[deadline::\s*[^\]]+\]/gi, '')               // Deadline bracket
            .replace(/\[%::\s*[^\]]+\]/gi, '')                      // Progress bracket
            .replace(/#milestone\b/gi, '')                          // Milestone tag
            .replace(/<!--[\s\S]*?-->/g, '')                        // HTML comments
            .replace(/^(\s*(?:>\s*)?-\s*\[[ xX]\]\s*)+/g, '')      // second pass on checkboxes
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Parse raw markdown file content into a NormalizedProject model.
     * Backwards-compatible with legacy Timebox task tokens.
     */
    static parseProject(
        filePath: string,
        fileName: string,
        content: string
    ): NormalizedProject {
        const lines = content.split('\n');

        // 1. Parse Frontmatter metadata
        const { frontmatter, bodyStartIndex } = this.parseFrontmatter(content, lines);

        const startTaskNumber = Number(frontmatter['startTaskNumber']) || (frontmatter['projectTitleTask'] ? 2 : 1);
        const projectDeadline = typeof frontmatter['deadline'] === 'string' ? frontmatter['deadline'] : undefined;
        const schedulingDirection = frontmatter['scheduleMode'] === 'backward' ? 'backward' : 'forward';

        // Calendars
        const rawCalendars = Array.isArray(frontmatter['calendars']) && frontmatter['calendars'].length > 0
            ? frontmatter['calendars']
            : [ProjectCalendar.createStandardCalendar().toDefinition()];

        const calendars: CalendarDefinition[] = rawCalendars.map((c: any) => {
            let workingDays: number[] = [1, 2, 3, 4, 5];
            if (Array.isArray(c.workingDays)) {
                workingDays = c.workingDays.map(Number).filter((n: number) => !isNaN(n));
            } else if (typeof c.workingDays === 'string') {
                workingDays = c.workingDays.replace(/[\[\]]/g, '').split(',').map((s: string) => parseInt(s.trim(), 10)).filter((n: number) => !isNaN(n));
            }
            let holidays: string[] = [];
            if (Array.isArray(c.holidays)) {
                holidays = c.holidays.map(String);
            } else if (typeof c.holidays === 'string') {
                holidays = c.holidays.replace(/[\[\]'"]/g, '').split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
            }
            let exceptions: CalendarException[] = [];
            if (Array.isArray(c.exceptions)) {
                exceptions = c.exceptions.map((ex: any) => ({
                    date: String(ex.date),
                    isWorking: Boolean(ex.isWorking),
                    name: ex.name ? String(ex.name) : undefined
                }));
            }
            const hours = typeof c.hoursPerDay === 'number' ? c.hoursPerDay : (parseFloat(c.hoursPerDay) || 8);
            return {
                id: String(c.id || 'standard'),
                name: String(c.name || 'Standard'),
                workingDays,
                hoursPerDay: isNaN(hours) ? 8 : hours,
                holidays,
                exceptions
            };
        });

        const activeCalendarId = frontmatter['activeCalendarId'] || calendars[0].id;

        // Resources
        const resources: ResourceDefinition[] = Array.isArray(frontmatter['resources'])
            ? frontmatter['resources'].map((r: any) => {
                let maxUnits = 1.0;
                if (typeof r.maxUnits === 'number') {
                    maxUnits = r.maxUnits;
                } else if (typeof r.maxUnits === 'string') {
                    maxUnits = r.maxUnits.includes('%') ? parseFloat(r.maxUnits) / 100 : parseFloat(r.maxUnits) || 1.0;
                }
                const workingHours = typeof r.workingHoursPerDay === 'number' ? r.workingHoursPerDay : (parseFloat(r.workingHoursPerDay) || 8);
                const rate = typeof r.ratePerHour === 'number' ? r.ratePerHour : (parseFloat(r.ratePerHour) || 0);
                const costPerUse = typeof r.costPerUse === 'number' ? r.costPerUse : (parseFloat(r.costPerUse) || 0);
                return {
                    id: String(r.id || r.name || '').toLowerCase().replace(/[^a-z0-9_\-]/g, '-'),
                    name: String(r.name || r.id || 'Resource'),
                    type: (r.type === 'Material' || r.type === 'Cost') ? r.type : 'Work',
                    maxUnits: isNaN(maxUnits) ? 1.0 : maxUnits,
                    workingHoursPerDay: isNaN(workingHours) ? 8 : workingHours,
                    ratePerHour: isNaN(rate) ? 0 : rate,
                    costPerUse: isNaN(costPerUse) ? 0 : costPerUse,
                    calendarId: r.calendarId || undefined,
                    notes: r.notes || undefined
                };
            })
            : [];

        // Baselines
        const baselines: Record<string, ProjectBaseline> = typeof frontmatter['baselines'] === 'object' && frontmatter['baselines'] !== null
            ? frontmatter['baselines']
            : {};
        for (const [bId, bVal] of Object.entries(baselines)) {
            if (bVal && typeof bVal === 'object' && !bVal.id) {
                bVal.id = bId;
            }
        }
        const activeBaselineId = frontmatter['activeBaselineId'] || (baselines['0'] ? '0' : (baselines['baseline0'] ? 'baseline0' : Object.keys(baselines)[0]));

        // 2. Parse Task lines (N-Level hierarchy)
        const rawTasks: NormalizedTask[] = [];
        let currentParentStack: { task: NormalizedTask; indent: number }[] = [];

        for (let i = bodyStartIndex; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            const leadingWhitespace = line.match(/^[\s\t]*/)?.[0] || '';
            const indentSpaces = leadingWhitespace.replace(/\t/g, '  ').length;

            if (trimmed.startsWith('- [ ]') || trimmed.startsWith('- [x]') || trimmed.startsWith('- [X]')) {
                const parsedTask = this.parseTaskLine(line, i, indentSpaces, filePath, fileName);

                // Determine hierarchy using indentation stack
                while (currentParentStack.length > 0 && currentParentStack[currentParentStack.length - 1].indent >= indentSpaces) {
                    currentParentStack.pop();
                }

                if (currentParentStack.length > 0) {
                    const parent = currentParentStack[currentParentStack.length - 1].task;
                    parsedTask.parentId = parent.id;
                    parsedTask.depth = parent.depth + 1;
                    parent.childIds.push(parsedTask.id);
                    parent.isSummary = true;
                } else {
                    parsedTask.depth = 0;
                }

                currentParentStack.push({ task: parsedTask, indent: indentSpaces });
                rawTasks.push(parsedTask);
            } else if (rawTasks.length > 0 && indentSpaces > 0 && !trimmed.startsWith('#') && trimmed.length > 0) {
                // Indented notes / description under task
                const lastTask = rawTasks[rawTasks.length - 1];
                lastTask.lineCount++;
                if (!lastTask.description) {
                    lastTask.description = trimmed;
                } else if (!lastTask.description.includes(trimmed)) {
                    lastTask.description += ' ' + trimmed;
                }
            }
        }

        // 3. Assign WBS codes based on N-level hierarchy and startTaskNumber
        this.assignWbsCodes(rawTasks, startTaskNumber === 2);

        // 4. Build taskMap and collect all TaskDependencies
        const taskMap = new Map<string, NormalizedTask>();
        rawTasks.forEach(t => {
            taskMap.set(t.id, t);
            if (t.wbsCode) taskMap.set(t.wbsCode, t);
        });

        const dependencies: TaskDependency[] = [];
        for (const task of rawTasks) {
            const parsedDeps = this.extractDependencies(task, rawTasks);
            dependencies.push(...parsedDeps);
        }

        const project: NormalizedProject = {
            id: filePath,
            name: (typeof frontmatter['title'] === 'string' && frontmatter['title']) ? frontmatter['title'] : fileName.replace(/\.md$/, ''),
            filePath,
            tasks: rawTasks,
            taskMap,
            dependencies,
            resources,
            calendars,
            activeCalendarId,
            baselines,
            activeBaselineId,
            schedulingDirection,
            projectStartDate: (typeof frontmatter['projectStartDate'] === 'string' && frontmatter['projectStartDate']) 
                ? frontmatter['projectStartDate'] 
                : (rawTasks[0]?.userStart || new Date().toISOString().slice(0, 10)),
            projectFinishDate: rawTasks[rawTasks.length - 1]?.userFinish || rawTasks[0]?.userStart || new Date().toISOString().slice(0, 10),
            projectDeadline,
            startTaskNumber,
            totalWorkHours: 0,
            totalCost: 0,
            overallProgressPercent: 0,
            criticalPath: [],
            validationIssues: []
        };

        (project as any).rawContent = content;

        return project;
    }


    /**
     * Parse frontmatter block safely.
     */
    private static parseScalar(val: string): any {
        if (val === 'true') return true;
        if (val === 'false') return false;
        if (!isNaN(Number(val)) && val !== '') return Number(val);
        if (val.startsWith('[') && val.endsWith(']')) {
            const inner = val.slice(1, -1).trim();
            if (!inner) return [];
            return inner.split(',').map(s => this.parseScalar(s.trim()));
        }
        return val.replace(/^['"](.*)['"]$/, '$1');
    }

    private static parseFrontmatter(content: string, lines: string[]): { frontmatter: Record<string, any>; bodyStartIndex: number } {
        const frontmatter: Record<string, any> = {};
        let bodyStartIndex = 0;

        if (content.startsWith('---')) {
            const endIdx = content.indexOf('\n---', 3);
            if (endIdx !== -1) {
                const fmText = content.substring(3, endIdx);
                const fmLines = fmText.split('\n');
                bodyStartIndex = fmLines.length + 2; // skip both '---' delimiters

                // Stack elements: { indent: number, obj: any, pendingKey?: string }
                const stack: Array<{ indent: number; obj: any; pendingKey?: string }> = [
                    { indent: -1, obj: frontmatter }
                ];

                for (let i = 0; i < fmLines.length; i++) {
                    const fLine = fmLines[i];
                    const trimmed = fLine.trim();
                    if (!trimmed || trimmed.startsWith('#')) continue;

                    const matchIndent = fLine.match(/^(\s*)/);
                    const indent = matchIndent ? matchIndent[1].length : 0;

                    // Pop stack to current indent level
                    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
                        stack.pop();
                    }

                    let current = stack[stack.length - 1];

                    // Check for list item: "- ..."
                    if (trimmed.startsWith('-')) {
                        const rest = trimmed.replace(/^-\s*/, '').trim();

                        // Convert pending object into an array if needed
                        if (!Array.isArray(current.obj)) {
                            if (current.pendingKey && stack.length > 1) {
                                const parent = stack[stack.length - 2];
                                parent.obj[current.pendingKey] = [];
                                current.obj = parent.obj[current.pendingKey];
                                current.pendingKey = undefined;
                            }
                        }

                        if (Array.isArray(current.obj)) {
                            const colonIdx = rest.indexOf(':');
                            if (colonIdx > 0) {
                                const key = rest.substring(0, colonIdx).trim().replace(/^['"](.*)['"]$/, '$1');
                                const val = rest.substring(colonIdx + 1).trim();
                                const itemObj: Record<string, any> = { [key]: this.parseScalar(val) };
                                current.obj.push(itemObj);
                                stack.push({ indent, obj: itemObj });
                            } else {
                                current.obj.push(this.parseScalar(rest));
                            }
                        }
                        continue;
                    }

                    // Key-value line
                    const colonIdx = trimmed.indexOf(':');
                    if (colonIdx > 0) {
                        const rawKey = trimmed.substring(0, colonIdx).trim();
                        const key = rawKey.replace(/^['"](.*)['"]$/, '$1');
                        const val = trimmed.substring(colonIdx + 1).trim();

                        if (val === '') {
                            const newObj: Record<string, any> = {};
                            if (Array.isArray(current.obj)) {
                                current.obj.push(newObj);
                            } else {
                                current.obj[key] = newObj;
                            }
                            stack.push({ indent, obj: newObj, pendingKey: key });
                        } else {
                            if (!Array.isArray(current.obj)) {
                                current.obj[key] = this.parseScalar(val);
                            }
                        }
                    }
                }
            }
        }

        return { frontmatter, bodyStartIndex };
    }

    /**
     * Parse single checklist line into NormalizedTask with preservation of custom tokens.
     */
    private static parseTaskLine(
        rawLine: string,
        lineIndex: number,
        indentSpaces: number,
        filePath: string,
        fileName: string
    ): NormalizedTask {
        const trimmed = rawLine.trim();
        const completed = trimmed.startsWith('- [x]') || trimmed.startsWith('- [X]');
        const textWithoutCheckbox = trimmed.replace(/^-\s*\[[ xX]\]\s*/, '');

        // Match standard tokens
        const startMatch = textWithoutCheckbox.match(/🛫\s*(\d{4}-\d{2}-\d{2})/);
        const dueMatch = textWithoutCheckbox.match(/📅\s*(\d{4}-\d{2}-\d{2})/);
        const durMatch = textWithoutCheckbox.match(/⏳\s*(\d+)d?/);
        const isMilestone = /#milestone\b/i.test(textWithoutCheckbox);

        const deadlineMatch = textWithoutCheckbox.match(/⏰\s*(\d{4}-\d{2}-\d{2})/) 
            || textWithoutCheckbox.match(/\[deadline::\s*(\d{4}-\d{2}-\d{2})\]/i);

        const progressMatch = textWithoutCheckbox.match(/\[%::\s*(\d+)\]/i) 
            || textWithoutCheckbox.match(/\[progress::\s*(\d+)%?\]/i);

        const priorityMatch = textWithoutCheckbox.match(/\[priority::\s*(\d+|high|medium|low)\]/i);
        let priority = 500;
        if (priorityMatch) {
            const pVal = priorityMatch[1].toLowerCase();
            if (pVal === 'high') priority = 750;
            else if (pVal === 'low') priority = 250;
            else if (!isNaN(Number(pVal))) priority = Number(pVal);
        }

        const constraintMatch = textWithoutCheckbox.match(/\[constraint::\s*(asap|alap|snet|snlt|fnet|fnlt|mso|mfo)(?:\s+(\d{4}-\d{2}-\d{2}))?\]/i);
        const constraintType: ConstraintType = (constraintMatch ? constraintMatch[1].toLowerCase() : 'asap') as ConstraintType;
        const constraintDate = constraintMatch ? constraintMatch[2] : undefined;

        // Assigned resources: e.g. @Roberto, @Roberto:1.0, @Roberto:100%, [assigned:: @Roberto:100%, @Victor:50%]
        const assignments: ResourceAssignment[] = [];
        const assignedTokenMatch = textWithoutCheckbox.match(/\[assigned::\s*([^\]]+)\]/i);
        if (assignedTokenMatch) {
            const parts = assignedTokenMatch[1].split(',');
            for (const part of parts) {
                const item = part.trim().replace(/^@/, '');
                const colonIdx = item.indexOf(':');
                if (colonIdx > 0) {
                    const rName = item.substring(0, colonIdx).trim();
                    const rawUnits = item.substring(colonIdx + 1).replace('%', '').trim();
                    const rUnits = item.includes('%') ? (parseFloat(rawUnits) / 100 || 1.0) : (parseFloat(rawUnits) || 1.0);
                    assignments.push({ resourceId: rName, units: rUnits });
                } else if (item.length > 0) {
                    assignments.push({ resourceId: item, units: 1.0 });
                }
            }
        } else {
            const atMatches = textWithoutCheckbox.match(/@([a-zA-Z0-9_\-\.]+)(?::([0-9\.]+)(?:%|h)?)?/g);
            if (atMatches) {
                for (const atM of atMatches) {
                    const withoutAt = atM.substring(1);
                    const colonIdx = withoutAt.indexOf(':');
                    if (colonIdx > 0) {
                        const rName = withoutAt.substring(0, colonIdx).trim();
                        const rawUnits = withoutAt.substring(colonIdx + 1).replace('%', '').trim();
                        const rUnits = atM.includes('%') ? (parseFloat(rawUnits) / 100 || 1.0) : (parseFloat(rawUnits) || 1.0);
                        assignments.push({ resourceId: rName, units: isNaN(rUnits) ? 1.0 : rUnits });
                    } else {
                        assignments.push({ resourceId: withoutAt.trim(), units: 1.0 });
                    }
                }
            }
        }

        // Description
        const descMatch = textWithoutCheckbox.match(/\[desc::\s*([^\]]+)\]/i) || textWithoutCheckbox.match(/📝\s*([^\n🛫📅⏳@#\[]+)/);
        const description = descMatch ? descMatch[1].trim() : undefined;

        // Custom tokens preserved for lossless roundtrip
        const customTokens: string[] = [];
        const customTokenMatches = textWithoutCheckbox.match(/\[([a-zA-Z0-9_\-]+::\s*[^\]]+)\]/g);
        if (customTokenMatches) {
            for (const token of customTokenMatches) {
                if (!token.startsWith('[desc::') && !token.startsWith('[assigned::') && !token.startsWith('[constraint::') && !token.startsWith('[%::') && !token.startsWith('[priority::') && !token.startsWith('[deadline::')) {
                    customTokens.push(token);
                }
            }
        }

        // Custom HTML comments
        const htmlCommentMatches = textWithoutCheckbox.match(/<!--[\s\S]*?-->/g);
        if (htmlCommentMatches) {
            for (const c of htmlCommentMatches) {
                customTokens.push(c);
            }
        }

        // Custom hashtags (excluding #milestone)
        const hashtagMatches = textWithoutCheckbox.match(/#[a-zA-Z0-9_\-]+/g);
        if (hashtagMatches) {
            for (const tag of hashtagMatches) {
                if (tag.toLowerCase() !== '#milestone') {
                    customTokens.push(tag);
                }
            }
        }

        // Clean task title
        const cleanTitle = textWithoutCheckbox
            .replace(/^(\s*-\s*\[[ xX]\]\s*)+/g, '')
            .replace(/🛫\s*\d{4}-\d{2}-\d{2}/g, '')
            .replace(/📅\s*\d{4}-\d{2}-\d{2}/g, '')
            .replace(/⏳\s*\d+d?/g, '')
            .replace(/⏰\s*\d{4}-\d{2}-\d{2}/g, '')
            .replace(/\[deadline::\s*\d{4}-\d{2}-\d{2}\]/gi, '')
            .replace(/dependsOn::\s*#?[0-9a-zA-Z.,_+\-\s#]+/gi, '')
            .replace(/after:\s*#?[0-9a-zA-Z.,_+\-\s#]+/gi, '')
            .replace(/\[assigned::\s*[^\]]+\]/gi, '')
            .replace(/@([a-zA-Z0-9_\-\.]+)(?::[0-9\.]+(?:%|h)?)?/g, '')
            .replace(/\[constraint::\s*[^\]]+\]/gi, '')
            .replace(/\[%::\s*\d+\]/gi, '')
            .replace(/\[progress::\s*\d+%?\]/gi, '')
            .replace(/\[priority::\s*[^\]]+\]/gi, '')
            .replace(/\[desc::\s*[^\]]+\]/gi, '')
            .replace(/📝\s*[^\n🛫📅⏳@#\[]+/g, '')
            .replace(/#milestone\b/gi, '')
            .replace(/#[a-zA-Z0-9_\-]+/g, '')
            .replace(/<!--[\s\S]*?-->/g, '')
            .replace(/\[([a-zA-Z0-9_\-]+::\s*[^\]]+)\]/g, '')
            .replace(/^(\s*-\s*\[[ xX]\]\s*)+/g, '')
            .replace(/\s+/g, ' ')
            .trim();


        const userStart = startMatch ? startMatch[1] : undefined;
        const userFinish = dueMatch ? dueMatch[1] : undefined;
        let durationDays = durMatch ? parseInt(durMatch[1], 10) : 1;
        if (isMilestone) durationDays = 0;

        const percentComplete = progressMatch ? parseInt(progressMatch[1], 10) : (completed ? 100 : 0);

        const taskId = `task-${lineIndex}`;

        return {
            id: taskId,
            wbsCode: '',
            wbsIndex: lineIndex + 1,
            title: cleanTitle || 'Untitled Task',
            description,
            lineIndex,
            depth: 0,
            childIds: [],
            isSummary: false,
            isMilestone,
            completed,
            percentComplete,
            percentWorkComplete: percentComplete,
            userStart,
            userFinish,
            durationDays,
            workHours: durationDays * 8,
            taskType: 'fixed-duration',
            schedulingMode: 'auto',
            constraintType,
            constraintDate,
            deadline: deadlineMatch ? deadlineMatch[1] : undefined,
            priority,
            calculatedStart: userStart || new Date().toISOString().slice(0, 10),
            calculatedFinish: userFinish || userStart || new Date().toISOString().slice(0, 10),
            earlyStart: userStart || new Date().toISOString().slice(0, 10),
            earlyFinish: userFinish || userStart || new Date().toISOString().slice(0, 10),
            lateStart: userStart || new Date().toISOString().slice(0, 10),
            lateFinish: userFinish || userStart || new Date().toISOString().slice(0, 10),
            totalFloat: 0,
            freeFloat: 0,
            isCritical: false,
            isBlocked: false,
            assignments,
            cost: 0,
            customTokens,
            rawLine,
            lineCount: 1
        };
    }

    /**
     * Compute recursive WBS codes (e.g. "0", "1", "1.1", "1.2", "1.2.1").
     */
    private static assignWbsCodes(tasks: NormalizedTask[], hasProjectTitleTask: boolean): void {
        const rootTasks = tasks.filter(t => !t.parentId);
        let rootCounter = 1;

        for (let i = 0; i < rootTasks.length; i++) {
            const root = rootTasks[i];
            if (hasProjectTitleTask && i === 0) {
                root.wbsCode = '0';
                root.wbsIndex = 0;
            } else {
                const effectiveIndex = hasProjectTitleTask ? i : rootCounter++;
                root.wbsCode = String(effectiveIndex);
                root.wbsIndex = i + 1;
            }
            this.assignChildWbsCodes(root, root.wbsCode, tasks);
        }
    }

    private static assignChildWbsCodes(parent: NormalizedTask, parentCode: string, allTasks: NormalizedTask[]): void {
        const children = allTasks.filter(t => t.parentId === parent.id);
        children.forEach((child, idx) => {
            child.wbsCode = `${parentCode}.${idx + 1}`;
            child.wbsIndex = idx + 1;
            this.assignChildWbsCodes(child, child.wbsCode, allTasks);
        });
    }

    /**
     * Extract dependencies from task rawLine / tokens.
     */
    private static extractDependencies(task: NormalizedTask, allTasks: NormalizedTask[]): TaskDependency[] {
        const raw = task.rawLine || '';
        const predMatch = raw.match(/dependsOn::\s*([0-9a-zA-Z.,_+\-\s#]+?)(?=(?:\s+[#@\[<🛫📅⏳⏰]|$))/i) 
            || raw.match(/after:\s*([0-9a-zA-Z.,_+\-\s#]+?)(?=(?:\s+[#@\[<🛫📅⏳⏰]|$))/i);

        if (!predMatch || !predMatch[1]) return [];

        const deps: TaskDependency[] = [];
        const items = predMatch[1].split(',').map(s => s.replace(/#/g, '').trim()).filter(s => s.length > 0);

        for (const item of items) {
            // Match syntax: e.g. "2.1FS+2d", "2SS", "3FF-1d", "4", "2.1"
            const match = item.match(/^([0-9.]+)\s*(FS|SS|FF|SF)?\s*([+\-]\s*\d+d?)?$/i);
            if (match) {
                const predWbs = match[1];
                const type: DependencyType = (match[2] ? match[2].toUpperCase() : 'FS') as DependencyType;
                const lag = match[3] ? parseInt(match[3].replace(/[d\s]/gi, ''), 10) : 0;

                // Find matching task by wbsCode or id
                const predTask = allTasks.find(t => t.wbsCode === predWbs || String(t.wbsIndex) === predWbs || t.id === predWbs);
                if (predTask) {
                    deps.push({
                        id: `dep-${predTask.id}-${task.id}`,
                        fromTaskId: predTask.id,
                        toTaskId: task.id,
                        type,
                        lag,
                        rawExpression: item
                    });
                }
            }
        }

        return deps;
    }

    /**
     * Surgically serialize a single task line back into markdown format.
     * Preserves user indentation, checkboxes, and unknown custom tokens.
     */
    static serializeTaskLine(task: NormalizedTask, project: NormalizedProject): string {
        const indent = '  '.repeat(task.depth);
        const checkbox = task.completed ? '- [x]' : '- [ ]';
        const tokens: string[] = [];

        // Dates
        const start = task.calculatedStart || task.userStart;
        const finish = task.calculatedFinish || task.userFinish;
        if (start) tokens.push(`🛫 ${start}`);
        if (finish) tokens.push(`📅 ${finish}`);

        // Duration (if not milestone and > 1)
        if (!task.isMilestone && task.durationDays > 1) {
            tokens.push(`⏳ ${task.durationDays}d`);
        }

        // Deadline
        if (task.deadline) {
            tokens.push(`⏰ ${task.deadline}`);
        }

        // Dependencies
        const taskDeps = project.dependencies.filter(d => d.toTaskId === task.id);
        if (taskDeps.length > 0) {
            const depStrings = taskDeps.map(d => {
                const pred = project.taskMap.get(d.fromTaskId);
                const predRef = pred ? pred.wbsCode : d.fromTaskId;
                const typeStr = d.type !== 'FS' ? d.type : '';
                const lagStr = d.lag !== 0 ? (d.lag > 0 ? `+${d.lag}d` : `${d.lag}d`) : '';
                return `${predRef}${typeStr}${lagStr}`;
            });
            tokens.push(`dependsOn:: ${depStrings.join(', ')}`);
        }

        // Resources
        if (task.assignments.length > 0) {
            const resParts = task.assignments.map(a => {
                return a.units === 1.0 ? `@${a.resourceId}` : `@${a.resourceId}:${Math.round(a.units * 100)}%`;
            });
            tokens.push(resParts.join(' '));
        }

        // Constraints
        if (task.constraintType && task.constraintType !== 'asap') {
            const cDateStr = task.constraintDate ? ` ${task.constraintDate}` : '';
            tokens.push(`[constraint:: ${task.constraintType}${cDateStr}]`);
        }

        // Priority
        if (task.priority && task.priority !== 500) {
            tokens.push(`[priority:: ${task.priority}]`);
        }

        // Progress
        if (task.percentComplete > 0 && task.percentComplete < 100) {
            tokens.push(`[%:: ${task.percentComplete}]`);
        }

        // Description
        if (task.description && !task.description.includes('\n')) {
            tokens.push(`[desc:: ${task.description}]`);
        }

        // Milestone
        if (task.isMilestone) {
            tokens.push('#milestone');
        }

        // Custom tokens
        if (task.customTokens && task.customTokens.length > 0) {
            tokens.push(...task.customTokens);
        }

        const tokenStr = tokens.length > 0 ? ` ${tokens.join(' ')}` : '';
        return `${indent}${checkbox} ${task.title}${tokenStr}`;
    }

    /**
     * Surgically update task lines in content without altering unrelated text or comments.
     */
    static updateTaskInContent(content: string, task: NormalizedTask, project: NormalizedProject): string {
        const lines = content.split('\n');
        if (task.lineIndex < 0 || task.lineIndex >= lines.length) {
            return content;
        }

        lines[task.lineIndex] = this.serializeTaskLine(task, project);
        return lines.join('\n');
    }

    /**
     * Format a scalar or array value for safe YAML frontmatter emission.
     */
    private static formatYamlValue(val: any): string {
        if (typeof val === 'string') {
            if (val.includes(':') || val.includes('#') || val.includes('[') || val.includes('{') || val.includes('"') || val === '') {
                return JSON.stringify(val);
            }
            return val;
        }
        if (Array.isArray(val)) {
            return `[${val.map(v => this.formatYamlValue(v)).join(', ')}]`;
        }
        return String(val);
    }

    /**
     * Surgically update frontmatter keys in markdown content without disturbing formatting or unrelated keys.
     * Returns the updated content along with the line delta introduced by frontmatter expansion or contraction.
     */
    static updateFrontmatterInContent(content: string, updates: Record<string, any>): { content: string; lineDelta: number; fmEndIndex: number } {
        const lines = content.split('\n');
        let fmStartIndex = -1;
        let fmEndIndex = -1;

        if (lines[0]?.trim() === '---') {
            fmStartIndex = 0;
            for (let i = 1; i < lines.length; i++) {
                if (lines[i]?.trim() === '---') {
                    fmEndIndex = i;
                    break;
                }
            }
        }

        const { frontmatter } = this.parseFrontmatter(content, lines);

        // Check if updates actually change anything
        let hasChanges = false;
        for (const [k, v] of Object.entries(updates)) {
            if (JSON.stringify(frontmatter[k]) !== JSON.stringify(v)) {
                hasChanges = true;
                break;
            }
        }

        if (!hasChanges) {
            return { content, lineDelta: 0, fmEndIndex };
        }

        const merged = { ...frontmatter };

        // Apply updates
        for (const [k, v] of Object.entries(updates)) {
            if (v === undefined || v === null || v === '') {
                delete merged[k];
            } else {
                merged[k] = v;
            }
        }

        // Serialize YAML block
        const fmLines: string[] = ['---'];
        for (const [key, val] of Object.entries(merged)) {
            if (val === undefined || val === null) continue;
            if (Array.isArray(val)) {
                if (val.length === 0) {
                    fmLines.push(`${key}: []`);
                } else if (typeof val[0] === 'object' && val[0] !== null) {
                    fmLines.push(`${key}:`);
                    for (const item of val) {
                        const entries = Object.entries(item);
                        if (entries.length > 0) {
                            const [firstK, firstV] = entries[0];
                            fmLines.push(`  - ${firstK}: ${this.formatYamlValue(firstV)}`);
                            for (let j = 1; j < entries.length; j++) {
                                const [subK, subV] = entries[j];
                                fmLines.push(`    ${subK}: ${this.formatYamlValue(subV)}`);
                            }
                        }
                    }
                } else {
                    fmLines.push(`${key}: [${val.map(v => this.formatYamlValue(v)).join(', ')}]`);
                }
            } else if (typeof val === 'object') {
                fmLines.push(`${key}:`);
                for (const [subKey, subVal] of Object.entries(val)) {
                    if (typeof subVal === 'object' && subVal !== null && !Array.isArray(subVal)) {
                        fmLines.push(`  ${subKey}:`);
                        for (const [leafK, leafV] of Object.entries(subVal)) {
                            fmLines.push(`    ${leafK}: ${this.formatYamlValue(leafV)}`);
                        }
                    } else {
                        fmLines.push(`  ${subKey}: ${this.formatYamlValue(subVal)}`);
                    }
                }
            } else {
                fmLines.push(`${key}: ${this.formatYamlValue(val)}`);
            }
        }
        fmLines.push('---');

        if (fmStartIndex === 0 && fmEndIndex > 0) {
            const oldFmCount = fmEndIndex + 1;
            const newFmCount = fmLines.length;
            const lineDelta = newFmCount - oldFmCount;
            const body = lines.slice(fmEndIndex + 1);
            return {
                content: [...fmLines, ...body].join('\n'),
                lineDelta,
                fmEndIndex
            };
        } else {
            return {
                content: [...fmLines, ...lines].join('\n'),
                lineDelta: fmLines.length,
                fmEndIndex: -1
            };
        }
    }

    /**
     * Serialize an entire NormalizedProject into Markdown.
     * If rawContent is provided (or stored on project), performs non-destructive line updates
     * preserving all existing frontmatter, headers, prose, wikilinks, tags, and non-task text.
     */
    static serializeProject(project: NormalizedProject, rawContent?: string): string {
        const baseContent = rawContent || (project as any).rawContent;
        if (baseContent) {
            const updates: Record<string, any> = {};
            if (project.name) updates['title'] = project.name;
            if (project.projectStartDate) updates['projectStartDate'] = project.projectStartDate;
            if (project.projectDeadline) updates['deadline'] = project.projectDeadline;
            if (project.schedulingDirection) updates['scheduleMode'] = project.schedulingDirection;
            if (project.startTaskNumber) updates['startTaskNumber'] = project.startTaskNumber;
            if (project.activeCalendarId) updates['activeCalendarId'] = project.activeCalendarId;
            if (project.calendars && project.calendars.length > 0) updates['calendars'] = project.calendars;
            if (project.resources && project.resources.length > 0) updates['resources'] = project.resources;
            if (project.baselines && Object.keys(project.baselines).length > 0) updates['baselines'] = project.baselines;
            if (project.activeBaselineId) updates['activeBaselineId'] = project.activeBaselineId;

            const fmResult = this.updateFrontmatterInContent(baseContent, updates);
            const lines = fmResult.content.split('\n');
            for (const task of project.tasks) {
                const targetIndex = (fmResult.fmEndIndex >= 0 && task.lineIndex > fmResult.fmEndIndex)
                    ? task.lineIndex + fmResult.lineDelta
                    : task.lineIndex;
                if (targetIndex >= 0 && targetIndex < lines.length) {
                    lines[targetIndex] = this.serializeTaskLine(task, project);
                }
            }
            return lines.join('\n');
        }

        // Fallback: construct clean markdown
        const lines: string[] = [];
        lines.push('---');
        lines.push(`title: ${project.name}`);
        if (project.projectStartDate) lines.push(`projectStartDate: ${project.projectStartDate}`);
        if (project.projectDeadline) lines.push(`deadline: ${project.projectDeadline}`);
        if (project.schedulingDirection) lines.push(`scheduleMode: ${project.schedulingDirection}`);
        if (project.activeCalendarId) lines.push(`activeCalendarId: ${project.activeCalendarId}`);
        lines.push('---');
        lines.push('');
        lines.push(`# ${project.name}`);
        lines.push('');

        for (const task of project.tasks) {
            lines.push(this.serializeTaskLine(task, project));
        }

        return lines.join('\n');
    }
}

