import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import {
    MatFormFieldModule, MatIconModule,
    MatInputModule,
    MatOptionModule,
    MatSelectModule
} from '@angular/material';
import { RouterModule } from '@angular/router';
import { environment } from '../../environments/environment';
import { ApiService } from './api/api.service';
import { MockApiService } from './api/mock-api.service';
import { AuthGuard } from './auth-guard/auth-guard.service';
import { AuthService } from './auth/auth.service';
import { MockAuthService } from './auth/mock-auth.service';
import { ConstraintIconsComponent } from './constraint-icons/constraint-icons.component';
import { DatetimeInputComponent } from './datetime-input/datetime-input.component';
import { SchemaSelectorComponent } from './schema-selector/schema-selector.component';
import { StorageService } from './storage/storage.service';
import { TableNameComponent } from './table-name/table-name.component';

@NgModule({
    imports: [
        CommonModule,
        HttpClientModule,
        MatIconModule,
        MatFormFieldModule,
        MatSelectModule,
        MatOptionModule,
        MatInputModule,
        ReactiveFormsModule,
        RouterModule
    ],
    declarations: [
        ConstraintIconsComponent,
        DatetimeInputComponent,
        SchemaSelectorComponent,
        TableNameComponent
    ],
    exports: [
        ConstraintIconsComponent,
        DatetimeInputComponent,
        SchemaSelectorComponent,
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
            provide: ApiService,
            useClass: environment.preview ? MockApiService : ApiService
        }
    ]
})
export class CoreModule {
}
