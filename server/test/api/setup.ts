import * as path from 'path';

import { JsonConfigurationResolver } from '../../src/db/json-configuration-resolver';
import { Helium } from '../../src/helium';
import { RequestContext } from '../api.test.helper';

const resolver = new JsonConfigurationResolver(path.resolve(__dirname, '../../../db.conf.json'));

export const setupRequestContext = async () => {
    // Always use the 'test' configuration
    const app = new Helium({ api: true }, resolver);
    await app.start('test');
    return new RequestContext(app);
};
