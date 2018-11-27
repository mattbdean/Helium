import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from '../core/auth-guard/auth-guard.service';
import { ErdViewerComponent } from './erd-viewer/erd-viewer.component';

const routes: Routes = [
    {
        path: 'erd/:schema', component: ErdViewerComponent,
        canActivate: [ AuthGuard ]
    },
];

@NgModule({
    imports: [
        RouterModule.forChild(routes)
    ],
    exports: [
        RouterModule
    ]
})
export class ErdRoutingModule {}
