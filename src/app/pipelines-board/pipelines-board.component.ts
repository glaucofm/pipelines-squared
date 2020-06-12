import {Component} from '@angular/core';
import {ApplicationEvent, EventType, Job, JobParameter, JobRun, JobStatus, Pipeline, Stage} from "../model/types";
import {ConfigurationService} from "../service/configuration.service";
import {EventService} from "../service/event.service";
import * as moment from "moment";
import {PipelineBuilderService} from "../service/pipeline-builder.service";
import {PipelineUpdaterService} from "../service/pipeline-updater.service";
import {JenkinsService} from "../service/jenkins.service";

@Component({
    selector: 'pipelines-board',
    templateUrl: 'pipelines-board.component.html',
    styleUrls: ['pipelines-board.component.css']
})
export class PipelinesBoardComponent {

    pipelinesMaxWidth: number;
    pipelineDetailWidth: { [key: string]: number } = {};
    selectedJobs: { [key: string]: Job[] } = {};
    openStages: { [key: string]: { [key: string]: { [key: string]: {} } } } = {};
    selectedJobRun: { [key: string]: number } = {};
    log: Log;

    public jobToBuild: {
        job: Job;
        parameters: JobParameter[];
    };

    constructor(public config: ConfigurationService,
                public builder: PipelineBuilderService,
                public updater: PipelineUpdaterService,
                public jenkins: JenkinsService) {
        this.subscribeToEvents();
        builder.buildPipelines();
    }

    subscribeToEvents() {
        EventService.emitter.subscribe((event: ApplicationEvent) => {
            if (event.type === EventType.PipelineRefresh) {
                this.builder.calculateStatus(event.data);
                this.adjustDetailBoxWidth(event.data);
            }
            if (event.type === EventType.PipelineBuilt) {
                this.pipelinesMaxWidth = Math.max(...this.builder.pipelines.map(x => x.width));
            }
            if (event.type === EventType.OpenLogView) {
                this.viewLog(event.data.job, event.data.jobRun);
            }
        });
    }

    selectJob(pipeline: Pipeline, job: Job) {
        if (!job.jobRuns)
            return;
        this.pipelineDetailWidth[pipeline.id] = this.pipelinesMaxWidth;
        this.selectedJobRun[pipeline.id + job.name] = 0;
        if (!this.selectedJobs[pipeline.name]) {
            this.selectedJobs[pipeline.name] = [];
        }
        if (this.selectedJobs[pipeline.name].find(x => x.name == job.name)) {
            this.selectedJobs[pipeline.name] = this.selectedJobs[pipeline.name].filter(x => x.name != job.name);
        } else {
            this.selectedJobs[pipeline.name].push(job);
        }
        this.adjustDetailBoxWidth(pipeline);
    }

    adjustDetailBoxWidth(pipeline: Pipeline, isTimed = false) {
        if (!isTimed) {
            let _this = this;
            setTimeout(() => {
                _this.adjustDetailBoxWidth(pipeline, true);
            }, 100);
            return;
        }
        if (!this.selectedJobs[pipeline.name] || this.selectedJobs[pipeline.name].length == 0) {
            this.pipelineDetailWidth[pipeline.id] = this.pipelinesMaxWidth;
        }
        let elements = document.getElementsByClassName('stages ' + pipeline.id);
        let totalStagesWidth = 0;
        for (let i = 0; i < elements.length; i++) {
            totalStagesWidth += elements[i].getBoundingClientRect().width;
        }
        this.pipelineDetailWidth[pipeline.id] = Math.max(totalStagesWidth, this.pipelinesMaxWidth);
    }

    formatDuration(duration: number): string {
        return this.updater.formatDuration(duration);
    }

    openOrCloseStageNode(pipeline: Pipeline, job: Job, stage: Stage) {
        if (this.openStages[pipeline.name] && this.openStages[pipeline.name][job.name] && this.openStages[pipeline.name][job.name][stage.id]) {
            delete this.openStages[pipeline.name][job.name][stage.id];
        } else {
            if (!this.openStages[pipeline.name]) this.openStages[pipeline.name] = {};
            if (!this.openStages[pipeline.name][job.name]) this.openStages[pipeline.name][job.name] = {};
            this.openStages[pipeline.name][job.name][stage.id] = true;
        }
        this.adjustDetailBoxWidth(pipeline);
    }

    isStageOpen(pipeline: Pipeline, job: Job, stage: Stage) {
        return this.openStages[pipeline.name] && this.openStages[pipeline.name][job.name] && this.openStages[pipeline.name][job.name][stage.id];
    }

    getNodeText(node: Stage) {
        if (node.name == 'Use a tool from a predefined Tool Installation') {
            return 'Install ' + node.parameterDescription;
        } else if (node.name.startsWith('Fetches the environment variables')) {
            return 'Set env vars';
        } else {
            return node.name.length > 30? node.name.substring(0, 30) + '...' : node.name;
        }
    }

    formatDate(epochMillis: number) {
        return moment(epochMillis).format('YYYY-MM-DD HH:mm:ss')
    }

    getPipelineDetailWidth(pipeline: Pipeline) {
        return this.pipelineDetailWidth[pipeline.name]? this.pipelineDetailWidth[pipeline.name] : this.pipelinesMaxWidth;
    }

    mouseEnterJob(job: Job, item: 'circle' | 'detail-title') {
        if (item == 'circle')       job.isHoveringCircle = true;
        if (item == 'circle')       job.isHoveringAction = true;
        if (item == 'detail-title') job.isHoveringDetail = true;
    }

    mouseLeaveJob(job: Job, item: 'circle' | 'detail-title' | 'action') {
        if (item == 'circle')       setTimeout(() => { job.isHoveringCircle = false }, 100);
        if (item == 'circle')       setTimeout(() => { job.isHoveringAction = false }, 500);
        if (item == 'detail-title') setTimeout(() => { job.isHoveringDetail = false }, 100);
    }

    canBuild(job: Job) {
        return job.status != JobStatus.InProgress && job.status != JobStatus.PausedPendingInput;
    }

    async buildJob(job: Job, parameters: JobParameter[] = null) {
        if (!parameters && job.parameters) {
            this.jobToBuild = {
                job: job,
                parameters: JSON.parse(JSON.stringify(job.parameters))
            };
            this.jobToBuild.parameters.forEach(x => x.options && x.options.length? x.selectedOption = x.options[0] : undefined);
        } else {
            if (job.isDeploy) {
                let parameters = this.jobToBuild.parameters.map(x => { return [x.name, x.value? x.value : x.selectedOption] });
                this.jenkins.runDeploy(job, parameters);
                this.jobToBuild = undefined;
                job.isWaitingBuild = true;
                job.isDeploying = true;
                job.actualParameters = {};
                parameters.forEach(x => job.actualParameters[x[0]] = x[1]);
                this.updater.setHighFrequency(job, 60);
            } else {
                this.jenkins.runJob(job);
                this.jobToBuild = undefined;
                job.isWaitingBuild = true;
                this.updater.setHighFrequency(job, 60);
            }
        }
    }

    canStop(job: Job) {
        return job.status == JobStatus.InProgress;
    }

    async stopJob(job: Job) {
        job.isWaitingToStop = true;
        await this.jenkins.stopJob(job, Number(job.jobRuns[0].id));
    }

    async viewLog(job: Job, jobRun: JobRun, node: Stage = null) {
        this.log = {
            name: job.name + ' ' + jobRun.name + (node? ' ' + node.name : ''),
            build: Number(jobRun.id),
            text: 'Loading...',
        };
        setTimeout(() => {
            this.updateLogView(job, node);
        }, 100);
    }

    async updateLogView(job: Job, node: Stage) {
        if (!this.log) {
            return;
        }
        let doScroll = false;
        let logDiv = document.getElementById("prelog");
        if (logDiv.innerText == '') {
            logDiv.innerText = 'Loading...';
        }
        if (node) {
            let nodeLog = await this.jenkins.getNodeLog(job, this.log.build, Number(node.id));
            doScroll = logDiv.scrollTop + logDiv.clientHeight == logDiv.scrollHeight;
            logDiv.innerText = nodeLog.text
        } else {
            let logText = await this.jenkins.getJobLog(job, this.log.build);
            if (logDiv.innerText == 'Loading...') {
                logDiv.innerText = '';
            }
            if (logText.length > logDiv.innerText.length) {
                doScroll = logDiv.scrollTop + logDiv.clientHeight == logDiv.scrollHeight;
                logDiv.innerText = logText
            }
        }
        setTimeout(() => {
            if (doScroll) {
                logDiv.scrollTop = logDiv.scrollHeight;
            }
        }, 100);
        setTimeout(() => this.updateLogView(job, node), 5000);
    }

    getWindowHeight() {
        return window.innerHeight;
    }
}

interface Log {
    name: string;
    build: number;
    text: string;
}
