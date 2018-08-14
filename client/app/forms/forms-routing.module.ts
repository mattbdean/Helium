import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from '../core/auth-guard/auth-guard.service';
import { FormHostComponent } from './form-host/form-host.component';
import { FormsGuard } from './forms-guard/forms-guard.service';

const routes: Routes = [
    {
        path: 'forms',
        children: [
            { path: ':schema/:table', component: FormHostComponent, canActivate: [ FormsGuard ] },
            { path: '', redirectTo: '/tables', pathMatch: 'full' }
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
export class FormRoutingModule {}
