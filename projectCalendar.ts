import { CalendarDefinition, CalendarException } from './projectModel';

/**
 * Calendar math utility using pure YYYY-MM-DD string / Date operations.
 * Avoids heavy runtime dependencies so it can run cleanly in any environment (Node, Browser, Tests).
 */
export class ProjectCalendar {
    id: string;
    name: string;
    workingDays: Set<number>; // 0 = Sun, 1 = Mon, ..., 6 = Sat
    hoursPerDay: number;
    holidays: Set<string>;   // "YYYY-MM-DD"
    exceptions: Map<string, boolean>; // "YYYY-MM-DD" -> isWorking

    constructor(
        idOrDef: string | CalendarDefinition = 'standard',
        name = 'Standard (5 Day / 8h)',
        workingDays: number[] = [1, 2, 3, 4, 5],
        hoursPerDay = 8,
        holidays: string[] = [],
        exceptions: CalendarException[] = []
    ) {
        if (typeof idOrDef === 'object' && idOrDef !== null) {
            this.id = idOrDef.id || 'standard';
            this.name = idOrDef.name || 'Standard';
            this.workingDays = new Set(idOrDef.workingDays || [1, 2, 3, 4, 5]);
            this.hoursPerDay = idOrDef.hoursPerDay || 8;
            this.holidays = new Set(idOrDef.holidays || []);
            this.exceptions = new Map();
            if (Array.isArray(idOrDef.exceptions)) {
                for (const ex of idOrDef.exceptions) {
                    this.exceptions.set(ex.date, ex.isWorking);
                }
            }
        } else {
            this.id = idOrDef;
            this.name = name;
            this.workingDays = new Set(workingDays);
            this.hoursPerDay = hoursPerDay;
            this.holidays = new Set(holidays);
            this.exceptions = new Map();
            if (Array.isArray(exceptions)) {
                for (const ex of exceptions) {
                    this.exceptions.set(ex.date, ex.isWorking);
                }
            }
        }
    }

    static createStandardCalendar(): ProjectCalendar {
        return new ProjectCalendar('standard', 'Standard (5 Day / 8h)', [1, 2, 3, 4, 5], 8, []);
    }

    static fromDefinition(def: CalendarDefinition): ProjectCalendar {
        return new ProjectCalendar(def);
    }


    toDefinition(): CalendarDefinition {
        const exceptions: CalendarException[] = [];
        this.exceptions.forEach((isWorking, date) => {
            exceptions.push({ date, isWorking });
        });
        return {
            id: this.id,
            name: this.name,
            workingDays: Array.from(this.workingDays).sort(),
            hoursPerDay: this.hoursPerDay,
            holidays: Array.from(this.holidays).sort(),
            exceptions
        };
    }

    /**
     * Parse YYYY-MM-DD into a UTC Date object to avoid time zone drift.
     */
    private parseDate(dateStr: string): Date {
        const parts = dateStr.split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        return new Date(Date.UTC(year, month, day));
    }

    /**
     * Format a UTC Date object to YYYY-MM-DD.
     */
    private formatDate(date: Date): string {
        const y = date.getUTCFullYear();
        const m = String(date.getUTCMonth() + 1).padStart(2, '0');
        const d = String(date.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    /**
     * Determine if the given date is a working day according to this calendar.
     */
    isWorkingDay(dateInput: string | Date): boolean {
        const dateStr = typeof dateInput === 'string' ? dateInput : this.formatDate(dateInput);
        
        // 1. Check explicit exceptions first
        if (this.exceptions.has(dateStr)) {
            return this.exceptions.get(dateStr)!;
        }

        // 2. Check holidays
        if (this.holidays.has(dateStr)) {
            return false;
        }

        // 3. Check regular weekly working days
        const d = typeof dateInput === 'string' ? this.parseDate(dateInput) : dateInput;
        const dayOfWeek = d.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
        return this.workingDays.has(dayOfWeek);
    }

    /**
     * Advance forward or backward to the nearest working day.
     */
    snapToWorkingDay(dateStr: string, direction: 'forward' | 'backward' = 'forward'): string {
        if (!dateStr || dateStr.length < 10) return dateStr;
        const current = this.parseDate(dateStr);
        let iterations = 0;

        while (!this.isWorkingDay(current) && iterations < 365) {
            const step = direction === 'forward' ? 1 : -1;
            current.setUTCDate(current.getUTCDate() + step);
            iterations++;
        }
        return this.formatDate(current);
    }

    /**
     * Advance or rewind by an exact count of working day steps.
     * steps = 0: returns current snapped date
     * steps = 1: next working day
     * steps = -1: previous working day
     */
    stepWorkingDays(dateStr: string, steps: number): string {
        if (!dateStr) return dateStr;
        let current = this.parseDate(this.snapToWorkingDay(dateStr, steps >= 0 ? 'forward' : 'backward'));
        if (steps === 0) {
            return this.formatDate(current);
        }

        const direction = steps > 0 ? 1 : -1;
        let count = 0;
        const total = Math.abs(steps);

        while (count < total) {
            current.setUTCDate(current.getUTCDate() + direction);
            if (this.isWorkingDay(current)) {
                count++;
            }
        }
        return this.formatDate(current);
    }

    /**
     * Get the next working day strictly after dateStr.
     */
    getNextWorkingDay(dateStr: string): string {
        return this.stepWorkingDays(dateStr, 1);
    }

    /**
     * Get the previous working day strictly before dateStr.
     */
    getPreviousWorkingDay(dateStr: string): string {
        return this.stepWorkingDays(dateStr, -1);
    }

    /**
     * Calculate number of working days between start and end date inclusive.
     */
    calculateWorkingDays(startDate: string, endDate: string): number {

        if (!startDate || !endDate) return 1;
        if (endDate < startDate) return 1;

        let workingDays = 0;
        const current = this.parseDate(startDate);
        const end = this.parseDate(endDate);

        while (current.getTime() <= end.getTime()) {
            if (this.isWorkingDay(current)) {
                workingDays++;
            }
            current.setUTCDate(current.getUTCDate() + 1);
        }
        return Math.max(1, workingDays);
    }

    /**
     * Add N working days to startDate.
     * Note: 1 working day means it starts and finishes on the same day (if weekday).
     */
    addWorkingDays(startDate: string, workingDays: number): string {
        if (!startDate) return startDate;
        let current = this.parseDate(this.snapToWorkingDay(startDate, 'forward'));
        if (workingDays <= 1) {
            return this.formatDate(current);
        }

        let daysAdded = 1;
        while (daysAdded < workingDays) {
            current.setUTCDate(current.getUTCDate() + 1);
            if (this.isWorkingDay(current)) {
                daysAdded++;
            }
        }
        return this.formatDate(current);
    }

    /**
     * Subtract N working days from endDate.
     * Note: 1 working day means same day.
     */
    subtractWorkingDays(endDate: string, workingDays: number): string {
        if (!endDate) return endDate;
        let current = this.parseDate(this.snapToWorkingDay(endDate, 'backward'));
        if (workingDays <= 1) {
            return this.formatDate(current);
        }

        let daysSubtracted = 1;
        while (daysSubtracted < workingDays) {
            current.setUTCDate(current.getUTCDate() - 1);
            if (this.isWorkingDay(current)) {
                daysSubtracted++;
            }
        }
        return this.formatDate(current);
    }

    /**
     * Split a date interval into contiguous working day segments.
     * Non-working periods (weekends, holidays) create split intervals for Gantt rendering.
     */
    getWorkingIntervals(startDate: string, endDate: string): Array<{ start: string; end: string }> {
        if (!startDate || !endDate) return [];
        if (endDate < startDate) return [{ start: startDate, end: startDate }];

        const intervals: Array<{ start: string; end: string }> = [];
        const current = this.parseDate(startDate);
        const end = this.parseDate(endDate);

        let segStart: string | null = null;
        let lastWorkDay: string | null = null;

        while (current.getTime() <= end.getTime()) {
            const isWork = this.isWorkingDay(current);
            const dateStr = this.formatDate(current);

            if (isWork) {
                if (!segStart) {
                    segStart = dateStr;
                }
                lastWorkDay = dateStr;
            } else {
                if (segStart && lastWorkDay) {
                    intervals.push({ start: segStart, end: lastWorkDay });
                    segStart = null;
                    lastWorkDay = null;
                }
            }
            current.setUTCDate(current.getUTCDate() + 1);
        }

        if (segStart && lastWorkDay) {
            intervals.push({ start: segStart, end: lastWorkDay });
        }

        return intervals.length > 0 ? intervals : [{ start: startDate, end: endDate }];
    }
}
