import {ElectronResponse, JenkinsJobRun, Job, JobRun, JobStatus, NodeLog, Stage} from "../model/types";
import {Injectable} from "@angular/core";
import {ConfigurationService} from "./configuration.service";
import {IpcService} from "./ipc.service";

@Injectable()
export class JenkinsService {

    private useMock = false;
    private mockIndex = 1;
    private useElectron = true;

    constructor(private config: ConfigurationService,
                private ipcService: IpcService) {
        if (this.useMock) {
            setInterval(() => {
                this.mockIndex += this.mockIndex < 0? 1 : 10;
                if (this.mockIndex > 1450) {
                    this.mockIndex = 1;
                }
                console.log(Math.trunc(this.mockIndex/10 + 1));
            }, 2000);
        }
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

    public async runDeploy(job: Job, parameters: string[][]): Promise<any> {
        let jobState = await this.getJobState(job);
        job.minJobRun = jobState.builds[0].number;
        let formdata = 'json={ parameter: [ ' + parameters.map(x => '{name: "' + escape(x[0]) + '", value: "' + escape(x[1]) + '"}').join(', ') + '] }';
        return await this.doPost(job.url + '/build?' + formdata, null, null);
    }

    public async getJobLog(job: Job, build: number): Promise<string> {
        let response: ElectronResponse = await this.getRaw(job.url + '/' + build + '/logText/progressiveText');
        return response.text;
    }

    public async getNodeLog(job: Job, build: number, node: number): Promise<NodeLog> {
        return await this.getJson(job.url + '/' + build + '/execution/node/' + node + '/wfapi/log');
    }

    private async getJson(url: string, params: { [key:string]: any } = null): Promise<any> {
        console.log('GET', url);
        if (this.useMock) {
            url = url.replace(/^.*\/job\//g, '');
            return (await fetch("http://localhost:8000/" + Math.trunc(this.mockIndex/10 + 1) + "/" + url.replace(/\//g, '_') + ".json")).json();
        }
        let headers = this.getStandardHeaders(url);
        let response = await this.ipcService.request({ method: 'GET', url, params, headers });
        if (response.error) {
            throw response.error;
        }
        return this.parse(response.text, url);
    }

    private async getRaw(url: string, params: { [key:string]: any } = null): Promise<ElectronResponse> {
        console.log('GET', url);
        if (this.useMock) {
            return {
                id: undefined,
                error: undefined,
                text: await (await fetch('http://localhost:8000/1/wfnpiorm-wfn-pi-gl-model-jar-23.0.0.0_wfapi_runs.json')).text(),
                headers: undefined
            }
        }
        let headers = this.getStandardHeaders(url);
        let response = await this.ipcService.request({ method: 'GET', url, params, headers });
        if (response.error) {
            // TODO: show error
        }
        return response;
    }

    private async doPost(url: string, params: { [key:string]: any } = null, data: {} = null): Promise<ElectronResponse> {
        console.log('POST', url);
        if (this.useMock) {
            console.log('POST', url, params, data);
            return;
        }
        let headers = this.getStandardHeaders(url);
        let response = await this.ipcService.request({ method: 'POST', url, params, headers, postData: data });
        if (response.error) {
            // TODO: show error
        }
        return response;
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

    private parse(text: string, identification: string): any {
        try {
            return JSON.parse(text);
        } catch (e) {
            console.error(identification, text);
            if (text.indexOf('<head>') >= 0) {
                let error1 = text.replace(/<title>(.*)<\/title>/g, '$1');
                let error2 = text.replace(/<body>(.*)<\/body>/gs, '$1');
                throw error1 + ': ' + error2;
            } else {
                throw e;
            }
        }
    }

}
