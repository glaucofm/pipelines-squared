import {EventEmitter, Injectable} from '@angular/core';
import {ApplicationEvent, ElectronRequest, ElectronResponse, EventType} from "../model/types";
import {EventService} from "./event.service";
const electron = (<any>window).require('electron');

@Injectable({ providedIn: 'root' })
export class IpcService {

    private emitter = new EventEmitter<ApplicationEvent>();

    constructor() {
        electron.ipcRenderer.on('jenkins-response', (event, data) => {
            if (data.method == 'POST') {
                console.log(data);
            }
            this.emitter.emit(data);
        });
    }

    public request(request: ElectronRequest): Promise<ElectronResponse> {
        let _this = this;
        request.id = Math.random() + '';
        return new Promise(function(resolve, reject) {
            _this.emitter.subscribe((event: ElectronResponse) => {
                if (event.id === request.id) {
                    resolve(event);
                }
            });
            _this.send(request);
        });
    }

    private send(request: ElectronRequest): void {
        electron.ipcRenderer.send('jenkins-request', request);
    }

}
