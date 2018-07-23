import * as process from 'process';

/**
 * Operates on the NODE_ENV environmental variable.
 */
export class NodeEnv {
    private static _defaultInstance = new NodeEnv(process.env.NODE_ENV || '');

    public readonly state: 'prod' | 'test' | 'dev';

    public constructor(nodeEnv: string) {
        const env = nodeEnv.toLowerCase();
        if (env === 'prod' || env === 'production')
            this.state = 'prod';
        else if (env === 'test' || env === 'testing')
            this.state = 'test';
        else
            this.state = 'dev';
    }

    /**
     * Does nothing if production mode.
     */
    public debug(data: any) {
        if (this.state === 'prod') return;
        if (typeof data === 'function') {
            data();
        } else {
            // tslint:disable:no-console
            console.log(data);
        }
    }

    public static getDefault(): NodeEnv {
        return NodeEnv._defaultInstance;
    }
}
