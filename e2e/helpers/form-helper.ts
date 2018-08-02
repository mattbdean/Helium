import { zipObject } from 'lodash';
import { browser, by, element, ElementArrayFinder, ElementFinder } from 'protractor';

export class FormHelper {
    /** Locates the 'Submit' button for the form */
    public get submitButton() {
        return browser.findElement(by.css('button[type=submit]'));
    }

    /** Fills out a form. */
    public async fill(data: { [formControName: string]: string | number | string[] | number[] }) {
        for (const controlName of Object.keys(data)) {
            const inputData: any = Array.isArray(data[controlName]) ? data[controlName] : [data[controlName]];

            const controls: ElementArrayFinder =
                await this.formControls(controlName, inputData.length) as any;

            await controls.map((el: ElementFinder, index: number) => {
                el!!.sendKeys(inputData[index!!]);
            });
        }
    }

    /**
     * Attempts to find the values of all form controls with the given names.
     * Resolves to an object that maps those names to their values.
     */
    public async pluck(...formControlNames: string[]): Promise<{ [formControlName: string]: string | boolean | null }> {
        // Get an ElementFinder associated with each form control
        const controls = await Promise.all(formControlNames.map((controlName) => this.formControl(controlName)));
        const values: Array<string | boolean | null> = [];

        for (const control of controls) {
            // Try to identify the value of every form control
            let value: string | boolean | null = null;

            // Some Angular Material input components don't attach
            // [formControlName] to inputs, but rather to their custom
            // components. For text, number, date(time), and autocomplete,
            // inputs, we can directly get their values. For checkboxes and
            // selects, we have to do a bit more work.
            const elementName = await (await control.getWebElement()).getTagName();
            if (elementName === 'mat-checkbox') {
                // Find the internal checkbox input and return its value
                value = await control.element(by.css('input[type=checkbox]'))
                    .isSelected();
            } else if (elementName === 'mat-select') {
                // This element is only present if there is a selected value
                const el = await control.element(by.css('.mat-select-value-text'));

                if (await el.isPresent())
                    // If there's no selected value, it'll remain null
                    value = await control.element(by.css('.mat-select-value-text'))
                        .getText();
            } else if (elementName === 'datetime-input') {
                const date = await control.element(by.css('input[type=date]'));
                const time = await control.element(by.css('input[type=time]'));

                value = (await date.getAttribute('value')) + ' ' +
                    (await time.getAttribute('value'));
            } else {
                // Normal input element (probably)
                value = await control.getAttribute('value');
            }
            values.push(value);
        }

        return zipObject(formControlNames, values);
    }

    /** Clicks the 'submit' button */
    public submit() {
        return this.submitButton.click();
    }

    private async formControls(controlName: string, controlCount: number): Promise<ElementArrayFinder> {
        // Either one of these attributes could be listed depending on how the
        // form is being used
        const attrs = ['ng-reflect-name', 'formcontrolname'];

        for (const attr of attrs) {
            const results = element.all(by.css(`[${attr}=${controlName}`));

            const count = await results.count();
            if (count === controlCount) {
                return results as any;
            } else if (count > 0) {
                throw new Error(`Found ${count} form controls with name "${controlName}", expected ${controlCount}`);
            }
        }

        throw new Error(`Could not find a form control with name "${controlName}"`);
    }

    private async formControl(controlName: string): Promise<ElementFinder> {
        return (await this.formControls(controlName, 1) as any as ElementArrayFinder).first();
    }
}
