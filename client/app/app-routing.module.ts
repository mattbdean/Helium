import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { NotFoundComponent } from './not-found.component';

const routes: Routes = [
    { path: '', redirectTo: '/forms', pathMatch: 'full' },
    { path: '**', component: NotFoundComponent }
];

@NgModule({
    imports: [
        RouterModule.forRoot(routes)
    ],
    exports: [
        RouterModule
    ]
})
export class AppRoutingModule {}
