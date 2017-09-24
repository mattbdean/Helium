import {
    ComponentFactoryResolver, ComponentRef, Directive, Input,
    OnInit, ViewContainerRef
} from '@angular/core';
import { FormGroup } from '@angular/forms';

import { AbstractFormControl } from './abstract-form-control.class';
import { FormControlSpec } from './form-control-spec.interface';
import { InputControlComponent } from './input-control.component';

/**
 * This directive dynamically inserts an AbstractFormControl based on the given
 * configuration.
 */
@Directive({
    selector: '[dynamicFormControl]'
})
export class DynamicFormControlDirective implements OnInit {
    @Input()
    public control: FormControlSpec;

    @Input()
    public group: FormGroup;

    public component: ComponentRef<AbstractFormControl>;

    public constructor(
        private resolver: ComponentFactoryResolver,
        private container: ViewContainerRef
    ) {}

    public ngOnInit() {
        // TODO: More components, service/injected value for resolving all types
        const component = InputControlComponent;

        const factory = this.resolver.resolveComponentFactory(component);

        this.component = this.container.createComponent<AbstractFormControl>(factory);
        this.component.instance.spec = this.control;
        this.component.instance.group = this.group;
    }
}
