import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import {
    MatButtonModule,
    MatIconModule,
    MatNativeDateModule,
    MatSidenavModule,
    MatToolbarModule
} from '@angular/material';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { CoreModule } from './core/core.module';
import { FormsModule } from './forms/forms.module';
import { TablesModule } from './tables/tables.module';

import { NotFoundComponent } from './not-found.component';

import '@angular/material/prebuilt-themes/deeppurple-amber.css';
import 'normalize.css/normalize.css';

@NgModule({
    imports: [
        BrowserModule,
        BrowserAnimationsModule,
        CoreModule,
        CommonModule,

        MatButtonModule,
        MatIconModule,
        MatNativeDateModule,
        MatToolbarModule,
        MatSidenavModule,

        TablesModule,
        FormsModule,
        AppRoutingModule
    ],
    declarations: [
        AppComponent,
        NotFoundComponent
    ],
    bootstrap: [ AppComponent ]
})
export class AppModule {}
