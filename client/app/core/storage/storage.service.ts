import { Injectable } from '@angular/core';

/**
 * Simple service that uses localStorage as a backend for storing and retrieving
 * data.
 */
@Injectable()
export class StorageService {
    /** Gets a stored value, or null if it doesn't exist. */
    public get(key: string): string | null {
        return localStorage.getItem(key);
    }

    /** Checks if there is a key in the storage */
    public has(key: string) {
        return this.get(key) !== null;
    }

    /** Sets key-value pair in the storage */
    public set(key: string, value: string) {
        localStorage.setItem(key, value);
    }

    /** Removes all data from storage */
    public clear() {
        localStorage.clear();
    }

    /**
     * Deletes a particular key from the storage. Does nothing if that key
     * didn't exist in the first place.
     */
    public delete(key: string) {
        localStorage.removeItem(key);
    }
}
