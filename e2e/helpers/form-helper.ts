import { browser, by, element, protractor } from 'protractor';

export class FormHelper {
    public formControl(controlName: string) {
        return this.formControls(controlName).first();
    }

    public formControls(controlName: string) {
        // [formControlName] bindings become ng-reflect-name attributes in the
        // DOM. The formControlName attribute will be inaccessible directly
        // unless it's not used as a binding.
        return element.all(by.css(`input[ng-reflect-name=${controlName}]`));
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
                return el.sendKeys(inputData[index]);
            });
        }
    }

    public pluck(...formControlNames: string[]) {
        const controls = formControlNames.map((controlName) => this.formControl(controlName));
        return protractor.promise.all(controls.map((control) => control.getAttribute('value')));
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
