import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './../core/auth-guard.service';
import { TableHostComponent } from './table-host.component';

const routes: Routes = [
    {
        path: 'tables',
        children: [
            { path: ':name', component: TableHostComponent },
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
