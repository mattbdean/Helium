import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { CoreModule } from './core/core.module';
import { TableModule } from './table/table.module';

import { NotFoundComponent } from './not-found.component';

import '@angular/material/prebuilt-themes/deeppurple-amber.css';
import 'normalize.css/normalize.css';

@NgModule({
    imports: [
        BrowserModule,
        BrowserAnimationsModule,
        CoreModule,
        CommonModule,

        TableModule,
        AppRoutingModule
    ],
    declarations: [
        AppComponent,
        NotFoundComponent
    ],
    bootstrap: [ AppComponent ]
})
export class AppModule {}
