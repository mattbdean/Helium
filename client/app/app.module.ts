import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import {
    MdButtonModule,
    MdIconModule,
    MdNativeDateModule,
    MdSidenavModule,
    MdToolbarModule
} from '@angular/material';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { CoreModule } from './core/core.module';
import { DynamicFormModule } from './dynamic-form/dynamic-form.module';
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

        MdButtonModule,
        MdIconModule,
        MdNativeDateModule,
        MdToolbarModule,
        MdSidenavModule,

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
