import { zipObject } from 'lodash';
import { browser, by, element } from 'protractor';

export class FormHelper {
    public formControl(controlName: string) {
        return this.formControls(controlName).first();
    }

    public formControls(controlName: string) {
        // [formControlName] bindings become ng-reflect-name attributes in the
        // DOM. The formControlName attribute will be inaccessible directly
        // unless it's not used as a binding.
        return element.all(by.css(`[ng-reflect-name=${controlName}]`));
    }

    /** Fills out a form. */
    public async fill(data: { [formControName: string]: string | number | string[] | number[] }) {
        for (const controlName of Object.keys(data)) {
            const inputData: any = Array.isArray(data[controlName]) ? data[controlName] : [data[controlName]];

            const controls = this.formControls(controlName);
            const actual = await controls.count();
            if (actual !== inputData.length)
                throw new Error(`Expected to find ${inputData.length} ` +
                    `elements with formControlName=${controlName}, got ${actual}`);

            await controls.map((el, index) => {
                return el!!.sendKeys(inputData[index!!]);
            });
        }
    }

    /**
     * Attempts to find the values of all form controls with the given names.
     * Resolves to an object that maps those names to their values.
     */
    public async pluck(...formControlNames: string[]): Promise<{ [formControlName: string]: string | boolean | null }> {
        // Get an ElementFinder associated with each form control
        const controls = formControlNames.map((controlName) => this.formControl(controlName));
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
            } else {
                // Normal input element (probably)
                value = await control.getAttribute('value');
            }
            values.push(value);
        }

        return zipObject(formControlNames, values);
    }

    /** Locates the 'Submit' button for the form */
    public get submitButton() {
        return browser.findElement(by.css('button[type=submit]'));
    }

    /** Clicks the 'submit' button */
    public submit() {
        return this.submitButton.click();
    }
}
