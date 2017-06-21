import { Component, OnInit } from '@angular/core';

@Component({
    selector: 'form-host',
    templateUrl: 'form-host.component.html'
})
export class FormHostComponent implements OnInit {
    public constructor() { }

    public config: any[] = [
        {
            type: 'input',
            label: 'Full name',
            name: 'name',
            placeholder: 'Enter your name'
        },
        {
            type: 'select',
            label: 'Favourite food',
            name: 'food',
            options: ['Pizza', 'Hot Dogs', 'Knakworstje', 'Coffee'],
            placeholder: 'Select an option'
        },
        {
            label: 'Submit',
            name: 'submit',
            type: 'button'
        }
    ];

    public ngOnInit() { }

    public onFormSubmitted(event) {
        console.log(event);
    }
}
