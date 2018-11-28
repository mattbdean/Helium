import { Injectable } from '@angular/core';
import { ErdNode } from '../common/api';

/**
 * Handles styling for ERDs. Assumes the network graph is being described in
 * graphviz's DOT language.
 */
@Injectable()
export class ErdStyleService {
    /** Normal font used by most node labels, measured in points instead of pixels */
    public static readonly FONT_SIZE = 12.0;

    /**
     * A slightly smaller font size used mostly for when a label needs a
     * "sublabel." For example, when a node is included in an ERD but it is not
     * a member of the source schema, its sublabel is the table's schema.
     */
    public static readonly SMALLER_FONT_SIZE = 10.0;

    /**
     * Produces the attributes to be used for the given node.
     * 
     * @param node An ERD node
     * @param schema The schema for which the ERD was originally requested
     */
    public nodeAttributes(node: ErdNode, schema: string): ErdAttribute[] {
        const tier = node.table.tier;
        let shape: string | undefined, color: string | undefined;

        const label = schema.toLowerCase() === node.table.schema.toLowerCase() ?
            '"' + node.table.name.clean + '"' :
            `<${node.table.name.clean}<br/><font point-size="${ErdStyleService.SMALLER_FONT_SIZE}">` +
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

        return [
            ...this.quoted({
                shape,
                color,
                tooltip: '`' + node.table.schema + '`.`' + node.table.name.raw + '`',
            }),
            { key: 'label', value: label, quoted: false }
        ];
    }

    /**
     * Any attributes that should be applied to the graph. For example, to make
     * the entire SVG background blue via DOT, one would use
     * 
     * digraph G {
     *   graph [bgcolor=blue]
     * }
     * 
     * These attributes should be specified where "bgcolor=blue" is.
     */
    public globalGraphAttrs(): ErdAttribute[] {
        return this.quoted({
            bgcolor: 'transparent',
        });
    }

    /**
     * Any attributes that should be applied to all nodes in the graph. Can be
     * specified in DOT like this:
     * 
     * digraph G {
     *   node [key1=value1 key2=value2 (...)]
     * }
     */
    public globalNodeAttrs(): ErdAttribute[] {
        return this.quoted({
            fontname: 'Helvetica,Arial,sans-serif',
            fontsize: String(ErdStyleService.FONT_SIZE)
        });
    }

    /**
     * Formats the given attributes into an attribute string (`a_list` in the
     * graphviz DOT language spec).
     */
    public asAttributeString(attrs: ErdAttribute[]): string {
        return attrs
            .map((attr) => {
                const value = attr.quoted ? '"' + attr.value + '"' : attr.value;
                return `${attr.key}=${value}`;
            }).join(' ');
    }

    private quoted(kvPairs: { [key: string]: string | undefined }): ErdAttribute[] {
        return Object.keys(kvPairs)
            .filter((key) => kvPairs[key] !== undefined)
            .map((key) => ({ key, value: kvPairs[key]!, quoted: true }));
    }
}

export interface ErdAttribute {
    key: string;
    value: string;

    /** If false, the value should not be surrounded by quotes */
    quoted: boolean;
}
