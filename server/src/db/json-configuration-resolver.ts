import * as fs from 'fs';
import * as path from 'path';

import { ConfigurationResolver } from './configuration-resolver';
import { ConnectionConf } from './connection-conf.interface';

/**
 * Resolves database connection configurations from a JSON file. A valid
 * configuration file is a JSON object whose keys are the configuration names
 * and whose values are `ConnectionConf` instances.
 */
export class JsonConfigurationResolver extends ConfigurationResolver {
    public readonly jsonConf: string;

    public constructor(jsonConf: string) {
        super();
        this.jsonConf = path.resolve(jsonConf);
    }

    public async resolve(confName: string): Promise<ConnectionConf> {
        const parsed = await this.readJson(this.jsonConf);

        if (!parsed[confName]) {
            throw new Error(`Database conf (${this.jsonConf}) has no property "${confName}"`);
        }

        const result = parsed[confName];
        if (result === null || result === undefined || typeof(result) !== 'object')
            throw new Error(`Invalid configuration for name '${confName}': ${result}`);

        return result as ConnectionConf;
    }

    protected async readJson(file: string): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            fs.readFile(file, 'utf8', (err: NodeJS.ErrnoException, data: string) => {
                if (err) return reject(err);
                try {
                    resolve(data);
                } catch (err) {
                    reject(err);
                }
            });
        }).then(JSON.parse);
    }
}
