import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { DataSet, Edge, Network, Node, Options } from 'vis';
import 'vis/dist/vis.css';
import { Erd } from '../common/api';
import { ApiService } from '../core/api/api.service';

@Component({
    selector: 'erd',
    templateUrl: 'erd.component.html',
    styleUrls: ['erd.component.scss']
})
export class ErdComponent implements OnInit, AfterViewInit {
    public data$: Observable<VisErd>;

    @ViewChild('networkContainer')
    private networkContainer: ElementRef<any>;

    public constructor(
        private api: ApiService
    ) {}

    public ngOnInit() {
        this.data$ = this.api.erd().pipe(
            map((erd: Erd): VisErd => {
                const nodes = new DataSet<Node>(erd.nodes.map((n) => {
                    return {
                        id: n.id,
                        label: n.table.schema + '.' + n.table.name.clean
                    };
                }));

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

            const options: Options = {
                physics: {
                    enabled: false
                },
                layout: {
                    hierarchical: {
                        direction: 'DU'
                    }
                }
            };
            const network = new Network(container, erd, options);
            console.log(network);
        });
    }
}

interface VisErd {
    nodes: DataSet<Node>;
    edges: DataSet<Edge>;
}
