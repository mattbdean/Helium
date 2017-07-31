import { AfterViewInit, Component } from '@angular/core';
import { FormGroup } from '@angular/forms';

@Component({
    selector: 'form-button',
    template: `
        <div class="dynamic-field form-submit" [formGroup]="group">
            <button 
                color="primary"
                md-raised-button
                [disabled]="config.disabled">
                {{ config.label }}
            </button>
        </div>
    `
})
export class FormSubmitComponent implements AfterViewInit {
    public config: any;
    public group: FormGroup;

    public ngAfterViewInit(): void {
        this.group.statusChanges.subscribe(() => { 
            // Disable the button when invalid
            this.config.disabled = this.group.invalid;
         });
    }
}
