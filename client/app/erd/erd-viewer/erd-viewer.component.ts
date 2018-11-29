import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material';
import { ActivatedRoute, Router } from '@angular/router';
import * as panzoomModule from 'panzoom';
import { NEVER, Observable, of } from 'rxjs';
import { catchError, flatMap, map, switchMap, tap } from 'rxjs/operators';
import { Erd } from '../../common/api';
import { ApiService } from '../../core/api/api.service';
import { SchemaSelectorComponent } from '../../core/schema-selector/schema-selector.component';
import { ErdHelpComponent } from '../erd-help/erd-help.component';
import { ErdRenderingService } from '../erd-rendering.service';

const panzoom = panzoomModule as any;

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
        if (!this.svgWrapper) return false;
        return !!this.svgWrapper.nativeElement.querySelector('svg');
    }

    /**
     * Emits a graph described in graphviz's DOT language created from the
     * schema in the URL.
     */
    private dot$: Observable<string | null>;

    @ViewChild(SchemaSelectorComponent)
    private schemaSelector: SchemaSelectorComponent;

    @ViewChild('svgWrapper')
    private svgWrapper: ElementRef;

    public constructor(
        private api: ApiService,
        private route: ActivatedRoute,
        private router: Router,
        private erd: ErdRenderingService,
        private dialog: MatDialog
    ) {}

    public ngOnInit() {
        this.dot$ = this.route.params.pipe(
            map((p) => p.schema),
            tap(() => {
                // Reset state
                this.working = true;
                this.failed = false;

                // View might not have been initialized yet
                if (this.svgWrapper.nativeElement) {
                    const host = this.svgWrapper.nativeElement;

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
                
                return this.erd.toDot(erd);
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
            switchMap((graph: string) => this.erd.toSvg(graph))
        ).subscribe((svg: SVGElement) => {
            const host = this.svgWrapper.nativeElement;
            const parent = host.parentNode;
            host.appendChild(svg);

            // Center relative to the parent
            const x = parent.clientWidth / 2 - (svg.clientWidth / 2 );

            // Chosen kinda arbitrarily, want to keep top of ERD close to top
            // of screen
            const y = 30; 
            panzoom(host, {
                // This is that really cool feature where if you're panning and
                // if your mouse's speed is above 0.0000000001px/s when you let
                // go it'll nudge the target a little bit in the same direction
                smoothScroll: false
            }).moveTo(x, y);
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
        const svg = this.svgWrapper.nativeElement.querySelector('svg');
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

    public handleHelpRequest() {
        this.dialog.open(ErdHelpComponent);
    }
}
