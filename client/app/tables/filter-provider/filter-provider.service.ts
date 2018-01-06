import { Injectable } from '@angular/core';
import { FilterOperation } from '../../common/api';

@Injectable()
export class FilterProviderService {
    public operations(): Array<{ codeName: FilterOperation, displayName: string }> {
        return [
            { codeName: 'lt',    displayName: 'Less Than' },
            { codeName: 'gt',    displayName: 'Greater Than' },
            { codeName: 'eq',    displayName: 'Equal To' },
            { codeName: 'is',    displayName: 'Is' },
            { codeName: 'isnot', displayName: 'Is Not' }
        ];
    }
}
