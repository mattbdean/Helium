import * as LRU from 'lru-cache';
import * as hash from 'object-hash';
import { createPool, Pool } from 'promise-mysql';
import { ConnectionConf } from './connection-conf.interface';
import { QueryHelper } from './query-helper';

/**
 * This class helps manage connection pools to multiple hosts. This is a very
 * simple alternative to mysql's PoolCluster, but that supports Promises via
 * mysql-promise.
 */
export class DatabaseHelper {
    private pools: LRU.Cache<string, Pool>;

    /**
     * @param {number} sessionLengthMs The maximum time in milliseconds a
     * connection will remain open before it's closed.
     */
    public constructor(private readonly sessionLengthMs: number) {
        this.pools = LRU({
            maxAge: this.sessionLengthMs,
            dispose: (key: string, pool: Pool) => pool.end(),
            // Since we extend a session by doing cache.set(key, cache.get(key)),
            // the pool will be disposed every time we refresh the session. This
            // property disables that. Only pools that expire or are explicitly
            // removed will be disposed.
            noDisposeOnSet: true
        });
    }

    /**
     * Attempts to create a pool of connections with the given configuration.
     * If successful, a QueryHelper can be created for this pool via
     * `queryHelper`.
     * @param {ConnectionConf} conf Some configuration to use to connect to the
     * database
     * @returns {Promise<string>} If successful, will resolve to the unique key
     * capable of accessing this connection pool again.
     */
    public async authenticate(conf: ConnectionConf): Promise<string> {
        const key = this.createKey(conf);
        if (this.pools.has(key))
            return key;

        const pool = this.createPool(conf);

        try {
            // Attempt to make a connection
            await pool.getConnection();
            this.pools.set(key, pool);
            return key;
        } catch (ex) {
            // Clean up on failure
            throw ex;
        }
    }

    /**
     * Creates a QueryHelper by looking up the Pool associated with the given
     * key. Throws an error if there is none.
     */
    public queryHelper(key: string): QueryHelper {
        if (!this.hasPool(key))
            throw new Error(`No pool with key '${key}'`);

        // Return a QueryHelper that extends the session for this key every time
        // a query is executed
        return new QueryHelper(this.pools.get(key)!!, () => this.extendSession(key));
    }

    /** Checks if a pool exists for a given key */
    public hasPool(key: string) {
        return this.pools.has(key);
    }

    /** Returns a list of all connection pools */
    public keys(): string[] { return this.pools.keys(); }

    /** Returns the number of connection pools currently open */
    public size(): number { return this.pools.itemCount; }

    /**
     * Closes the connection pool associated with the given key. Does nothing if
     * there is none.
     */
    public async close(key: string): Promise<void> {
        this.pools.del(key);
    }

    /** Closes all connection pools */
    public async closeAll() {
        this.pools.reset();
    }

    /** Manually removes all expired sessions */
    public prune() {
        this.pools.prune();
    }

    /**
     * Determines the current expiration of the given API key in Unix epoch time
     * (in milliseconds).
     * 
     * @returns A negative number if the ky doesn't exist, otherwise the unix
     * epoch time in milliseconds at which the key will be considered valid.
     */
    public expiration(key: string): number {
        // Internally, node-lru-cache uses Symbols for "internal" properties.
        // The 'cache' symbol is the key for the internal ES2015 Map where it
        // stores all of the data.
        const cacheSymbol = Symbol.for('cache');
        const map = this.pools[cacheSymbol];

        if (!map.has(key))
            // No entry, always expired
            return -1;

        // This next section is highly dependent on the library internals.
        // Prepare for breakage if the lib goes through major internal changes.
        const entry = map.get(key).value;

        // entry.now is the absolute epoch time when the item was inserted,
        // entry.maxAge is maximum amount time in milliseconds that the entry
        // had to live before it was considered expired
        const created: number = entry.now;
        const maxAge: number = entry.maxAge;
        return created + maxAge;
    }

    /** Extends the life of a session */
    private extendSession(key: string) {
        // Recreate the key, thereby extending its max age
        if (this.pools.has(key))
            this.pools.set(key, this.pools.get(key)!!);
    }

    // noinspection JSMethodCanBeStatic
    /** Exists entirely for stubbing purposes */
    private createPool(conf: ConnectionConf) {
        return createPool(conf);
    }

    // noinspection JSMethodCanBeStatic
    /** Exists entirely for stubbing purposes */
    private createKey(conf: ConnectionConf): string {
        // MD5 and SHA-1 are broken
        return hash(conf, { algorithm: 'sha256' });
    }
}
