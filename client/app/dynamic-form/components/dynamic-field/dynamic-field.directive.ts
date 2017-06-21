import { ComponentFactoryResolver, Directive, Input, OnInit, ViewContainerRef } from '@angular/core';
import { FormGroup } from '@angular/forms';

import { FormButtonComponent } from '../form-button/form-button.component';
import { FormInputComponent } from '../form-input/form-input.component';
import { FormSelectComponent } from '../form-select/form-select.component';

const components = {
    button: FormButtonComponent,
    input: FormInputComponent,
    select: FormSelectComponent
};

@Directive({
    selector: '[dynamicField]'
})
export class DynamicFieldDirective implements OnInit {
    @Input()
    public config: any;

    @Input()
    public group: FormGroup;

    public component: any;

    public constructor(
        private resolver: ComponentFactoryResolver,
        private container: ViewContainerRef
    ) {}

    public ngOnInit() {
        const component = components[this.config.type];
        if (component === undefined)
            throw new Error('Unknown component type: ' + this.config.type);
        const factory = this.resolver.resolveComponentFactory<any>(component);

        this.component = this.container.createComponent(factory);
        this.component.instance.config = this.config;
        this.component.instance.group = this.group;
    }
}
