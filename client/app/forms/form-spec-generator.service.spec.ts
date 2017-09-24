import { Validators } from '@angular/forms';

import { expect } from 'chai';

import { Constraint, TableHeader, TableMeta } from '../common/api';
import { FormControlSpec } from './form-control-spec.interface';
import { FormSpecGeneratorService } from './form-spec-generator.service';

/** Special interface to make creating actual textual TableHeader instances easier */
interface TextualHeaderStub {
    name: string;
    nullable?: boolean;
    maxCharacters?: number | undefined;
    enumValues?: string[] | null;
}

const tableName = 'foo';

const createMetaFor = (headers: TableHeader[], constraints: Constraint[] = []): TableMeta => ({
    name: tableName,
    headers,
    totalRows: -1,
    constraints,
    comment: 'comment'
});

const textualHeader = (h: TextualHeaderStub): TableHeader => ({
    name: h.name,
    type: 'string',
    rawType: `varchar(${h.maxCharacters})`,
    isNumerical: false,
    isTextual: true,
    ordinalPosition: -1,
    signed: false,
    nullable: h.nullable,
    maxCharacters: h.maxCharacters || Infinity,
    charset: 'UTF-8',
    numericPrecision: null,
    numericScale: null,
    enumValues: h.enumValues || null,
    comment: '',
    tableName
});

describe('FormSpecGeneratorService', () => {
    let generator: FormSpecGeneratorService;

    beforeEach(() => {
        generator = new FormSpecGeneratorService();
    });

    it('should handle the simplest possible table', () => {
        const formSpec = generator.generate(createMetaFor(
            [textualHeader({ name: 'bar', nullable: true })]
        ));

        const expected: FormControlSpec = {
            type: 'text',
            formControlName: 'bar',
            placeholder: 'bar',
            validation: []
        };
        expect(formSpec[0]).to.deep.equal(expected);
    });

    it('should make non-null headers required', () => {
        const formSpec = generator.generate(createMetaFor(
            [textualHeader({ name: 'bar', nullable: false })]
        ));

        const expected: FormControlSpec = {
            type: 'text',
            formControlName: 'bar',
            placeholder: 'bar',
            validation: [Validators.required]
        };
        expect(formSpec).to.deep.equal([expected]);
    });
});
