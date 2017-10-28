import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FormHostComponent } from './form-host/form-host.component';

const routes: Routes = [
    { path: 'forms', redirectTo: '/tables', pathMatch: 'full' },
    { path: 'forms/:name', component: FormHostComponent },
];

@NgModule({
    imports: [
        RouterModule.forChild(routes)
    ],
    exports: [
        RouterModule
    ]
})
export class FormRoutingModule {}
