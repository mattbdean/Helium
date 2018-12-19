import { Injectable } from '@angular/core';
import { ErdEdge, ErdNode, TableTier } from '../common/api';

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

        const label = schema.toLowerCase() === node.table.schema.toLowerCase() ?
            '"' + node.table.name.clean + '"' :
            `<${node.table.name.clean}<br/><font point-size="${ErdStyleService.SMALLER_FONT_SIZE}">` +
            `${node.table.schema}</font>>`;

        const colorScheme = this.colorScheme(tier);

        let style: string | undefined,
            penwidth: string | undefined,
            borderColor = colorScheme.dark,
            fillColor: string | undefined = colorScheme.primary;

        if (node.table.isPartTable()) {
            style = 'dashed';
            penwidth = '1.0';

            borderColor = fillColor;
            fillColor = undefined;
        }

        const path = `/tables/${encodeURIComponent(node.table.schema)}/` +
            encodeURIComponent(node.table.name.raw);

        return [
            ...this.quoted({
                shape: this.shape(tier),
                color: borderColor,
                tooltip: '`' + node.table.schema + '`.`' + node.table.name.raw + '`',
                URL: window.location.origin + path,
                style,
                fillcolor: fillColor,
                penwidth
            }),
            { key: 'label', value: label, quoted: false }
        ];
    }

    public edgeAttributes(edge: ErdEdge): ErdAttribute[] {
        return this.quoted({
            style: edge.type === 'part' ? 'dashed' : undefined
        });
    }

    public colorScheme(tier: TableTier): ColorScheme {
        // https://www.materialui.co/colors
        // In general, primary == 600, dark == 900, light == 300
        if (tier === 'manual') {
            // green
            return { primary: '#4CAF50', dark: '#1B5E20', light: '#81C784', };
        } else if (tier === 'imported') {
            // blue
            return { primary: '#1E88E5', dark: '#0D47A1', light: '#64B5F6' };
        } else if (tier === 'computed') {
            // red
            return { primary: '#E53935', dark: '#B71C1C', light: '#E57373' };
        } else if (tier === 'lookup') {
            // gray
            return { primary: '#90A4AE', dark: '#263238', light: '#90A4AE' };
        } else {
            // white for unknown
            return { primary: '#FFFFFF', dark: '#FFFFFF', light: '#FFFFFF' };
        }
    }

    public shape(tier: TableTier): string {
        return {
            imported: 'ellipse',
            computed: 'doubleoctagon',
            lookup: 'Mdiamond'
        }[tier] || 'rectangle';
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
            fontsize: String(ErdStyleService.FONT_SIZE),
            style: 'filled'
        });
    }

    /**
     * Any attributes applied to all edges in the graph. Applied in DOT likes
     * this:
     * 
     * digraph G {
     *   edge [key1=value1 key2=value2 (...)]
     * }
     */
    public globalEdgeAttrs(): ErdAttribute[] {
        return this.quoted({
            arrowhead: 'none'
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

interface ColorScheme {
    primary: string;
    light: string;
    dark: string;
}
