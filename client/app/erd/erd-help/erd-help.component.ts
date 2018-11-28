import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { Erd } from '../../common/api';
import { TableName } from '../../common/table-name';
import { ErdRenderingService } from '../erd-rendering.service';

@Component({
    selector: 'erd-help',
    template: '<div #networkContainer></div>'
})
export class ErdHelpComponent implements OnInit, AfterViewInit {
    @ViewChild('networkContainer')
    private networkContainer: ElementRef;
    private dot: string;

    public constructor(
        private erd: ErdRenderingService
    ) {}

    public ngOnInit() {
        this.dot = this.erd.toDot(this.createHelpErd());
    }

    public ngAfterViewInit() {
        this.erd.toSvg(this.dot).subscribe((svg) => {
            this.networkContainer.nativeElement.appendChild(svg);
        });
    }

    private createHelpErd(): Erd {
        const schema = 'some_schema';

        return {
            schema,
            nodes: [
                { id: 0, table: new TableName(schema, 'manual_table') },
                { id: 1, table: new TableName(schema, '#lookup_table') },
                { id: 2, table: new TableName(schema, '_imported_table') },
                { id: 3, table: new TableName(schema, '__computed_table') },
                { id: 10, table: new TableName(schema, 'table_referencing') },
                { id: 11, table: new TableName(schema, 'table_being_referenced') },
            ],
            edges: [
                { from: 10, to: 11 }
            ]
        };
    }
}
