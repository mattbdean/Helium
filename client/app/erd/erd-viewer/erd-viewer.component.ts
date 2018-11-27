import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { from, NEVER, Observable, of } from 'rxjs';
import { catchError, flatMap, map, switchMap, tap } from 'rxjs/operators';
import * as vizmodule from 'viz.js';
import { environment } from '../../../environments/environment';
import { Erd, ErdNode } from '../../common/api';
import { ApiService } from '../../core/api/api.service';
import { SchemaSelectorComponent } from '../../core/schema-selector/schema-selector.component';

// tslint:disable-next-line:variable-name
const Viz = vizmodule['default'];

@Component({
    selector: 'erd-viewer',
    templateUrl: 'erd-viewer.component.html',
    styleUrls: ['erd-viewer.component.scss']
})
export class ErdViewerComponent implements OnInit, AfterViewInit {
    /**
     * True if the ERD is in transit from the server or is being transformed
     * from a string to an SVG to display.
     */
    public working = true;

    /** True if the ERD request returned an error or the ERD was empty. */
    public failed = false;

    public get erdShowing() {
        if (!this.networkContainer) return false;
        return !!this.networkContainer.nativeElement.querySelector('svg');
    }

    /**
     * Emits a graph described in graphviz's DOT language created from the
     * schema in the URL.
     */
    private dot$: Observable<string | null>;

    @ViewChild(SchemaSelectorComponent)
    private schemaSelector: SchemaSelectorComponent;

    private static workerUrl = environment.baseUrl + 'assets/full.render.js';

    private static readonly FONT_SIZE = 12.0;
    private static readonly SMALLER_FONT_SIZE = 10.0;

    @ViewChild('networkContainer')
    private networkContainer: ElementRef;

    public constructor(
        private api: ApiService,
        private route: ActivatedRoute,
        private router: Router
    ) {}

    public ngOnInit() {
        this.dot$ = this.route.params.pipe(
            map((p) => p.schema),
            tap(() => {
                // Reset state
                this.working = true;
                this.failed = false;

                // View might not have been initialized yet
                if (this.networkContainer.nativeElement) {
                    const host = this.networkContainer.nativeElement;

                    // Remove all previous graphs
                    while (host.firstChild)
                        host.removeChild(host.firstChild);
                }
            }),
            flatMap((schema) => this.api.erd(schema).pipe(
                // tslint:disable-next-line:no-console
                catchError((err) => { console.error(err); return NEVER; })
            )),
            map((erd: Erd | null): string | null => {
                if (erd === null || erd.nodes.length === 0)
                    // No information available, probably tried to view the ERD
                    // for information_schema or another built-in table
                    return null;
                
                let graph = [
                    'digraph {',
                    '  graph [bgcolor=transparent]',
                    `  node [fontname="Helvetica,Arial,sans-serif",fontsize="${ErdViewerComponent.FONT_SIZE}"]`
                ].join('\n');

                graph += '\n';

                for (const node of erd.nodes) {
                    graph += '  ' + this.nodeAsDot(node, erd.schema) + ';\n';
                }

                for (const edge of erd.edges) {
                    graph += '  ' + ErdViewerComponent.nodeIdString(edge.from) +
                        ' -> ' + ErdViewerComponent.nodeIdString(edge.to) + '\n';
                }

                graph += '}';

                return graph;
            }),
            switchMap((graph: string | null) => {
                if (graph === null) {
                    this.failed = true;
                    this.working = false;
                    return NEVER;
                }

                return of(graph);
            })
        );
    }

    public ngAfterViewInit() {
        this.dot$.pipe(
            switchMap((graph: string) => {
                const viz = new Viz({ workerURL: ErdViewerComponent.workerUrl });
                return from(viz.renderSVGElement(graph));
            })
        ).subscribe((svg: SVGElement) => {
            const host = this.networkContainer.nativeElement;
            host.appendChild(svg);
            this.working = false;
        });

        // Navigate to the page for that ERD when a schema is selected from the
        // toolbar
        this.schemaSelector.schemaChange.subscribe((schema: string | null) => {
            if (schema === null) {
                this.failed = true;
            } else {
                this.router.navigate(['/erd', schema]);
            }
        });
    }

    public handleDownloadRequest() {
        // Create a data URL out of the SVG
        const svg = this.networkContainer.nativeElement.querySelector('svg');
        const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        // Format the file name
        const now = new Date();
        const dateString = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
        const filename = `erd_${this.route.snapshot.params.schema}_${dateString}.svg`;

        // Download the blob
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    private nodeAsDot(node: ErdNode, schema: string) {
        const tier = node.table.tier;
        let shape: string | undefined, color: string | undefined;

        const label = schema.toLowerCase() === node.table.schema.toLowerCase() ?
            '"' + node.table.name.clean + '"' :
            `<${node.table.name.clean}<br/><font point-size="${ErdViewerComponent.SMALLER_FONT_SIZE}">` +
            `${node.table.schema}</font>>`;

        if (node.table.isPartTable()) {
            shape = 'underline';
        } else if (tier === 'lookup') {
            color = '#78909C'; // gray
            shape = 'Mdiamond';
        } else if (tier === 'manual') {
            color = '#66BB6A'; // green
            shape = 'rectangle';
        } else if (tier === 'imported') {
            color = '#42A5F5'; // blue
            shape = 'ellipse';
        } else if (tier === 'computed') {
            color = '#ef5350'; // red
            shape = 'doubleoctagon';
        }

        const attrs: { [key: string]: string | undefined } = {
            tooltip: '`' + node.table.schema + '`.`' + node.table.name.raw + '`',
            shape,
            color
        };

        const attrString = Object.keys(attrs)
            .filter((key) => attrs[key] !== undefined)
            .map((key) => `${key}="${attrs[key]}"`)
            .join(' ') + ' label=' + label;

        return `${ErdViewerComponent.nodeIdString(node)} [${attrString}]`;
    }

    private static nodeIdString(id: ErdNode | number) {
        return typeof id === 'number' ? `node_${id}` : this.nodeIdString(id.id);
    }
}
