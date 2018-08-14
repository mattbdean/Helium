import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { TableName } from '../../common/table-name';

/**
 * Prevents forms being show for part tables. If a part table name is requested,
 * the user is redirected to the form for the master table.
 */
@Injectable()
export class FormsGuard implements CanActivate {
    public constructor(
        private router: Router
    ) {}

    public canActivate(
        route: ActivatedRouteSnapshot
    ): Observable<boolean> | Promise<boolean> | boolean {
        const { schema, table } = route.params;

        const tableName = new TableName(schema, table);

        if (tableName.isPartTable()) {
            this.router.navigate([
                '/forms',
                tableName.schema,
                tableName.masterName!.raw
            ]);
            return false;
        }

        return true;
    }
}
