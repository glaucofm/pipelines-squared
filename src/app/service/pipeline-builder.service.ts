import {Injectable} from '@angular/core';
import {JenkinsService} from "./jenkins.service";
import {ConfigurationService} from "./configuration.service";
import {Connector, EventType, Job, JobRun, JobStatus, Pipeline, Slice, Stage} from "../model/types";
import {EventService} from "./event.service";
import {pipe} from "rxjs";

@Injectable({
    providedIn: 'root'
})
export class PipelineBuilderService {

    public pipelines: Pipeline[] = [];

    constructor(public config: ConfigurationService) {
    }

    public buildPipelines() {
        this.pipelines = [];
        for (let configPipeline of this.config.pipelines) {
            let pipeline = JSON.parse(JSON.stringify(configPipeline));
            this.buildPipeline(pipeline);
            this.pipelines.push(pipeline);
            EventService.emitter.emit({ type: EventType.PipelineBuilt, data: pipeline });
        }
        console.log('Building pipelines finished');
    }

    buildPipeline(pipeline: Pipeline) {
        pipeline.slices = this.buildSlices(pipeline);
        this.calculatePipelineDimensions(pipeline);
        this.calculateStatus(pipeline);
        pipeline.jobs = this.flatten(pipeline.slices.map(slice => slice.jobs));
    }

    buildSlices(pipeline: Pipeline): Slice[] {
        let rootJob = this.convertToHierarchy(pipeline.jobs[0], pipeline);
        let slices = this.convertToSlices(rootJob);
        this.calculateY(rootJob, 0);
        slices.forEach(slice => this.addSliceConnectors(slice));
        return slices;
    }

    calculatePipelineDimensions(pipeline: Pipeline): void {
        pipeline.height = Math.max(...this.flatten(pipeline.slices.map(slice => slice.jobs.map(job => (job.y + 1) * 130))));
        pipeline.width = pipeline.slices.map(slice => 142 + (!!slice.connectors.length? 48 : 0)).reduce((a, b) => a + b, 0);
    }

    convertToHierarchy(job, pipeline: Pipeline, parent=null): Job {
        job.parent = parent;
        if (job.next) {
            job.next = job.next.map(x => pipeline.jobs.find(y => y.name === x));
            job.next.forEach(x => this.convertToHierarchy(x, pipeline, job));
        } else {
            job.next = [];
        }
        return job;
    }

    convertToSlices(root: Job): Slice[] {
        let slices: Slice[] = [ {
            jobs: [ root ] }
        ];
        let parents: Job[] = [ root ];
        while (parents.length) {
            let children = this.flatten(parents.map(x => x.next)).filter(x => !!x);
            if (children.length) {
                slices.push({ jobs: children });
            }
            parents = children;
        }
        return slices;
    }

    calculateY(job, minY): number {
        job.y = minY;
        if (job.next && job.next.length) {
            for (let child of job.next) {
                let siblingY = this.calculateY(child, minY);
                minY = Math.max(siblingY, (child.maxChildY? child.maxChildY : 0)) + 1;
            }
            job.y = job.next.map(a => a.y).reduce((a, b) => a + b, 0) / job.next.length;
            job.maxChildY = job.next.map(x => x.maxChildY).reduce((a, b) => Math.max(a, b));
        } else {
            job.y = minY;
            job.maxChildY = job.y;
        }
        return job.y;
    }

    addSliceConnectors(slice: Slice): void {
        slice.connectors = [];
        if (slice.jobs.map(job => job.next.length).reduce((a, b) => Math.max(a, b)) > 1) {
            for (let job of slice.jobs) {
                for (let jobNext of job.next) {
                    slice.connectors.push(this.addConnector(job, jobNext));
                }
            }
        }
    }

    addConnector(jobLeft: Job, jobRight: Job): Connector {
        if (jobLeft.y > jobRight.y) {
            return this.addConnectorUp(jobLeft, jobRight);
        } else if (jobLeft.y < jobRight.y) {
            return this.addConnectorDown(jobLeft, jobRight);
        } else {
            return this.addConnectorRight(jobLeft, jobRight);
        }
    }

    addConnectorUp(jobLeft: Job, jobRight: Job): Connector {
        let delta = jobLeft.y * 130 - jobRight.y * 130;
        return {
            direction: "up",
            top: jobRight.y * 130,
            lineUpHeight: delta >= 50? delta - 50 : 0,
            lineRightUpHeight: delta < 50? 22 - (50 - delta) / 2 : undefined,
            lineUpRightHeight: delta < 50? 22 - (50 - delta) / 2 : undefined,
            jobLeft: jobLeft,
            jobRight: jobRight,
        };
    }

    addConnectorRight(jobLeft: Job, jobRight: Job): Connector {
        return {
            direction: "right",
            top: jobLeft.y * 130,
            jobLeft: jobLeft,
            jobRight: jobRight,
        };
    }

    addConnectorDown(jobLeft: Job, jobRight: Job): Connector {
        let delta = jobRight.y * 130 - jobLeft.y * 130;
        return {
            direction: "down",
            top: jobLeft.y * 130,
            lineUpHeight: delta >= 50? delta - 50 : 0,
            lineRightDownHeight: delta < 50? 22 - (50 - delta) / 2 : undefined,
            lineDownRightHeight: delta < 50? 22 - (50 - delta) / 2 : undefined,
            jobLeft: jobLeft,
            jobRight: jobRight,
        };
    }

    calculateStatus(pipeline: Pipeline) {
        for (let slice of pipeline.slices) {
            for (let job of slice.jobs) {
                job.statusLeft = job.status;
                job.statusRight = (job.next && job.next.length? job.next[job.next.length - 1].status : JobStatus.Success);
            }
            for (let connector of slice.connectors) {
                connector.status = connector.jobRight.status;
            }
        }
    }

    flatten(arr) {
        let _this = this;
        return arr.reduce(function (flat, toFlatten) {
            return flat.concat(Array.isArray(toFlatten) ? _this.flatten(toFlatten) : toFlatten);
        }, []);
    }

}
