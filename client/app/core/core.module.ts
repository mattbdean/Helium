import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import {
    MatFormFieldModule, MatIconModule,
    MatInputModule
} from '@angular/material';
import { RouterModule } from "@angular/router";
import { environment } from '../../environments/environment';
import { AuthGuard } from './auth-guard/auth-guard.service';
import { AuthService } from './auth/auth.service';
import { MockAuthService } from './auth/mock-auth.service';
import { ConstraintIconsComponent } from "./constraint-icons/constraint-icons.component";
import { DatetimeInputComponent } from './datetime-input/datetime-input.component';
import { StorageService } from './storage/storage.service';
import { TableNameComponent } from './table-name/table-name.component';
import { MockTableService } from './table/mock-table.service';
import { TableService } from './table/table.service';

@NgModule({
    imports: [
        CommonModule,
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
        StorageService,
        {
            provide: AuthService,
            useClass: environment.preview ? MockAuthService : AuthService
        },
        {
            provide: TableService,
            useClass: environment.preview ? MockTableService : TableService
        }
    ]
})
export class CoreModule {
}
