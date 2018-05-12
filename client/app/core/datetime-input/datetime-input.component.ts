import {
    Component, ElementRef, forwardRef, Input, OnInit, Output, ViewChild
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import * as moment from 'moment';
import { Observable } from 'rxjs/Observable';
import { Subscription } from 'rxjs/Subscription';
import { DATETIME_FORMAT } from '../../common/constants';

@Component({
    selector: 'datetime-input',
    templateUrl: 'datetime-input.component.html',
    styleUrls: ['datetime-input.component.scss'],
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => DatetimeInputComponent),
            multi: true
        }
    ]
})
export class DatetimeInputComponent implements OnInit, ControlValueAccessor {
    /** Format used by <input> fields with type=date */
    public static readonly DATE_INPUT_FORMAT = 'YYYY-MM-DD';

    /** Format used by <input> fields with type=time */
    public static readonly TIME_INPUT_FORMAT = 'HH:mm';

    /**
     * The combination of DATE_INPUT_FORMAT and TIME_INPUT_FORMAT, in that order
     * separated by a space.
     */
    public static readonly DATETIME_INPUT_FORMAT =
        DatetimeInputComponent.DATE_INPUT_FORMAT + ' ' +
        DatetimeInputComponent.TIME_INPUT_FORMAT;

    @Input()
    public placeholder: string = '';

    @Input()
    public required: boolean = false;

    /** Called when either the date or time inputs are blurred */
    public _onTouched = () => undefined;

    // noinspection JSUnusedLocalSymbols
    /** Called when a new value is ready to be emitted */
    public _onChange = (datetime: string) => undefined;

    @ViewChild('date')
    private date: ElementRef;

    @ViewChild('time')
    private time: ElementRef;

    private sub: Subscription;

    public ngOnInit() {
        // Get the latest values emitted from both the date and time inputs
        this.sub = Observable.combineLatest(
            DatetimeInputComponent.valueChanges(this.date),
            DatetimeInputComponent.valueChanges(this.time),
            // Map the values into an object with keys 'date' and 'time'
            (date, time) => ({ date, time })
        )
            .map((data: { date: string, time: string }): string => {
                const { date, time } = data;
                if (!DatetimeInputComponent.isPresent(date) ||
                    !DatetimeInputComponent.isPresent(time)) {

                    // We require both the date and the time to construct a
                    // datetime, so return an empty value if either don't exist
                    return '';
                }

                // `date` will be something like '2018-04-20', `time` will be
                // something like '16:20'. 3rd parameter is strict mode.
                const d = moment(date + ' ' + time,
                    DatetimeInputComponent.DATETIME_INPUT_FORMAT, true);

                // If we happen to have created an invalid date, don't use it.
                // Format valid dates how the API expects.
                return d.isValid() ? d.format(DATETIME_FORMAT) : '';
            })
            .distinctUntilChanged()
            .subscribe((val) => this._onChange(val));
    }

    // overridden from ControlValueAccessor
    public writeValue(obj: any): void {
        if (typeof obj !== 'string') {
            // This could be changed to allow Date or Moment inputs
            throw new Error('datetime-input only accepts strings');
        }

        if (obj === '') {
            this.date.nativeElement.value = '';
            this.time.nativeElement.value = '';
            return;
        }

        const m = moment(obj, DatetimeInputComponent.DATETIME_INPUT_FORMAT, true);
        if (!m.isValid()) {
            throw new Error(`Not a valid date: '${obj}', expecting format ` +
                DatetimeInputComponent.DATETIME_INPUT_FORMAT);
        }

        // Format only the date portion
        this.date.nativeElement.value =
            m.format(DatetimeInputComponent.DATE_INPUT_FORMAT);

        // Format only the time portion
        this.time.nativeElement.value =
            m.format(DatetimeInputComponent.TIME_INPUT_FORMAT);
    }

    // overridden from ControlValueAccessor
    public registerOnChange(fn: any): void {
        this._onChange = fn;
    }

    // overridden from ControlValueAccessor
    public registerOnTouched(fn: any): void {
        this._onTouched = fn;
    }

    /**
     * Returns an Observable which returns the value of the <input> given by
     * `el.nativeElement`.
     */
    private static valueChanges(el: ElementRef): Observable<string> {
        return Observable.fromEvent(el.nativeElement, 'input')
            .map((e: any) => e.target.value);
    }

    /**
     * Returns true iff `val` is not undefined, not null, and not all whitespace.
     */
    private static isPresent(val: string) {
        return val !== null && val !== undefined && val.trim() !== '';
    }
}
