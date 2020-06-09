export enum EventType {
    PipelineRefresh = 'pipeline-refresh',
    PipelineBuilt = 'pipeline-built'
}

export interface ApplicationEvent {
    type: EventType.PipelineRefresh | EventType.PipelineBuilt,
    data?: any
}

export interface PipelineDefinition {
    id: string;
    name: string;
    jobs: JobDefinition[];
}

export interface Pipeline {
    id: string;
    name: string;
    definition: JobDefinition[];
    width?: number;
    height?: number;
    slices?: Slice[];
    jobs?: Job[];
}

export interface JobDefinition {
    name: string,
    url: string;
    next?: string[];
    isDeploy?: boolean;
    parameters?: JobParameter[];
}

export interface JobParameter {
    name: string;
    fixedValue?: boolean;
    value?: string | number;
    options?: string[];
    selectedOption?: string;
}

export interface Slice {
    jobs: Job[];
    connectors?: Connector[];
}

export interface Job {
    name: string,
    url: string;
    next?: Job[];
    isDeploy?: boolean;
    parameters?: JobParameter[];
    parent: Job;
    y: number;
    maxChildY: number;
    text: string;
    connectors: Connector[];
    jobRuns: JobRun[];
    status: JobStatus;
    statusLeft: JobStatus;
    statusRight: JobStatus;
    duration: number;
    avgDuration: number;
    isHoveringCircle: boolean;
    isHoveringDetail: boolean;
    isHoveringAction: boolean;
    isWaitingBuild: boolean;
    isWaitingToStop: boolean;
    updateFrequency: UpdateFrequency;
    updateFreqStepTime: number;
}

export enum UpdateFrequency {
    Low,
    High
}

export interface Connector {
    direction: 'up' | 'down' | 'right';
    top: number;
    lineUpHeight?: number;
    lineRightUpHeight?: number;
    lineUpRightHeight?: number;
    lineRightDownHeight?: number;
    lineDownRightHeight?: number;
    jobLeft: Job;
    jobRight: Job;
    status?: JobStatus;
}

export enum JobStatus {
    Aborted = 'ABORTED',
    Failed = 'FAILED',
    InProgress = 'IN_PROGRESS',
    NotExecuted = 'NOT_EXECUTED',
    PausedPendingInput = 'PAUSED_PENDING_INPUT',
    Success = 'SUCCESS',
    Unstable = 'UNSTABLE',
}

export interface JobRun {
    id: string;
    name: string;
    status: JobStatus;
    startTimeMillis: number;
    endTimeMillis: number;
    durationMillis: number;
    stages: Stage[];
}

export interface Stage {
    id: string;
    name: string;
    status: JobStatus;
    startTimeMillis: number;
    durationMillis: number;
    parameterDescription: string;
    stageFlowNodes: Stage[];
}

export interface GetJobRunsResponse {
    pipelineId: string;
    jobName: string;
    jobRuns: JobRun[];
}

export interface Jenkins {
    server: string;
    username: string;
    token: string;
}

export interface JenkinsJobRun {
    lastBuild: {
        number: number;
    };
    lastCompletedBuild: {
        number: number;
    }
}

export interface NodeLog {
    nodeId: string;
    nodeStatus: string;
    length: number;
    hasMore: boolean;
    text: string;
    consoleUrl: string;
}

export interface ElectronRequest {
    id?: string;
    method: 'GET' | 'POST';
    url: string;
    params?: { [key: string]: string };
    headers: { [key: string]: string };
    postData?: any;
}

export interface ElectronResponse {
    id: string;
    text: string;
    headers: Headers;
}
