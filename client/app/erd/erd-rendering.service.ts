import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import * as vizmodule from 'viz.js';
import { environment } from '../../environments/environment';
import { Erd, ErdNode } from '../common/api';
import { ErdStyleService } from './erd-style.service';

// tslint:disable-next-line:variable-name
const Viz = vizmodule['default'];

/**
 * Handles the transformation of ERD data into a network graph described in the
 * DOT language and DOT graphs into actual SVG HTML elements.
 */
@Injectable()
export class ErdRenderingService {
    private static workerUrl = environment.baseUrl + 'assets/full.render.js';

    public constructor(
        private style: ErdStyleService
    ) {}

    public toDot(erd: Erd): string {
        let graph = [
            'digraph {',
            `  graph [${this.style.asAttributeString(this.style.globalGraphAttrs())}]`,
            `  node [${this.style.asAttributeString(this.style.globalNodeAttrs())}]`
        ].join('\n');

        graph += '\n';

        for (const node of erd.nodes) {
            graph += '  ' + this.nodeAsDot(node, erd.schema) + ';\n';
        }

        for (const edge of erd.edges) {
            graph += '  ' + ErdRenderingService.nodeIdString(edge.from) +
                ' -> ' + ErdRenderingService.nodeIdString(edge.to) + '\n';
        }

        graph += '}';

        return graph;
    }

    /**
     * Renders the given DOT graph into an SVGElement. The returned Observable
     * will only ever emit one value.
     * 
     * @param graph A valid graph as described by graphviz's DOT language
     */
    public toSvg(graph: string): Observable<SVGElement> {
        const viz = new Viz({ workerURL: ErdRenderingService.workerUrl });
        return from(viz.renderSVGElement(graph));
    }

    private nodeAsDot(node: ErdNode, schema: string) {
        const attrs = this.style.nodeAttributes(node, schema);
        return `${ErdRenderingService.nodeIdString(node)} [${this.style.asAttributeString(attrs)}]`;
    }

    private static nodeIdString(id: ErdNode | number) {
        return typeof id === 'number' ? `node_${id}` : this.nodeIdString(id.id);
    }
}
