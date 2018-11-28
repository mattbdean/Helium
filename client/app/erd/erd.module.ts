import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatButtonModule, MatDialogModule, MatIconModule, MatProgressBarModule } from '@angular/material';
import { CoreModule } from '../core/core.module';
import { ErdHelpComponent } from './erd-help/erd-help.component';
import { ErdRenderingService } from './erd-rendering.service';
import { ErdRoutingModule } from './erd-routing.module';
import { ErdStyleService } from './erd-style.service';
import { ErdViewerComponent } from './erd-viewer/erd-viewer.component';

@NgModule({
    imports: [
        CommonModule,
        MatButtonModule,
        MatProgressBarModule,
        MatIconModule,
        MatDialogModule,
        CoreModule,
        ErdRoutingModule
    ],
    declarations: [
        ErdHelpComponent,
        ErdViewerComponent
    ],
    providers: [
        ErdRenderingService,
        ErdStyleService
    ],
    entryComponents: [
        ErdHelpComponent
    ]
})
export class ErdModule {}
