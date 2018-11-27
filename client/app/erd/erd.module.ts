import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatButtonModule, MatIconModule, MatProgressBarModule } from '@angular/material';
import { CoreModule } from '../core/core.module';
import { ErdRoutingModule } from './erd-routing.module';
import { ErdViewerComponent } from './erd-viewer/erd-viewer.component';

@NgModule({
    imports: [
        CommonModule,
        MatButtonModule,
        MatProgressBarModule,
        MatIconModule,
        CoreModule,
        ErdRoutingModule
    ],
    declarations: [
        ErdViewerComponent
    ],
    providers: [

    ]
})
export class ErdModule {}
