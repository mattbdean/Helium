import {
    Component, Input, OnChanges, OnInit, SimpleChanges, TemplateRef, ViewChild
} from '@angular/core';
import { Response } from '@angular/http';
import { MdIconRegistry } from '@angular/material';

import * as _ from 'lodash';
import * as moment from 'moment';

import { Constraint, SqlRow, TableHeader, TableMeta } from '../common/responses';
import { BOOLEAN_TYPE } from '../core/constants';
import { TableService } from '../core/table.service';

interface ConstraintMapping {
    [headerName: string]: Constraint;
}

interface DataTableHeader {
    name: string;
    prop: string;
}

interface Page {
    number: number;
    size: number;
    data: SqlRow[];
}

@Component({
    selector: 'datatable',
    templateUrl: 'datatable.component.html',
    styleUrls: ['datatable.component.scss']
})
export class DatatableComponent implements OnChanges {
    /** Time in milliseconds before showing a loading bar on the table */
    private static readonly LOADING_DELAY = 200;
    
    private snowflakeIcon = require('../../assets/snowflake.svg');
    private keyIcon = require('../../assets/key.svg');
    private keyChangeIcon = require('../../assets/key-change.svg');

    @Input()
    public name: string;
    public meta: TableMeta = {
        headers: [],
        totalRows: 0,
        constraints: [],
        comment: ''
    };
    public tableHeaders: DataTableHeader[];
    public constraintMapping: ConstraintMapping = {};

    @ViewChild('headerTemplate') private headerTemplate: TemplateRef<any>;
    @ViewChild('cellTemplate') private cellTemplate: TemplateRef<any>;

    /** True if this component has tried to access the table and found data */
    public exists: boolean = true;

    /** True if this component is fetching new data */
    public loading: boolean = true;

    public limit: number = 25;
    public sort: string;

    public page: Page = {
        number: -1,
        size: 0,
        data: []
    };

    constructor(
        private backend: TableService,
        private iconRegistry: MdIconRegistry
    ) {}

    public ngOnChanges(changes: SimpleChanges) {
        this.showLoading(async () => {
            this.sort = undefined;
            this.meta = await this.backend.meta(this.name);
            this.tableHeaders = this.createTableHeaders(this.meta.headers);
            this.constraintMapping = this.createConstraintMapping(this.meta.constraints);
            this.exists = true;
            // Set the initial page now that we have some data
            return this.setPage({ offset: 0 }, false);
        }, (e) => {
            // Handle 404s, show the user that the table couldn't be found
            if (e instanceof Response && e.status === 404) {
                this.exists = false;
                return;
            }

            // Other error, rethrow it
            throw e;
        });
    }

    private setPage(event: any, showLoading: boolean = true) {
        const load = async () => {
            // page 1 === offset 0, page 2 === offset 1, etc.
            const page = event.offset + 1;
            // Get the raw data from the service and format it
            const raw = await this.backend.content(this.name, page, this.limit, this.sort);
            const content = this.formatRows(this.meta.headers, raw);

            // Update the page
            this.page = {
                number: event.offset,
                size: content.length,
                data: content
            };
        };

        if (showLoading)
            return this.showLoading(load);
        else
            return load();
    }

    private onSort(event: any) {
        const sortDirPrefix = event.sorts[0].dir === 'desc' ? '-' : '';
        // '-prop' for descending, 'prop' for ascending
        this.sort = sortDirPrefix + event.sorts[0].prop;
        this.showLoading(async () => {
            const raw = await this.backend.content(this.name, 1, this.limit, this.sort);
            const data = this.formatRows(this.meta.headers, raw);
            this.page = {
                number: 0,
                size: data.length,
                data
            };
        });
    }

    private showLoading(
        doWork: () => Promise<void>,
        handleError: (e: any) => void = console.error
    ) {
        const timeout = setTimeout(() => {
            this.loading = true;
        }, DatatableComponent.LOADING_DELAY);

        return doWork()
            .catch(handleError)
            .then(() => {
                this.loading = false;
                clearTimeout(timeout);
            });
    }

    private createTableHeaders(headers: TableHeader[]): DataTableHeader[] {
        return _.sortBy(_.map(headers, (h) => ({ 
            name: h.name,
            prop: h.name,
            cellTemplate: this.cellTemplate,
            headerTemplate: this.headerTemplate
        })), 'ordinalPosition');
    }

    private createConstraintMapping(constraints: Constraint[]): ConstraintMapping {
        const vals: ConstraintMapping = {};
        for (const c of constraints)
            vals[c.localColumn] = c;
        return vals;
    }

    private formatRows(headers: TableHeader[], rows: SqlRow[]): SqlRow[] {
        const copied = _.clone(rows);

        // Iterate through each row
        for (const row of copied) {
            // Iterate through each cell in that row
            for (const headerName of Object.keys(row)) {
                const header = _.find(headers, (h) => h.name === headerName);
                // Use moment to format dates and times in the default format
                if (header.type === 'date')
                    row[headerName] = this.formatMoment(row[headerName], 'l');
                if (header.type === 'timestamp' || header.type === 'datetime')
                    row[headerName] = this.formatMoment(row[headerName], 'LLL');
                if (header.rawType === BOOLEAN_TYPE)
                    // Resolve either the 1 or 0 to its boolean value
                    row[headerName] = !!row[headerName];
            }
        }

        return copied;
    }

    /**
     * Tries to format a given date into the format given. If the source is not
     * a valid date, returns null.
     * 
     * @param format Any format accepted by Moment
     */
    private formatMoment(source: string, format: string): string | null {
        const m = moment(source);
        return m.isValid() ? m.format(format) : null;
    }
}
