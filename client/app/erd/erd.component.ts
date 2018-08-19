import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { DataSet, Edge, Network, Node, Options } from 'vis';
import 'vis/dist/vis.css';
import { Erd, ErdNode } from '../common/api';
import { TableName } from '../common/table-name';
import { ApiService } from '../core/api/api.service';

@Component({
    selector: 'erd',
    templateUrl: 'erd.component.html',
    styleUrls: ['erd.component.scss']
})
export class ErdComponent implements OnInit, AfterViewInit, OnDestroy {
    public data$: Observable<VisErd>;

    @ViewChild('networkContainer')
    private networkContainer: ElementRef<any>;

    private network: Network | null = null;

    public constructor(
        private api: ApiService,
        private router: Router
    ) {}

    public ngOnInit() {
        this.data$ = this.api.erd().pipe(
            map((erd: Erd): VisErd => {
                const nodes = new DataSet<Node>(erd.nodes.map((n) => this.createNode(n)));

                let lastId = 0;
                const edges = new DataSet<Edge>(erd.edges.map((e) => {
                    return {
                        from: e.from,
                        to: e.to,
                        id: lastId++
                    };
                }));

                return {
                    nodes,
                    edges
                };
            })
        );
    }

    public ngAfterViewInit() {
        this.data$.subscribe((erd: VisErd) => {
            const container = this.networkContainer.nativeElement;

            const size = 10;
            const options: Options = {
                physics: {
                    enabled: false
                },
                layout: {
                    hierarchical: {
                        direction: 'DU',
                        sortMethod: 'directed',
                        // Temporary workaround for
                        // https://github.com/almende/vis/issues/1964
                        nodeSpacing: 220
                    }
                },
                nodes: {
                    font: {
                        multi: 'markdown',
                        face: 'Roboto'
                    },
                    size
                },
                groups: {
                    part: {
                        shape: 'dot',
                        color: 'black',
                        size: size / 2
                    },
                    manual: {
                        color: 'green',
                        shape: 'square',
                    },
                    lookup: {
                        color: 'gray',
                        shape: 'star',
                    },
                    imported: {
                        color: 'blue',
                        shape: 'dot',
                    },
                    computed: {
                        color: 'red',
                        shape: 'star',
                    }
                }
            };

            this.network = new Network(container, erd, options);
            this.network.on('doubleClick', (e) => {
                if (e.nodes.length < 1)
                    return;

                const id = e.nodes[0];
                const table: TableName = (erd.nodes.get(id) as any)._table;

                this.router.navigate(['/tables', table.schema, table.name.raw]);
            });
        });
    }

    public ngOnDestroy() {
        if (this.network)
            this.network.destroy();
    }

    private createNode(n: ErdNode): Node {
        const { table, id } = n;

        return {
            id,
            label: `*${table.name.clean}*\n${table.schema}`,
            widthConstraint: {
                maximum: 200
            },
            group: table.isPartTable() ? 'part' : table.tier,
            _table: table
        } as any;
    }
}

interface VisErd {
    nodes: DataSet<Node>;
    edges: DataSet<Edge>;
}
