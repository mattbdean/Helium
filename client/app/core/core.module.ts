import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { HttpModule } from '@angular/http';

import { TableService } from './table.service';

@NgModule({
    imports: [
        CommonModule,
        HttpModule
    ],
    providers: [ TableService ]
})
export class CoreModule {}

