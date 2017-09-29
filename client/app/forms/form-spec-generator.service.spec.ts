import { Validators } from '@angular/forms';

import { expect } from 'chai';

import {
    Constraint, TableDataType, TableHeader,
    TableMeta
} from '../common/api';
import { FormControlSpec } from './form-control-spec.interface';
import { FormSpecGeneratorService } from './form-spec-generator.service';

/** Special interface to make creating actual textual TableHeader instances easier */
interface TextualHeaderStub {
    name: string;
    nullable?: boolean;
    maxCharacters?: number | undefined;
    enumValues?: string[] | null;
}

interface NumericHeaderStub {
    name: string;
    type: 'float' | 'integer';
    nullable?: boolean;
}

const tableName = 'foo';

const createMetaFor = (headers: TableHeader[], constraints: Constraint[] = []): TableMeta => ({
    name: tableName,
    headers,
    totalRows: -1,
    constraints,
    comment: 'comment'
});

const textualHeader = (h: TextualHeaderStub): TableHeader => {
    const maxCharacters = h.maxCharacters === undefined ? null : h.maxCharacters;
    const nullable = h.nullable !== undefined ? h.nullable : true;

    return {
        name: h.name,
        type: h.enumValues ? 'enum' : 'string',
        rawType: 'mock string',
        isNumerical: false,
        isTextual: true,
        ordinalPosition: -1,
        signed: false,
        nullable,
        maxCharacters,
        charset: 'UTF-8',
        numericPrecision: null,
        numericScale: null,
        enumValues: h.enumValues || null,
        comment: '',
        tableName
    };
};

const numericHeader = (h: NumericHeaderStub): TableHeader => {
    const nullable = h.nullable !== undefined ? h.nullable : true;
    return {
        name: h.name,
        type: h.type,
        rawType: 'mock int',
        isNumerical: true,
        isTextual: false,
        ordinalPosition: -1,
        signed: true,
        nullable,
        maxCharacters: null,
        charset: null,
        numericPrecision: 10, // TODO
        numericScale: 5,
        enumValues: null,
        comment: '',
        tableName
    };
};

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
            subtype: 'text',
            formControlName: 'bar',
            placeholder: 'bar',
            validation: [],
            required: false
        };
        expect(formSpec[0]).to.deep.equal(expected);
    });

    it('should make non-null headers required', () => {
        const formSpec = generator.generate(createMetaFor(
            [textualHeader({ name: 'bar', nullable: false })]
        ));

        const expected: FormControlSpec = {
            type: 'text',
            subtype: 'text',
            formControlName: 'bar',
            placeholder: 'bar',
            validation: [Validators.required],
            required: true
        };
        expect(formSpec).to.deep.equal([expected]);
    });

    it('should handle maxCharacters', () => {
        const formSpec = generator.generate(createMetaFor(
            [textualHeader({ name: 'bar', maxCharacters: 5 })]
        ));

        // Deep equal comparison doesn't work on functions created dynamically.
        // For example:
        //
        // function foo() {
        //   return function() {}
        // }
        //
        // expect(foo()).to.not.deep.equal(foo())
        //
        // Since the other tests verify that all other properties are as
        // expected, we can focus on just the validation
        expect(formSpec[0].validation).to.have.lengthOf(1);
    });

    it('should handle numeric headers', () => {
        const types: Array<'float' | 'integer'> = ['float', 'integer'];

        for (const type of types) {
            const formSpec = generator.generate(createMetaFor(
                [numericHeader({ name: 'bar', type })]
            ))[0];

            expect(formSpec.subtype).to.equal('number');
        }
    });

    it('should handle enumerated values', () => {
        const enumValues = ['one', 'two', 'three'];
        const formSpec = generator.generate(createMetaFor(
            [textualHeader({ name: 'bar', enumValues })]
        ))[0];

        const expected: FormControlSpec = {
            type: 'enum',
            formControlName: 'bar',
            placeholder: 'bar',
            validation: [],
            enumValues,
            required: false
        };

        expect(formSpec).to.deep.equal(expected);
    });

    it('should handle boolean values', () => {
        const formSpec = generator.generate(createMetaFor([{
            name: 'bar',
            type: 'boolean',
            nullable: false,
        } as TableHeader]))[0];

        formSpec.validation.should.have.lengthOf(0);
        formSpec.type.should.equal('boolean');
        formSpec.initialValue.should.be.false;
    });
});
