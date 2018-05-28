import { FilterOperation } from '.';

/**
 * Specifies a constraint some data must adhere to in order to be presented to
 * the API consumer. For example, to specify "column `foo` must be greater than
 * 10", the filter would look like this:
 * 
 * {
 *   op: "lt",
 *   param: "foo",
 *   value: 10
 * }
 */
export interface Filter {
    op: FilterOperation;

    /** Column name */
    param: string;

    /** Subject of the filter operation. */
    value: string;
}
