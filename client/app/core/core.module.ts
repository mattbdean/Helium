import { AuthGuard } from './auth-guard/auth-guard.service';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { AuthService } from './auth/auth.service';
import { StorageService } from './storage/storage.service';

import { InlineSVGModule } from "ng-inline-svg";

import { MatIconModule } from '@angular/material';
import { RouterModule } from "@angular/router";
import { ConstraintIconsComponent } from "./constraint-icons/constraint-icons.component";
import { TableNameComponent } from './table-name/table-name.component';
import { TableService } from './table/table.service';

@NgModule({
    imports: [
        CommonModule,
        InlineSVGModule,
        HttpClientModule,
        MatIconModule,
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
    providers: [
        AuthGuard,
        AuthService,
        TableService,
        StorageService
    ]
})
export class CoreModule {
}
