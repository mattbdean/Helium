import { expect } from 'chai';
import * as request from 'supertest';
import { Response } from 'supertest';
import { ErrorResponse } from '../src/common/responses';
import { Helium } from '../src/helium';

export interface ApiRequest {
    /** HTTP request method. Defaults to 'GET' */
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'HEAD' | 'OPTIONS' | 'DELETE';
    /** Path relative to "/api/v1" */
    relPath: string;
    /** Expected HTTP status code (200, 404, etc.) */
    expectedStatus: number;
    /**
     * Validate the content of the API response. Passes the `error` property if
     * expectedStatus isn't 2XX, otherwise passes the `data` property.
     */
    validate?: (dataOrError: any) => void;
    /** Parameters for the query string */
    query?: { [value: string]: string };
    /** Data to be sent in the request body */
    data?: any;
}

export class RequestContext {
    public constructor(public app: Helium) {}

    public spec(conf: ApiRequest) {
        return request(this.app.express)
            // get(path), post(path), put(path), etc.
            [(conf.method || 'GET').toLowerCase()]('/api/v1' + conf.relPath)
            // Add a query string if applicable
            .query(conf.query)
            // Let the server know we want JSON
            .set('Accept', /application\/json/)
            // Send our data, if applicable
            .type('json')
            .send(conf.data)
            // Expect a JSON response
            .expect('Content-Type', /application\/json/)
            .then((res: Response) => {
                if (res.status === 500)
                    // Fail the test, using the request body as the subject of
                    // the expectation so that it gets logged by mocha. Use
                    // the 'deep' flag and compare to an empty object so mocha
                    // prints out a diff
                    expect(res.body).to.deep.equal({});

                expect(res.status).to.equal(conf.expectedStatus);

                if (res.status >= 400 && res.status < 500) {
                    // Returned a 4XX or 5XX status code, verify shape of error
                    const body = res.body as ErrorResponse;
                    expect(Object.keys(body)).to.have.lengthOf(2);
                    expect(body.input).to.be.an('object');
                    expect(body.message).to.be.a('string');
                }

                if (conf.validate)
                    conf.validate(res.body);

                // Return Response so that it can be further validated if need be
                return res;
            });
    }

    public basic(relPath: string,
                 expectedStatus: number,
                 validate?: (dataOrError: any) => void) {
        return this.spec({
            method: 'GET',
            relPath,
            expectedStatus,
            validate
        });
    }
}
