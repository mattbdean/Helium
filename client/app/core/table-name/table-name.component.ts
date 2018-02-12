import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { TableName } from '../../common/table-name.class';

@Component({
    selector: 'table-name',
    templateUrl: 'table-name.component.html',
    styles: [`
        /* Make the icon match the text color */
        mat-icon { color: rgba(0, 0, 0, 0.87); }
    `]
})
export class TableNameComponent implements OnChanges {
    @Input() public name: TableName;

    public masterCleanName: string | null;

    public ngOnChanges(changes: SimpleChanges): void {
        if (changes.name) {
            const newName: TableName = changes.name.currentValue;
            this.masterCleanName = !newName.isPartTable() ? null : newName.masterName!!.clean;
        }
    }
}
