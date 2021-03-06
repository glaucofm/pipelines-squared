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
            error: undefined
        };
    }

    savePipeline(editingPipeline: EditingPipeline) {
        editingPipeline.error = this.validatePipeline(editingPipeline);
        if (editingPipeline.error) {
            return;
        }
        let pipeline: PipelineDefinition = {
            id: editingPipeline.id,
            name: editingPipeline.name,
            jobs: JSON.parse(editingPipeline.jobsText)
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

    validatePipeline(editingPipeline: EditingPipeline): string {
        let jobs: JobDefinition[] = [];
        try {
            jobs = JSON.parse(editingPipeline.jobsText);
        } catch (e) {
            return e.toString();
        }
        if (!editingPipeline.name) {
            return 'Pipeline name is mandatory';
        }
        if (!jobs) {
            return 'Pipeline has no jobs';
        }
        for (let job of jobs) {
            if (!job.name) {
                return 'All jobs must have a name';
            }
            if (!job.url || !job.url.startsWith('http')) {
                return 'Job ' + job.name + ' is missing url or it is invalid';
            }
            if (!this.config.jenkins.find(x => job.url.startsWith(x.server))) {
                return 'Job ' + job.name + ' url matches no configured jenkins connection';
            }
            if (job.next) {
                for (let next of job.next) {
                    if (!jobs.find(x => x.name == next)) {
                        return 'Job ' + job.name + ' points as next ' + next + ', but that job is missing';
                    }
                }
            }
            if (job.parameters) {
                for (let parameter of job.parameters) {
                    if (!parameter.name) {
                        return 'Job ' + job.name + ' has a parameter missing name';
                    }
                    if (parameter.value && parameter.options) {
                        return 'Job ' + job.name + ', parameter ' + parameter.name + ' has both "value" and "options" and that is invalid.';
                    }
                }
            }
        }
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
    error: string;
}

