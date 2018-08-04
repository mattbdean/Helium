import { Injectable } from '@angular/core';
import { TableStateStorage } from './table-state-storage';

/**
 * Maintains the current TableState in memory but doesn't do anything with it
 */
@Injectable()
export class NoopTableStateStorage extends TableStateStorage {
}
