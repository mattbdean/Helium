import { check, fail, group, sleep } from 'k6';
import http from 'k6/http';

const baseUrl = 'http://localhost:3000';
const apiUrl = (endpoint) => baseUrl + '/api/v1' + endpoint;

/**
 * Asserts the given response returned with a 200. Returns its body, parsed as
 * JSON.
 */
const assert200 = (res) => {
    check(res, {
        'request responded with 200': (r) => r.status === 200
    }) || fail('status code not 200' + res.body);
    return JSON.parse(res.body);
}

const pickTable = (schema, rawName, apiKey) => {
    const schemaEncoded = encodeURIComponent(schema);
    // Manual tables start with '#' which will be parsed as the URL fragment
    // if we don't encode it first
    const rawNameEncoded = encodeURIComponent(rawName);

    const params = { headers: { 'X-API-Key': apiKey } };

    // First the metadata is requested
    const meta = assert200(http.get(apiUrl(`/schemas/${schemaEncoded}/${rawNameEncoded}`), params));

    // Then the first page of the data
    const data = assert200(http.get(apiUrl(`/schemas/${schemaEncoded}/${rawNameEncoded}/data`), params));

    return { meta, data };
}

export default function() {
    // Login, get the API key
    // TODO: use different users for more a more realistic simulation
    const apiKey = assert200(http.post(apiUrl('/login'), {
        username: 'user',
        password: 'password'
    })).apiKey;

    // Params for all future GET requests
    const params = { headers: { 'X-API-Key': apiKey } };

    // The first thing the client does immediately after logging in is request
    // the schemas so it can show you the list in the upper-left-hand corner.
    const schemas = assert200(http.get(apiUrl('/schemas'), params));
    const defaultSchema = schemas[0].toLowerCase() === 'information_schema' ? schemas[1] : schemas[0];

    // Once it selects a default schema, it requests the tables in that schema.
    assert200(http.get(apiUrl(`/schemas/${defaultSchema}`), params))

    // User picks the `helium_sample` database
    sleep(3 + Math.random(2));
    const tables = assert200(http.get(apiUrl('/schemas/helium_sample'), params));

    // Simulate the user clicking on random tables in the sidebar
    for (let i = 0; i < Math.min(tables.length, 5); i++) {
        // Sleep for 1-4 seconds
        sleep(1 + Math.random(3));
        const rawName = tables[i].name.raw;

        pickTable('helium_sample', rawName, apiKey);
    }

    // The user finally settled on this table and wants to browse its data
    const { meta, data } = pickTable('helium_sample', 'big_table', apiKey);

    const pageSize = 25;
    const totalRows = meta.totalRows;
    const totalPages = Math.ceil(totalRows / pageSize);

    // Paginate through a random amount of pages, maxing out at 20
    const pages = Math.min(20, Math.round(Math.random(totalPages)));
    for (let i = 0; i < pages; i++) {
        assert200(http.get(apiUrl(`/schemas/helium_sample/big_table/data?page=${i + 1}&limit=${pageSize}`), params));

        // Simulate the user glancing at the data
        sleep(1 + Math.random(1));
    }
}
