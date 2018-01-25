import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from '../core/auth-guard/auth-guard.service';
import { TableHostComponent } from './table-host/table-host.component';

const routes: Routes = [
    {
        path: 'tables',
        children: [
            { path: ':schema/:table', component: TableHostComponent },
            { path: '', component: TableHostComponent }
        ],
        canActivate: [ AuthGuard ]
    }
];

@NgModule({
    imports: [
        RouterModule.forChild(routes)
    ],
    exports: [
        RouterModule
    ]
})
export class TableRoutingModule {}
