import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { HttpModule } from '@angular/http';

import { InlineSVGModule } from "ng-inline-svg";

import { RouterModule } from "@angular/router";
import { ConstraintIconsComponent } from "./constraint-icons.component";
import { TableService } from './table.service';

@NgModule({
    imports: [
        CommonModule,
        InlineSVGModule,
        HttpModule,
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
