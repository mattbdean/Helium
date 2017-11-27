
////////////////////////////////////////////////////////////////////////////////
// NB: These tests assume that init.sql was run successfully
////////////////////////////////////////////////////////////////////////////////

import GET_api_root from "./api/GET_api_root";
import GET_schemas from "./api/GET_schemas";
import GET_schemas_schema from "./api/GET_schemas_schema";
import GET_schemas_schema_table from "./api/GET_schemas_schema_table";
import GET_schemas_schema_table_column_col from "./api/GET_schemas_schema_table_column_col";
import GET_schemas_schema_table_data from "./api/GET_schemas_schema_table_data";

describe('API v1', () => {
    // Each API endpoint has its own test in the `api` folder. Each of these
    // files exports a function that sets up a describe() block for the
    // endpoint.
    const endpointTests = [
        GET_api_root,
        GET_schemas,
        GET_schemas_schema,
        GET_schemas_schema_table,
        GET_schemas_schema_table_column_col,
        GET_schemas_schema_table_data
    ];

    for (const createEndpointTest of endpointTests)
        createEndpointTest();
});
