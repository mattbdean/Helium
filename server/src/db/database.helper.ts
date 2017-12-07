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
            dispose: (key: string, pool: Pool) => pool.end()
        });
    }

    // TODO: Every 30 mins or so clean up expired pools. Right now the only way
    // they're cleaned is if we call this.pools.get(expiredKey). We can manually
    // remove all expired items using this.pools.prune()

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

        return new QueryHelper(this.pools.get(key)!!);
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
