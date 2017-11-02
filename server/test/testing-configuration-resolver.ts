import { ConnectionConf } from '../src/db/connection-conf.interface';
import { JsonConfigurationResolver } from '../src/db/json-configuration-resolver';

export class TestingConfigurationResolver extends JsonConfigurationResolver {
    private cachedConf: Promise<ConnectionConf> | null = null;

    public async resolve(confName: string): Promise<ConnectionConf> {
        if (this.cachedConf !== null)
            return this.cachedConf;

        if (process.env.TRAVIS || process.env.CI) {
            // Automatically detect continuous integration environment
            this.cachedConf = Promise.resolve({ user: 'user', password: 'password', database: 'helium' });
        } else {
            this.cachedConf = super.resolve('test');
        }

        return this.cachedConf;
    }
}
