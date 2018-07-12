import { ElementRef, Injectable, QueryList } from '@angular/core';
import { cloneDeep, max } from 'lodash';

/**
 * This class contains the logic for handing the widths of each column in a
 * datatable.
 */
@Injectable()
export class LayoutHelper {
    /** The minimum width of a column when the table is first initialized */
    private static readonly MIN_DEFAULT_COL_WIDTH = 50; // px

    /** The width of the 'insert like' row */
    private static readonly INSERT_LIKE_COL_WIDTH = 35; // px

    /** The amount of manual padding added to each cell */
    private static readonly CELL_PADDING_RIGHT = 10; // px

    /** Returns a copy of the current state */
    public get state() { return cloneDeep(this._state); }

    /** The amount of non-header rows currently being displayed */
    public get contentRows() {
        // -1 because otherwise it would include the header row
        return ((this.contentCells.length + this.headerCells.length) / this.headerCells.length) - 1;
    }

    public get pressed() { return this._state.pressed; }

    /**
     * True if the user has switched to a new table and it hasn't had an initial
     * layout calculation. Layout recalculation is only done once per table
     * switch.
     */
    public needsFullLayoutRecalculation = false;

    public allowInsertLike = true;

    private _state: ResizeState;

    private widths: number[] = [];
    private minWidths: number[] = [];

    private headerCells: QueryList<ElementRef>;
    private contentCells: QueryList<ElementRef>;

    /**
     * Initializes this LayoutHelper. Should be called in or after
     * ngAfterViewInit, since that's when Angular makes injected QueryLists
     * usable.
     *
     * @param {QueryList<ElementRef>} headerCells A QueryList of MatHeaderCells
     * @param {QueryList<ElementRef>} contentCells A QueryList of MatCells
     */
    public init(
        headerCells: QueryList<ElementRef>,
        contentCells: QueryList<ElementRef>,
        allowInsertLike: boolean
    ) {
        this.headerCells = headerCells;
        this.contentCells = contentCells;
        this.allowInsertLike = allowInsertLike;
        this.resetState();
    }

    /**
     * Forces a recalculation of the current datatable. This method makes
     * internal state changes.
     *
     * @returns Elements to resize and the width they should be resized to (in
     * pixels)
     */
    public recalculate(beforeFullLayoutRecalc: (table: any[][]) => void): Array<{ el: any, width: number }> {
        const table = this.table();

        if (this.needsFullLayoutRecalculation) {
            beforeFullLayoutRecalc(table);
            this.recalculateAll(table);
        }

        const result: Array<{ el: any, width: number }> = [];

        // Make each column take up only what is required
        for (let i = 0; i < table.length; i++) {
            for (const el of table[i]) {
                result.push({ el, width: this.widths[i], text: el.textContent.trim() } as any);
            }
        }

        return result;
    }

    /** Gets the new width of the column currently being resized */
    public newWidth(): number {
        if (this._state.colIndex < 0)
            throw new Error('No column is being resized');
        return Math.max(
            // Don't allow the width to be below a certain value
            this._state.startWidth + (this._state.endX - this._state.startX),
            this.minWidths!![this._state.colIndex]
        );
    }

    public getWidth(colIndex: number): number {
        return this.widths[colIndex];
    }

    public onDragStart(event: MouseEvent, colIndex: number, startWidth: number) {
        if (!this._state.pressed) {
            this._state = {
                pressed: true,
                startX: event.x,
                startWidth,
                endX: event.x,
                colIndex
            };
        } else {
            throw new Error('Drag already in progress');
        }
    }

    public onMouseMove(event: MouseEvent): boolean {
        if (this._state.pressed) {
            this._state.endX = event.x;
        }

        return this._state.pressed;
    }

    public onDragEnd() {
        if (this._state.pressed) {
            setTimeout(() => {
                this._state.pressed = false;
            }, 0);
        }
    }

    public onMouseLeave() {
        if (this._state.pressed)
            this.resetState();
    }

    public resetState() {
        this._state = {
            pressed: false,
            colIndex: -1,
            startX: -1,
            endX: -1,
            startWidth: -1
        };
    }

    public onResizeComplete(newWidth: number) {
        if (this._state.colIndex < 0)
            throw new Error('No drag in progress');

        this.widths[this._state.colIndex] = newWidth;
    }

    /**
     * Creates a 2d array that represents the datatable. The array is indexed
     * [col][row], so table()[2][0] would get the header element for the third
     * column.
     */
    private table(): any[][] {
        const allCells = this.headerCells.toArray().concat(this.contentCells.toArray())
            .map((ref) => ref.nativeElement);

        const numHeaders = this.headerCells.length;
        const numRows = (allCells.length / numHeaders);

        // Create a 2d array in which the first dimension is a column
        // and the second dimension is a cell in a column
        const table: any[][] = [];

        // Headers are listed first
        const headers = allCells.slice(0, numHeaders);

        // Initialize the 2d array such that no elements are undefined
        for (let i = 0; i < headers.length; i++) {
            table[i] = [headers[i]];
        }

        // Header cells are listed left to right, but data cells are listed top
        // to bottom first, and then left to right. Basically the first column
        // on the left is listed top down first, followed by the rest of the
        // columns in that same order
        const columnCells = allCells.slice(numHeaders);
        for (let j = 0; j < columnCells.length; j++) {
            table[Math.floor(j / (numRows - 1))].push(columnCells[j]);
        }

        return table;
    }

    /**
     * Does a full layout recalculation. Updates `minWidths`, `widths`, and sets
     * `needsFullLayoutRecalculation` to false when finished.
     */
    private recalculateAll(table: any[][]) {
        this.widths = table
            .map((col: any[]) =>
                col.map((el) => {
                    // Add some padding so if a cell takes up 100% of the
                    // allotted width it'll be easier to read
                    const baseWidth =
                        Math.max(el.clientWidth, LayoutHelper.MIN_DEFAULT_COL_WIDTH);
                    return baseWidth + LayoutHelper.CELL_PADDING_RIGHT;
                }))
            .map(max) as number[];

        const headers = table.map((col) => col[0]);

        // Compute the maximum width of each column
        this.minWidths = headers.map((h) => h.clientWidth);

        if (this.allowInsertLike) {
            this.widths[0] = LayoutHelper.INSERT_LIKE_COL_WIDTH;
            this.minWidths[0] = LayoutHelper.INSERT_LIKE_COL_WIDTH;
        }

        this.needsFullLayoutRecalculation = false;
    }
}

export interface ResizeState {
    /** X-position of the mouse when the drag event started */
    startX: number;

    /** Final/most recent x-position of the mouse while resizing */
    endX: number;

    /** The width the column started at */
    startWidth: number;

    /** If the mouse is currently down */
    pressed: boolean;

    /**
     * Target column index. Includes the "insert like" column, if allowed.
     * Negative when there is no resizing happening
     */
    colIndex: number;
}
