import { browser, by, ElementFinder, ExpectedConditions } from 'protractor';
import { Snackbar } from './snackbar';

export class SnackbarHelper {

    /** Waits until a SnackBar appears and returns a Snackbar instance */
    public async waitFor(): Promise<Snackbar> {
        const parent = browser.element(by.css('simple-snack-bar'));
        if (!await parent.isDisplayed()) {
            await browser.wait(ExpectedConditions.visibilityOf(parent), 5000);
        }

        const allText = await parent.getText();
        let message = allText;

        let action: { button: ElementFinder, text: string } | null = null;

        const actionButton = parent.element(by.css('button'));
        if (await actionButton.isPresent()) {
            const actionText = await actionButton.getText();

            // If there's an action, allText will be the main message and the
            // action message, separated by a new line
            message = allText.split('\n')[0];

            action = { button: actionButton, text: actionText };
        }

        return { parent, action, message };
    }
}
