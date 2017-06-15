import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { DynamicFormComponent } from './dynamic-form.component';

const routes: Routes = [
    { path: 'forms', component: DynamicFormComponent },
];

@NgModule({
    imports: [
        RouterModule.forChild(routes)
    ],
    exports: [
        RouterModule
    ]
})
export class DynamicFormRoutingModule {}
