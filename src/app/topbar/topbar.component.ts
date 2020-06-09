import {Component} from '@angular/core';
import {ConfigurationService} from "../service/configuration.service";
import {Jenkins, Job, JobDefinition, JobParameter, Pipeline, PipelineDefinition} from "../model/types";
import {PipelineBuilderService} from "../service/pipeline-builder.service";
import {pipe} from "rxjs";

@Component({
    selector: 'app-topbar',
    templateUrl: './topbar.component.html',
    styleUrls: ['./topbar.component.css']
})
export class TopbarComponent {

    jenkinses: Jenkins[] = [];
    editingPipeline: EditingPipeline;

    editorOptions: {
        folding: false,
        lineNumbers: false
    };

    pipelineSchema = {
        uri: 'http://custom/schema.json',
        schema: {
            type: 'array',
            items: {
                type: 'object',
                required: [ 'name', 'url' ],
                properties: {
                    name: { type: 'string' },
                    url:  { type: 'string' },
                    next: {
                        type: 'array',
                        items: { type: 'string' }
                    },
                    isDeploy: { type: 'boolean' },
                    parameters: {
                        type: 'array',
                        items: {
                            type: 'object',
                            required: [ 'name' ],
                            properties: {
                                name: { type: 'string' },
                                fixedValue: { type: 'boolean' },
                                value: { type: 'string' },
                                options: {
                                    type: 'array',
                                    items: {
                                        type: 'string',
                                    }
                                },
                            }
                        }
                    },
                }
            }
        }
    };

    samplePipeline: JobDefinition[] = [
        {
            name: 'my-job-A',
            url: 'http://my-jenkins-server.my-company.com:8080/job/my-job-A-v21-1-1',
            next: [ 'my-job-B' ]
        },
        {
            name: 'my-job-B',
            url: 'http://my-jenkins-server.my-company.com:8080/job/my-job-B-v21-1-1',
            next: [ 'my-job-C' ]
        },
        {
            name: 'my-job-C',
            url: 'http://my-jenkins-server.my-company.com:8080/job/my-job-C-v21-1-1',
            isDeploy: true,
            parameters: [
                {
                    name: 'my-parameter-1',
                    fixedValue: true,
                    value: 'some-fixed-value'
                },
                {
                    name: 'my-parameter-2',
                    options: [ 'my-option-1' , 'my-option-2' ]
                }
            ]
        },
    ];

    constructor(public config: ConfigurationService,
                public builder: PipelineBuilderService) {
    }

    newJenkins() {
        this.jenkinses.push({ server: '', username: '', token: '' });
    }

    manageJenkins() {
        this.jenkinses = this.config.jenkins;
        if (this.jenkinses.length == 0) {
            this.newJenkins();
        }
    }

    saveJenkins() {
        this.jenkinses = this.jenkinses.filter(x => x.server && x.server.length);
        this.config.jenkins = this.jenkinses;
        this.config.save();
        this.jenkinses= [];
    }

    removeJenkins(jenkins: Jenkins) {
        this.jenkinses = this.jenkinses.filter(x => x.server != jenkins.server);
    }

    togglePipeline(pipeline: PipelineDefinition) {
    }

    editPipeline(pipeline: PipelineDefinition = null) {
        this.editingPipeline = {
            id: pipeline ? pipeline.id : String(Math.random() * 1000000000),
            name: pipeline ? pipeline.name : '',
            jobsText: JSON.stringify(pipeline ? pipeline.jobs : this.samplePipeline, null, 2),
            editorModel: undefined
            // editorModel: {
            //     language: 'json',
            //     uri: 'main.json',
            //     value: JSON.stringify(pipeline ? pipeline.jobs : this.samplePipeline, null, 2),
            //     schemas: [ this.pipelineSchema ]
            // }
        };
    }

    savePipeline(editingPipeline: EditingPipeline) {
        // TODO: error handling
        let pipeline: PipelineDefinition = {
            id: editingPipeline.id,
            name: editingPipeline.name,
            jobs: JSON.parse(editingPipeline.jobsText)
            // jobs: JSON.parse(editingPipeline.editorModel.value)
        };
        let existingPipelineIndex = this.config.pipelines.findIndex(x => x.id == pipeline.id);
        if (existingPipelineIndex < 0) {
            this.config.pipelines.push(pipeline);
        } else {
            this.config.pipelines.splice(existingPipelineIndex, 1, pipeline);
        }
        this.config.save();
        this.editingPipeline = undefined;
        this.builder.buildPipelines();
    }

    deletePipeline(editingPipeline: EditingPipeline) {
        this.config.pipelines = this.config.pipelines.filter(x => x.id != editingPipeline.id);
        this.config.save();
        this.editingPipeline = undefined;
        this.builder.buildPipelines();
    }

    pipelineEdited(event) {
        console.log(event);
    }

}

interface EditingPipeline {
    id: string;
    name: string;
    jobsText: string,
    editorModel: EditorModel;
}

interface EditorModel {
    language: string;
    uri: string;
    value: string;
    schemas: any;
}
