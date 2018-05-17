import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material';
import { SqlRow } from '../../common/api';
import { TableName } from '../../common/table-name.class';

/**
 * Uses a DatatableComponent to allow the user to pick out a particular row.
 */
@Component({
    selector: 'row-picker-dialog',
    templateUrl: 'row-picker-dialog.component.html'
})
export class RowPickerDialogComponent {
    public name: TableName;

    public constructor(
        private ref: MatDialogRef<RowPickerDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: RowPickerParams
    ) {
        this.name = new TableName(data.schemaName, data.tableName);
    }

    public onRowSelected(data: SqlRow) {
        this.ref.close(data);
    }
}

export interface RowPickerParams {
    tableName: string;
    schemaName: string;
}
