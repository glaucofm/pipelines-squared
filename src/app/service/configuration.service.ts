import {Injectable} from "@angular/core";
import {StorageService} from "./storage.service";
import {Jenkins, JobStatus, Pipeline, PipelineDefinition} from "../model/types";

@Injectable()
export class ConfigurationService {

    public jenkins: Jenkins[] = [];

    public pipelines: PipelineDefinition[] = [
        {
            id: '1',
            name: 'WFN PI GL',
            jobs: [
                {
                    name: 'wfn-pi-gl-modal',
                    url: 'http://cdlmasdevops1.es.ad.adp.com:8080/job/wfnpiorm-wfn-pi-gl-model-jar-23.0.0.0',
                    next: [ 'wfn-pi-gl-service' ],
                },
                {
                    name: 'wfn-pi-gl-service',
                    url: 'http://cdlmasdevops1.es.ad.adp.com:8080/job/wfnpiorm-wfn-pi-gl-services-jar-23.0.0.0',
                    next: [ 'wfn-pi-gl-ms', 'wfn-pi-gl-batch' ],
                },
                {
                    name: 'wfn-pi-gl-ms',
                    url: 'http://cdlmasdevops1.es.ad.adp.com:8080/job/wfnpipaymod-wfn-pi-gl-ms-jar-23.0.0.0',
                    next: [ 'wfn-pi-gl-ms-sb' ],
                },
                {
                    name: 'wfn-pi-gl-ms-sb',
                    url: 'http://cdlmasdevops1.es.ad.adp.com:8080/job/wfnpipaymod-wfn-pi-gl-sb-sb-docker-23.0.0.0',
                    next: [ 'Deploy API' ],
                },
                {
                    name: 'Deploy API',
                    url: undefined,
                },
                {
                    name: 'wfn-pi-gl-batch',
                    url: 'http://cdlmasdevops1.es.ad.adp.com:8080/job/wfnpipaymod-wfn-pi-gl-batch-ms-jar-23.0.0.0',
                    next: [ 'wfn-pi-gl-batch-sb' ],
                },
                {
                    name: 'wfn-pi-gl-batch-sb',
                    url: 'http://cdlmasdevops1.es.ad.adp.com:8080/job/wfnpipaymod-wfn-pi-gl-batch-sb-sb-docker-23.0.0.0',
                    next: [ 'Deploy Batch' ],
                },
                {
                    name: 'Deploy Batch',
                    url: undefined,
                },
            ],
        },
        // {
        //     id: '2',
        //     name: 'WFN TURBO PI',
        //     definition: [
        //         {
        //             name: 'wfn-turbo-pi-modal',
        //             next: [ 'wfn-turbo-pi-service' ],
        //             status: JobStatus.NotExecuted
        //         },
        //         {
        //             name: 'wfn-turbo-pi-service',
        //             next: [ 'wfn-turbo-pi-ms' ],
        //             status: JobStatus.NotExecuted
        //         },
        //         {
        //             name: 'wfn-turbo-pi-ms',
        //             next: [ 'wfn-turbo-pi-sb' ],
        //             status: JobStatus.NotExecuted
        //         },
        //         {
        //             name: 'wfn-turbo-pi-sb',
        //             next: [ 'Deploy' ],
        //             status: JobStatus.NotExecuted
        //         },
        //         {
        //             name: 'Deploy',
        //             status: JobStatus.NotExecuted
        //         },
        //     ],
        //     slices: null,
        // }
    ];

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

    save() {
        StorageService.save('config', { jenkins: this.jenkins, pipelines: this.pipelines });
    }

}

