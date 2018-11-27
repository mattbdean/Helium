import { TableName } from '../table-name';

export interface Erd {
    schema: string;
    nodes: ErdNode[];
    edges: ErdEdge[];
}

export interface ErdNode {
    id: number;
    table: TableName;
}

export interface ErdEdge {
    from: number;
    to: number;
}
