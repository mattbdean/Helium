import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';

import { InlineSVGModule } from "ng-inline-svg";

import { MdIconModule } from '@angular/material';
import { RouterModule } from "@angular/router";
import { ConstraintIconsComponent } from "./constraint-icons.component";
import { TableNameComponent } from './table-name.component';
import { TableService } from './table.service';

@NgModule({
    imports: [
        CommonModule,
        InlineSVGModule,
        HttpClientModule,
        MdIconModule,
        RouterModule
    ],
    declarations: [
        ConstraintIconsComponent,
        TableNameComponent
    ],
    exports: [
        ConstraintIconsComponent,
        TableNameComponent
    ],
    providers: [TableService]
})
export class CoreModule {
}
