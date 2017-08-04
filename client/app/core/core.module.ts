import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';

import { InlineSVGModule } from "ng-inline-svg";

import { RouterModule } from "@angular/router";
import { ConstraintIconsComponent } from "./constraint-icons.component";
import { TableService } from './table.service';

@NgModule({
    imports: [
        CommonModule,
        InlineSVGModule,
        HttpClientModule,
        RouterModule
    ],
    declarations: [
        ConstraintIconsComponent
    ],
    exports: [
        ConstraintIconsComponent
    ],
    providers: [TableService]
})
export class CoreModule {
}
