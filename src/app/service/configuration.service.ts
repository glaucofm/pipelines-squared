import {Injectable} from "@angular/core";
import {StorageService} from "./storage.service";
import {Jenkins, JobRun, JobStatus, Pipeline, PipelineDefinition} from "../model/types";

@Injectable()
export class ConfigurationService {

    public jenkins: Jenkins[] = [];
    public pipelines: PipelineDefinition[] = [];

    constructor() {
        this.load();
    }

    load() {
        let config = StorageService.load('config');
        if (!config) {
            this.save();
        } else {
            this.jenkins = config.jenkins;
            this.pipelines = config.pipelines;
        }
    }

    public save() {
        StorageService.save('config', { jenkins: this.jenkins, pipelines: this.pipelines });
    }

}

