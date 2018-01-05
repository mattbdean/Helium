import { Component, Input } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { FilterProviderService } from '../filter-provider/filter-provider.service';
import { TableHeader } from '../../common/api';

@Component({
    selector: 'filter',
    templateUrl: 'filter.component.html'
})
export class FilterComponent {
    @Input()
    public group: FormGroup;

    @Input()
    public headers: TableHeader[] = [];

    public constructor(private filters: FilterProviderService) {}
}
