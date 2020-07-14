import {Injectable} from '@angular/core';
import {JenkinsService} from "./jenkins.service";
import {
    ApplicationEvent,
    EventType,
    Job,
    JobRun,
    JobRunParameter,
    JobStatus,
    Pipeline,
    Stage,
    UpdateFrequency
} from "../model/types";
import {EventService} from "./event.service";
import {PipelineBuilderService} from "./pipeline-builder.service";
import * as moment from "moment";

@Injectable({
    providedIn: 'root'
})
export class PipelineUpdaterService {

    private isUpdating: { [key: string]: boolean } = {};
    private intervals = { hf: undefined, lf: undefined };

    constructor(private builder: PipelineBuilderService,
                private jenkinsService: JenkinsService) {
        this.subscribeToEvents();
        setInterval(() => this.increaseDurations(), 1000);
    }

    async subscribeToEvents() {
        EventService.emitter.subscribe(async (event: ApplicationEvent) => {
            if (event.type === EventType.PipelineBuilt) {
                await this.updatePipelines(UpdateFrequency.Low);
                await this.updatePipelines(UpdateFrequency.High);
                clearInterval(this.intervals.hf);
                this.intervals.hf = setInterval(() => this.updatePipelines(UpdateFrequency.Low), 10000);
                clearInterval(this.intervals.lf);
                this.intervals.lf = setInterval(() => this.updatePipelines(UpdateFrequency.High), 1500);
            }
        });
    }

    async updatePipelines(frequency: UpdateFrequency) {
        await Promise.all(this.builder.pipelines.map(x => this.updatePipeline(x, frequency)));
    }

    async updatePipeline(pipeline: Pipeline, frequency: UpdateFrequency) {
        if (this.isUpdating[frequency + pipeline.name]) {
            return;
        }
        this.isUpdating[frequency + pipeline.name] = true;
        let jobs: Job[] = [];
        try {
            if (!pipeline.jobs) {
                return;
            }
            jobs = pipeline.jobs.filter(x => x.updateFrequency == frequency || (!x.updateFrequency && frequency == UpdateFrequency.Low));
            if (jobs.length == 0) {
                return;
            }
            if (pipeline.isNew) {
                pipeline.isNew = false;
                await this.updateAllJobFullyAndInParallel(pipeline, jobs);
            } else {
                for (let i = 0; i < jobs.length; i++) {
                    await this.updateJob(pipeline, jobs[i]);
                }
            }
            for (let job of jobs) {
                this.checkAndStepFrequencyDown(job);
            }
            pipeline.error = undefined;
        } catch (e) {
            console.log(e);
            pipeline.error = e;
            this.setUnknownStatus(pipeline);
        } finally {
            this.isUpdating[frequency + pipeline.name] = false;
        }
    }

    async updateAllJobFullyAndInParallel(pipeline: Pipeline, jobs: Job[]) {
        await Promise.all(jobs.filter(x => !x.isDeploy).map(job => this.updateJobRuns(job)));
        for (let job of jobs) {
            this.applyJobState(pipeline, job);
        }
    }

    applyJobState(pipeline: Pipeline, job: Job) {
        this.applyStatusByTime(job);
        this.updateJobDuration(job);
        EventService.emitter.emit({ type: EventType.PipelineRefresh, data: pipeline });
    }

    async updateJob(pipeline: Pipeline, job: Job) {
        if (job.isDeploy) {
            if (job.isDeploying || job.status == JobStatus.InProgress) {
                await this.updateDeployJob(pipeline, job);
            }
        } else if (!job.jobRuns || job.jobRuns.length == 0) {
            await this.updateJobRuns(job);
        } else {
            let jobState = await this.jenkinsService.getJobState(job);
            if (jobState.lastBuild.number > Number(job.jobRuns[0].id)) {
                await this.updateJobRuns(job);
            } else if (jobState.lastBuild.number != jobState.lastCompletedBuild.number || job.jobRuns[0].status == JobStatus.InProgress) {
                await this.updateJobPartially(job, jobState.lastBuild.number);
            }
        }
        this.applyJobState(pipeline, job);
    }

    async updateJobPartially(job: Job, build: number) {
        let jobRun = await this.jenkinsService.getWfJobRun(job, build);
        let stages = [];
        for (let stage of jobRun.stages) {
            let existingStage: Stage = undefined;
            if (job.jobRuns && job.jobRuns.length > 0 && job.jobRuns[0].stages) {
                existingStage = job.jobRuns[0].stages.find(x => x.id == stage.id);
            }
            if (!existingStage || existingStage.status == JobStatus.InProgress) {
                stages.push(await this.jenkinsService.getWfStage(job, build, stage.id));
            } else {
                stages.push(existingStage);
            }
        }
        jobRun.stages = stages;
        this.applyJobRuns(job, [ jobRun ]);
    }

    public async updateJobRuns(job: Job): Promise<JobRun[]> {
        if (!job.url) {
            job.status = JobStatus.NotExecuted;
            return;
        }
        let jobRuns = await this.jenkinsService.getWfJobRuns(job);
        this.applyJobRuns(job, jobRuns);
    }

    applyJobRuns(job: Job, jobRuns: JobRun[]) {
        if (job.jobRuns) {
            for (let jobRun of jobRuns) {
                this.applyJobRun(job, jobRun);
            }
        } else {
            job.jobRuns = jobRuns;
        }
        if (job.jobRuns && job.jobRuns.length) {
            let newStatus = job.jobRuns[0].status;
            if (job.status == JobStatus.InProgress && newStatus == JobStatus.Success) {
                for (let nextJob of job.next) {
                    this.setHighFrequency(nextJob, 60);
                }
            }
            if (newStatus == JobStatus.InProgress) {
                this.setHighFrequency(job, 10);
            }
            job.status = newStatus;
        }
    }

    public setHighFrequency(job: Job, seconds: number) {
        job.updateFrequency = UpdateFrequency.High;
        job.updateFreqStepTime = Date.now() + seconds * 1000;
        console.log(job.name, '----> HF +' + seconds);
    }

    checkAndStepFrequencyDown(job: Job) {
        if (job.updateFreqStepTime && job.updateFreqStepTime < Date.now()) {
            job.updateFrequency = UpdateFrequency.Low;
            job.updateFreqStepTime = undefined;
            console.log(job.name, '----> LF');
        }
    }

    applyJobRun(job: Job, jobRun: JobRun) {
        let existingJobRun = job.jobRuns.find(x => x.id == jobRun.id);
        if (!existingJobRun) {
            job.jobRuns.splice(0, 0, jobRun);
            return;
        }
        for (let property of ['status', 'startTimeMillis', 'endTimeMillis', 'durationMillis', 'pauseDurationMillis']) {
            this.updateProperty(property, existingJobRun, jobRun);
        }
        if (!jobRun.stages) {
            return;
        }
        if (!existingJobRun.stages) {
            existingJobRun.stages = [];
        }
        for (let stage of jobRun.stages) {
            this.applyStageRun(existingJobRun.stages, stage, true);
        }
    }

    applyStageRun(existingStages: Stage[], updatedStage: Stage, updateNodes: boolean) {
        let existingStage = existingStages.find(x => x.id == updatedStage.id);
        if (!existingStage) {
            existingStages.push(updatedStage);
            return;
        }
        for (let property of ['status', 'startTimeMillis', 'durationMillis', 'pauseDurationMillis']) {
            this.updateProperty(property, existingStage, updatedStage);
        }
        if (!updatedStage.stageFlowNodes || !updateNodes) {
            return;
        }
        if (!existingStage.stageFlowNodes) {
            existingStage.stageFlowNodes = [];
        }
        for (let node of updatedStage.stageFlowNodes) {
            this.applyStageRun(existingStage.stageFlowNodes, node, false);
        }
    }

    updateProperty(property: string, obj1: any, obj2: any) {
        if (obj1[property] != obj2[property]) {
            obj1[property] = obj2[property];
        }
    }

    updateJobDuration(job: Job) {
        job.avgDuration = this.getAverageDuration(job);
        if (job.jobRuns && job.jobRuns.length && job.jobRuns[0].status == JobStatus.InProgress) {
            job.duration = job.jobRuns[0].durationMillis;
        } else {
            job.duration = undefined;
        }
        job.text = this.getDurationLeft(job);
    }

    getDurationLeft(job: Job): string {
        if (!job.duration) {
            return undefined;
        }
        if (!job.avgDuration || job.duration > job.avgDuration) {
            return this.formatDuration(job.duration);
        }
        return '~' + this.formatDuration(job.avgDuration - job.duration) + ' left';
    }

    getAverageDuration(job: Job): number {
        let i = 0;
        let totalDuration = 0;
        if (!job.jobRuns) return ;
        for (let jobRun of job.jobRuns) {
            if (jobRun.status == JobStatus.Success) {
                if (jobRun.durationMillis > 0) {
                    i++;
                    totalDuration += jobRun.durationMillis;
                }
            }
        }
        if (i > 0) {
            return totalDuration / i;
        }
    }

    formatDuration(duration: number): string {
        let value = duration / 1000;
        if (value > 1) {
            value = Math.trunc(value);
        }
        let seconds = ((value % 60) + '').replace(/\.0+$/, '') + 's';
        if (value < 60) {
            return seconds;
        }
        return Math.trunc(value / 60) + 'm ' + (seconds == 's'? '0s' : seconds);
    }

    applyStatusByTime(job: Job) {
        if (job.parent && job.parent.jobRuns && job.parent.jobRuns.length > 0 && job.status != JobStatus.InProgress) {
            if (!job.jobRuns || job.jobRuns.length == 0) {
                job.status = JobStatus.NotExecuted;
            } else if (job.jobRuns[0].startTimeMillis < job.parent.jobRuns[0].endTimeMillis) {
                job.status = JobStatus.NotExecuted;
            } else  if (job.parent.status == JobStatus.NotExecuted) {
                job.status = JobStatus.NotExecuted;
            }
        }
        if (job.isWaitingBuild && job.status == JobStatus.InProgress) {
            job.isWaitingBuild = false;
        }
        if (job.isWaitingToStop && job.status != JobStatus.InProgress) {
            job.isWaitingToStop = false;
        }
        if (job.next) {
            job.next.forEach(next => this.applyStatusByTime(next));
        }
    }

    async updateDeployJob(pipeline: Pipeline, job: Job) {
        let jobState = await this.jenkinsService.getJobState(job);
        let build = job.isDeploying? jobState.builds[0].number : Number(job.jobRuns[0].id);
        if (build <= job.minJobRun) {
            return;
        }
        let jobRunState = await this.jenkinsService.getJobRunState(job, build);
        if (job.isDeploying) {
            if (this.hasSameParameters(job.actualParameters, jobRunState.actions.find(x => !!x.parameters).parameters)) {
                job.isDeploying = false;
                let jobRun: JobRun = {
                    id: String(build),
                    name: '#' + build,
                    status: JobStatus.InProgress,
                    startTimeMillis: jobRunState.timestamp,
                    stages: []
                }
                if (!job.jobRuns) {
                    job.jobRuns = [];
                }
                job.jobRuns.unshift(jobRun);
                job.status = JobStatus.InProgress;
                job.isWaitingBuild = false;
                EventService.emitter.emit({ type: EventType.OpenLogView, data: { job, jobRun } });
            }
        } else if (jobRunState.result) {
            job.jobRuns[0].status = jobRunState.result;
            job.status = job.jobRuns[0].status;
        }
    }

    private hasSameParameters(askedParameters: { [key: string]: string }, runParameters: JobRunParameter[]) {
        for (let parameter of runParameters) {
            if (!askedParameters[parameter.name] || askedParameters[parameter.name] != parameter.value) {
                return false;
            }
        }
        return true;
    }

    increaseDurations() {
        for (let pipeline of this.builder.pipelines) {
            if (pipeline.jobs) {
                for (let job of pipeline.jobs) {
                    if (job.duration) {
                        job.duration += 1000;
                        job.text = this.getDurationLeft(job);
                    }
                    if (job.jobRuns) {
                        for (let jobRun of job.jobRuns) {
                            for (let stage of jobRun.stages) {
                                if (stage.status == JobStatus.InProgress) {
                                    stage.durationMillis += 1000;
                                    if (stage.stageFlowNodes) {
                                        for (let node of stage.stageFlowNodes) {
                                            if (node.status == JobStatus.InProgress) {
                                                node.durationMillis += 1000;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    private setUnknownStatus(pipeline: Pipeline) {
        for (let job of pipeline.jobs) {
            job.status = JobStatus.Unknown; job.statusLeft = JobStatus.Unknown; job.statusRight = JobStatus.Unknown;
            job.text = ''; job.jobRuns = undefined; job.duration = undefined;
        }
        for (let slice of pipeline.slices) {
            for (let connector of slice.connectors) {
                connector.status = connector.jobRight.status;
            }
        }
    }

}
