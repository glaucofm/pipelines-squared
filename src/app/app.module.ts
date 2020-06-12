import {BrowserModule} from '@angular/platform-browser';
import {NgModule} from '@angular/core';

import {AppRoutingModule} from './app-routing.module';
import {AppComponent} from './app.component';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {MatCardModule} from '@angular/material';
import {TopbarComponent} from './topbar/topbar.component';
import {ButtonComponent} from './button/button.component';
import {ModalComponent} from './modal/modal.component';
import {FormsModule} from '@angular/forms';
import {MomentModule} from 'ngx-moment';
import {ConfigurationService} from "./service/configuration.service";
import {PipelinesBoardComponent} from "./pipelines-board/pipelines-board.component";
import {JenkinsService} from "./service/jenkins.service";
import {StorageService} from "./service/storage.service";
import {VarDirective} from "./model/ng-var.directive";
import {PipelineUpdaterService} from "./service/pipeline-updater.service";
import {PipelineBuilderService} from "./service/pipeline-builder.service";
import {IpcService} from "./service/ipc.service";

@NgModule({
    declarations: [
        AppComponent,
        TopbarComponent,
        ButtonComponent,
        ModalComponent,
        // directives
        VarDirective,
        // pages
        PipelinesBoardComponent
    ],
    imports: [
        BrowserModule,
        AppRoutingModule,
        BrowserAnimationsModule,
        MatCardModule,
        FormsModule,
        MomentModule,
    ],
    providers: [
        ConfigurationService,
        JenkinsService,
        StorageService,
        PipelineUpdaterService,
        PipelineBuilderService,
        IpcService
    ],
    bootstrap: [AppComponent]
})
export class AppModule {

    constructor(private pipelineUpdaterService: PipelineUpdaterService) {
    }
}
