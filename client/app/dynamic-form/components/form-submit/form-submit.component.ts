import { Component } from '@angular/core';
import { FormGroup } from '@angular/forms';

@Component({
    selector: 'form-button',
    template: `
        <div class="dynamic-field form-button" [formGroup]="group">
            <button 
                color="primary"
                md-raised-button
                type="submit"
                [disabled]="config.disabled">
                {{ config.label }}
            </button>
        </div>
    `
})
export class FormSubmitComponent {
    public config: any;
    public group: FormGroup;
}
