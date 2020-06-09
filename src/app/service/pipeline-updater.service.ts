import {Injectable} from '@angular/core';
import {JenkinsService} from "./jenkins.service";
import {ApplicationEvent, EventType, Job, JobRun, JobStatus, Pipeline, Stage, UpdateFrequency} from "../model/types";
import {EventService} from "./event.service";
import {PipelineBuilderService} from "./pipeline-builder.service";

@Injectable({
    providedIn: 'root'
})
export class PipelineUpdaterService {

    private isUpdating: { [key: number]: boolean } = {};
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
                this.intervals.hf = setInterval(() => this.updatePipelines(UpdateFrequency.Low), 30000);
                clearInterval(this.intervals.lf);
                this.intervals.lf = setInterval(() => this.updatePipelines(UpdateFrequency.High), 2500);
            }
        });
    }

    async updatePipelines(frequency: UpdateFrequency) {
        if (this.isUpdating[frequency]) {
            return;
        }
        this.isUpdating[frequency] = true;
        try {
            for (let pipeline of this.builder.pipelines) {
                if (pipeline.jobs) {
                    for (let job of pipeline.jobs.filter(x => x.updateFrequency == frequency || (!x.updateFrequency && frequency == UpdateFrequency.Low))) {
                        console.log(job.name + (job.updateFrequency == 1? ' HF' : ''));
                        await this.updateJob(pipeline, job);
                        if (job.updateFreqStepTime && job.updateFreqStepTime < Date.now()) {
                            job.updateFrequency = UpdateFrequency.Low;
                            job.updateFreqStepTime = undefined;
                            console.log(job.name, '----> LF');
                        }
                    }
                }
            }
        } catch (e) {
            console.log(e);
        } finally {
            this.isUpdating[frequency] = false;
        }
    }

    async applyJobState(pipeline: Pipeline, job: Job) {
        this.applyStatusByTime(job);
        this.updateJobDuration(job);
        EventService.emitter.emit({ type: EventType.PipelineRefresh, data: pipeline });
    }

    async updateJob(pipeline: Pipeline, job: Job) {
        if (job.isDeploy) {
            return;
        } else if (!job.jobRuns || job.jobRuns.length == 0) {
            await this.updateJobFull(pipeline, job);
            this.applyJobState(pipeline, job);
        } else {
            let jobState = await this.jenkinsService.getJobState(job);
            if (jobState.lastBuild.number > Number(job.jobRuns[0].id)) {
                await this.updateJobFull(pipeline, job);
            } else if (jobState.lastBuild.number != jobState.lastCompletedBuild.number || job.jobRuns[0].status == JobStatus.InProgress) {
                await this.updateJobPartially(pipeline, job, jobState.lastBuild.number);
            }
            this.applyJobState(pipeline, job);
        }
    }

    async updateJobFull(pipeline: Pipeline, job: Job) {
        await this.updateJobRuns(pipeline, job);
    }

    async updateJobPartially(pipeline: Pipeline, job: Job, build: number) {
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

    public async updateJobRuns(pipeline: Pipeline, job: Job): Promise<JobRun[]> {
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

}
