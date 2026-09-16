export interface TaskSheetColumnDef {
    id: string;
    label: string;
    category: 'core' | 'schedule' | 'actuals' | 'baseline' | 'analysis';
    defaultVisible: boolean;
    width: string;
    description: string;
}

export const ALL_TASKSHEET_COLUMNS: TaskSheetColumnDef[] = [
    // Core & Hierarchy
    { id: 'wbs', label: 'WBS', category: 'core', defaultVisible: true, width: '50px', description: 'WBS code / hierarchy level' },
    { id: 'status', label: 'Status', category: 'core', defaultVisible: true, width: '45px', description: 'Completion checkbox and lock state' },
    { id: 'name', label: 'Task Name', category: 'core', defaultVisible: true, width: '280px', description: 'Task title, hierarchy indentation, milestone' },
    { id: 'description', label: 'Description', category: 'core', defaultVisible: false, width: '180px', description: 'Task notes and extended description' },
    { id: 'actions', label: 'Actions', category: 'core', defaultVisible: true, width: '50px', description: 'Task details and editing button' },

    // Planned Schedule
    { id: 'startDate', label: 'Planned Start', category: 'schedule', defaultVisible: true, width: '105px', description: 'Planned start date' },
    { id: 'dueDate', label: 'Planned Due', category: 'schedule', defaultVisible: true, width: '105px', description: 'Planned finish date' },
    { id: 'duration', label: 'Duration', category: 'schedule', defaultVisible: true, width: '60px', description: 'Planned duration in working days' },
    { id: 'work', label: 'Planned Work', category: 'schedule', defaultVisible: true, width: '65px', description: 'Planned work in person-hours' },
    { id: 'predecessors', label: 'Predecessors', category: 'schedule', defaultVisible: true, width: '110px', description: 'Task dependencies (FS, SS, FF, SF with lag)' },
    { id: 'resource', label: 'Resources', category: 'schedule', defaultVisible: true, width: '110px', description: 'Assigned project resources' },

    // Execution & Actuals
    { id: 'actualStart', label: 'Actual Start', category: 'actuals', defaultVisible: false, width: '105px', description: 'Recorded actual start date' },
    { id: 'actualFinish', label: 'Actual Finish', category: 'actuals', defaultVisible: false, width: '105px', description: 'Recorded actual finish date' },
    { id: 'actualWork', label: 'Actual Work', category: 'actuals', defaultVisible: false, width: '75px', description: 'Recorded actual work in person-hours' },
    { id: 'forecastStart', label: 'Forecast Start', category: 'actuals', defaultVisible: false, width: '105px', description: 'Projected start date calculated from actuals & status date' },
    { id: 'forecastFinish', label: 'Forecast Finish', category: 'actuals', defaultVisible: false, width: '105px', description: 'Projected finish date calculated from actuals & status date' },
    { id: 'percentComplete', label: '% Complete', category: 'actuals', defaultVisible: true, width: '85px', description: 'Execution progress percentage' },

    // Baseline & Variance
    { id: 'baselineStart', label: 'Baseline Start', category: 'baseline', defaultVisible: false, width: '105px', description: 'Snapshot start date of active baseline' },
    { id: 'baselineFinish', label: 'Baseline Finish', category: 'baseline', defaultVisible: false, width: '105px', description: 'Snapshot finish date of active baseline' },
    { id: 'startVariance', label: 'Start Var', category: 'baseline', defaultVisible: false, width: '75px', description: 'Start variance in days relative to baseline' },
    { id: 'finishVariance', label: 'Finish Var', category: 'baseline', defaultVisible: false, width: '75px', description: 'Finish variance in days relative to baseline' },
    { id: 'durationVariance', label: 'Dur Var', category: 'baseline', defaultVisible: false, width: '70px', description: 'Duration variance in days relative to baseline' },
    { id: 'workVariance', label: 'Work Var', category: 'baseline', defaultVisible: false, width: '75px', description: 'Work variance in person-hours relative to baseline' },
    { id: 'costVariance', label: 'Cost Var', category: 'baseline', defaultVisible: false, width: '75px', description: 'Cost variance in currency relative to baseline' },

    // Schedule Analysis
    { id: 'totalFloat', label: 'Total Float', category: 'analysis', defaultVisible: false, width: '80px', description: 'Available float before impacting project completion' },
    { id: 'freeFloat', label: 'Free Float', category: 'analysis', defaultVisible: false, width: '75px', description: 'Available float before delaying immediate successors' },
    { id: 'critical', label: 'Critical', category: 'analysis', defaultVisible: true, width: '70px', description: 'Critical path flag (zero total float)' }
];

export const DEFAULT_TASKSHEET_COLUMNS: string[] = [
    'wbs',
    'status',
    'name',
    'startDate',
    'dueDate',
    'duration',
    'work',
    'predecessors',
    'resource',
    'percentComplete',
    'critical',
    'actions'
];

export const PRESET_EXECUTION_COLUMNS: string[] = [
    'wbs',
    'status',
    'name',
    'startDate',
    'dueDate',
    'actualStart',
    'actualFinish',
    'actualWork',
    'forecastStart',
    'forecastFinish',
    'percentComplete',
    'actions'
];

export const PRESET_VARIANCE_COLUMNS: string[] = [
    'wbs',
    'name',
    'startDate',
    'baselineStart',
    'startVariance',
    'dueDate',
    'baselineFinish',
    'finishVariance',
    'work',
    'workVariance',
    'costVariance',
    'percentComplete',
    'actions'
];

export const PRESET_FLOAT_COLUMNS: string[] = [
    'wbs',
    'name',
    'startDate',
    'dueDate',
    'duration',
    'predecessors',
    'totalFloat',
    'freeFloat',
    'critical',
    'actions'
];
