import {JenkinsJobRun, Job, JobRun, JobStatus, NodeLog, Stage} from "../model/types";
import {Injectable} from "@angular/core";
import {ConfigurationService} from "./configuration.service";

@Injectable()
export class JenkinsService {

    private useMock = true;
    private mockIndex = 1;

    constructor(private config: ConfigurationService) {
        setInterval(() => {
            this.mockIndex += this.mockIndex < 0? 1 : 10;
            if (this.mockIndex > 1450) {
                this.mockIndex = 1;
            }
            console.log(Math.trunc(this.mockIndex/10 + 1));
        }, 2000);
    }

    public async getJobState(job: Job): Promise<JenkinsJobRun> {
        return await this.getJson(job.url + '/api/json');
    }

    public async getJobRunState(job: Job, build: number): Promise<JenkinsJobRun> {
        return await this.getJson(job.url + '/' + build + '/api/json');
    }

    public async getWfJobRuns(job: Job): Promise<JobRun[]> {
        return await this.getJson( job.url + '/wfapi/runs', { fullStages: true });
    }

    public async getWfJobRun(job: Job, build: number): Promise<JobRun> {
        return await this.getJson( job.url + '/' + build + '/wfapi/describe', { fullStages: true });
    }

    public async getWfStage(job: Job, build: number, stageId: string): Promise<Stage> {
        return await this.getJson( job.url + '/' + build + '/execution/node/' + stageId + '/wfapi/describe', { fullStages: true });
    }

    public async runJob(job: Job): Promise<any> {
        return await this.doPost(job.url + '/build');
    }

    public async stopJob(job: Job, build: number): Promise<any> {
        return await this.doPost(job.url + '/' + build + '/stop');
    }

    public async getJobLog(job: Job, build: number, start: number): Promise<{ total: number, text: string }> {
        let response: any = await this.getRaw(job.url + '/' + build + '/logText/progressiveText', { start });
        let text = await response.text();
        let contentLength = (response.headers? Number(response.headers.get('Content-Length')) : 0);
        if (this.useMock) {
            text = text.substr(start, start + 100);
            contentLength = 100;
        }
        return {
            total: start + contentLength,
            text: text
        }
    }

    public async getNodeLog(job: Job, build: number, node: number): Promise<NodeLog> {
        return await this.getJson(job.url + '/' + build + '/execution/node/' + node + '/wfapi/log');
    }

    private async getJson(url: string, params: { [key:string]: any } = null): Promise<any> {
        // console.log(url + this.getParameters(params));
        if (this.useMock) {
            url = url.replace(/^.*\/job\//g, '');
            return (await fetch("http://localhost:8000/" + Math.trunc(this.mockIndex/10 + 1) + "/" + url.replace(/\//g, '_') + ".json")).json();
        }
        let headers = this.getStandardHeaders(url);
        return (await fetch(url + this.getParameters(params), { headers: headers })).json();
    }

    private async getRaw(url: string, params: { [key:string]: any } = null): Promise<Response> {
        // console.log(url + this.getParameters(params));
        if (this.useMock) {
            return await fetch('http://localhost:8000/1/wfnpiorm-wfn-pi-gl-model-jar-23.0.0.0_wfapi_runs.json');
        }
        let headers = this.getStandardHeaders(url);
        return await fetch(url + this.getParameters(params), { headers: headers });
    }

    private async doPost(url: string, params: { [key:string]: any } = null, data: {} = null): Promise<Response> {
        // console.log(url + this.getParameters(params));
        if (this.useMock) {
            return await fetch('http://localhost:8000/1/wfnpiorm-wfn-pi-gl-model-jar-23.0.0.0_wfapi_runs.json');
        }
        let headers = this.getStandardHeaders(url);
        return await fetch(url + this.getParameters(params), {
            method: 'POST',
            body: data? JSON.stringify(data) : null,
            headers: headers
        });
    }

    private getParameters(params: { [key:string]: any }) {
        return params? '?' + Object.getOwnPropertyNames(params).map(x => x + '=' + escape(params[x])).join('&') : '';
    }

    private getStandardHeaders(url: string) {
        return { Authorization: 'Basic ' + this.getAuthorization(url) };
    }

    private getAuthorization(url: string) {
        let config = this.config.jenkins.find(x => url.startsWith(x.server));
        return btoa(config.username + ':' + config.token);
    }

}
