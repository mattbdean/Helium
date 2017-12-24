import { ElementFinder } from 'protractor';

export interface Snackbar {
    parent: ElementFinder;
    message: string;
    action: {
        button: ElementFinder,
        text: string
    } | null;
}
