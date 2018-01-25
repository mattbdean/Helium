import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from '../core/auth-guard/auth-guard.service';
import { FormHostComponent } from './form-host/form-host.component';

const routes: Routes = [
    {
        path: 'forms',
        children: [
            { path: ':schema/:table', component: FormHostComponent },
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
