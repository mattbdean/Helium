import {
    Component, EventEmitter, Input, OnInit, Output,
    ViewChild
} from '@angular/core';
import { FormGroup } from '@angular/forms';
import { MatCheckbox, MatCheckboxChange } from '@angular/material';
import { TableHeader } from '../../common/api';
import { FilterProviderService } from '../filter-provider/filter-provider.service';

@Component({
    selector: 'filter',
    templateUrl: 'filter.component.html',
    styleUrls: ['filter.component.scss']
})
export class FilterComponent implements OnInit {
    @Input()
    public group: FormGroup;

    @Input()
    public headers: TableHeader[] = [];

    @ViewChild('checkbox')
    private checkbox: MatCheckbox;

    @Output()
    private removed = new EventEmitter<boolean>(false);

    public ops;

    public constructor(private filters: FilterProviderService) {}

    public ngOnInit() {
        this.ops = this.filters.operations();
        this.checkbox.checked = true;
    }

    public onToggle(change: MatCheckboxChange) {
        if (change.checked)
            this.group.enable();
        else
            this.group.disable();
    }

    public requestRemove() {
        this.removed.emit(true);
    }
}
