import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import {
    MatFormFieldModule, MatIconModule,
    MatInputModule
} from '@angular/material';
import { RouterModule } from "@angular/router";
import { InlineSVGModule } from 'ng-inline-svg';
import { AuthGuard } from './auth-guard/auth-guard.service';
import { AuthService } from './auth/auth.service';
import { ConstraintIconsComponent } from "./constraint-icons/constraint-icons.component";
import { DatetimeInputComponent } from './datetime-input/datetime-input.component';
import { StorageService } from './storage/storage.service';
import { TableNameComponent } from './table-name/table-name.component';

import { TableService } from './table/table.service';

@NgModule({
    imports: [
        CommonModule,
        InlineSVGModule,
        HttpClientModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        RouterModule
    ],
    declarations: [
        ConstraintIconsComponent,
        DatetimeInputComponent,
        TableNameComponent
    ],
    exports: [
        ConstraintIconsComponent,
        DatetimeInputComponent,
        TableNameComponent
    ],
    providers: [
        AuthGuard,
        AuthService,
        TableService,
        StorageService
    ]
})
export class CoreModule {}
