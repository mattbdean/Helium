import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TableHostComponent } from './table-host.component';

const routes: Routes = [
    { path: 'tables', component: TableHostComponent },
    { path: 'tables/:name', component: TableHostComponent }
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
