import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import {
    MatButtonModule, MatFormFieldModule,
    MatIconModule,
    MatNativeDateModule, MatProgressBarModule,
    MatSelectModule,
    MatSidenavModule,
    MatToolbarModule
} from '@angular/material';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { CoreModule } from './core/core.module';
import { FormsModule } from './forms/forms.module';
import { LoginModule } from './login/login.module';
import { NotFoundComponent } from './not-found.component';
import { SidenavComponent } from './sidenav/sidenav.component';
import { TablesModule } from './tables/tables.module';

import '@angular/material/prebuilt-themes/deeppurple-amber.css';
import 'normalize.css/normalize.css';
import { ErdModule } from './erd/erd.module';

@NgModule({
    imports: [
        BrowserModule,
        BrowserAnimationsModule,
        CoreModule,
        CommonModule,
        ReactiveFormsModule,

        MatButtonModule,
        MatIconModule,
        MatFormFieldModule,
        MatNativeDateModule,
        MatToolbarModule,
        MatSelectModule,
        MatSidenavModule,
        MatProgressBarModule,

        LoginModule,
        TablesModule,
        FormsModule,
        ErdModule,
        AppRoutingModule
    ],
    declarations: [
        AppComponent,
        SidenavComponent,
        NotFoundComponent
    ],
    bootstrap: [ AppComponent ]
})
export class AppModule {}
