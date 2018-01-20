import { Injectable } from '@angular/core';
import { Operation } from '../filter/operation';

@Injectable()
export class FilterProviderService {
    public operations(): Operation[] {
        return [
            { codeName: 'lt',    displayName: 'Less Than' },
            { codeName: 'gt',    displayName: 'Greater Than' },
            { codeName: 'eq',    displayName: 'Equal To' },
            { codeName: 'is',    displayName: 'Is Null' },
            { codeName: 'isnot', displayName: 'Is Not Null' }
        ];
    }
}
