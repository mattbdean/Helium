import { Helium } from '../../src/helium';
import { RequestContext } from '../api.test.helper';
import { TestingConfigurationResolver } from '../testing-configuration-resolver';
import * as path from 'path';

const resolver = new TestingConfigurationResolver(path.resolve(__dirname, '../../../db.conf.json'));

export const setupRequestContext = async () => {
    // Always use the 'test' configuration
    const app = new Helium({ api: true }, resolver);
    await app.start('test');
    return new RequestContext(app);
};
