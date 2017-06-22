import { Component } from '@angular/core';
import { FormGroup } from '@angular/forms';

@Component({
    selector: 'form-input',
    templateUrl: 'form-input.component.html'
})
export class FormInputComponent {
    public config;
    public group: FormGroup;
}
