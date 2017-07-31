import { ComponentFactoryResolver, Directive, Input, OnInit, ViewContainerRef } from '@angular/core';
import { FormGroup } from '@angular/forms';

import { FormInputComponent } from './form-input/form-input.component';
import { FormSelectComponent } from './form-select/form-select.component';
import { FormSubmitComponent } from './form-submit/form-submit.component';

const components = {
    input: FormInputComponent,
    select: FormSelectComponent,
    submit: FormSubmitComponent
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
