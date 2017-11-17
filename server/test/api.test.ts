import GET_api_root from './api/GET_api_root';
import GET_name_column_col from './api/GET_name_column_col';
import GET_tables from './api/GET_tables';
import GET_tables_name from './api/GET_tables_name';
import GET_tables_name_data from './api/GET_tables_name_data';
import PUT_tables_name_data from './api/PUT_tables_name_data';

////////////////////////////////////////////////////////////////////////////////
// NB: These tests assume that init.sql was run successfully
////////////////////////////////////////////////////////////////////////////////

describe('API v1', () => {
    // Each API endpoint has its own test in the `api` folder. Each of these
    // files exports a function that sets up a describe() block for the
    // endpoint.
    const endpointTests = [
        GET_api_root,
        GET_tables,
        GET_tables_name,
        GET_tables_name_data,
        GET_name_column_col,
        PUT_tables_name_data
    ];

    for (const createEndpointTest of endpointTests)
        createEndpointTest();
});
