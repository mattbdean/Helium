import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { FormHostComponent } from './form-host.component';

const routes: Routes = [
    { path: 'forms', component: FormHostComponent },
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
