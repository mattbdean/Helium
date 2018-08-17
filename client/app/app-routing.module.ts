import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { environment } from '../environments/environment';
import { ErdComponent } from './erd/erd.component';
import { NotFoundComponent } from './not-found.component';

const routes: Routes = [
    { path: '', redirectTo: '/tables', pathMatch: 'full' },
    { path: 'erd', component: ErdComponent },
    { path: '**', component: NotFoundComponent }
];

@NgModule({
    imports: [
        RouterModule.forRoot(routes, { useHash: environment.preview })
    ],
    exports: [
        RouterModule
    ]
})
export class AppRoutingModule {}
