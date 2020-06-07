import {Component} from '@angular/core';
import {ConfigurationService} from "../service/configuration.service";
import {Jenkins, Pipeline, PipelineDefinition} from "../model/types";
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
                required: [ 'name', 'url', 'next' ],
                properties: {
                    name: { type: 'string' },
                    url:  { type: 'string' },
                    next: {
                        type: 'array',
                        items: { type: 'string' }
                    },
                }
            }
        }
    };

    samplePipeline = [
        {
            name: 'my-job-A',
            url: 'http://my-jenkins-server.my-company.com:8080/job/my-job-A',
            next: [ 'my-job-B' ]
        },
        {
            name: 'my-job-B',
            url: 'http://my-jenkins-server.my-company.com:8080/job/my-job-B',
        },
    ];

    constructor(public config: ConfigurationService) {
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
            editorModel: {
                language: 'json',
                uri: 'main.json',
                value: JSON.stringify(pipeline ? pipeline.jobs : this.samplePipeline, null, 2),
                schemas: [ this.pipelineSchema ]
            }
        };
    }

    savePipeline() {
    }

    pipelineEdited(event) {
        console.log(event);
    }

}

interface EditingPipeline {
    id: string;
    name: string;
    editorModel: EditorModel;
}

interface EditorModel {
    language: string;
    uri: string;
    value: string;
    schemas: any;
}
