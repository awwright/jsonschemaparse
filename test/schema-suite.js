"use strict";

const assert = require('assert');
const fs = require('fs');

const SchemaRegistry = require('../index.js').SchemaRegistry;
const Schema = require('../index.js').Schema;
const Parser = require('../index.js').StreamParser;

const metaschemas = [
	require('json-metaschema/draft-2019-09-schema.json'),
	require('json-metaschema/draft-2019-09-hyper-schema.json'),
	require('json-metaschema/draft-2019-09-meta-applicator.json'),
	require('json-metaschema/draft-2019-09-meta-content.json'),
	require('json-metaschema/draft-2019-09-meta-core.json'),
	require('json-metaschema/draft-2019-09-meta-format.json'),
	require('json-metaschema/draft-2019-09-meta-meta-data.json'),
	require('json-metaschema/draft-2019-09-meta-validation.json'),
	require('json-metaschema/draft-2019-09-schema.json'),
];

var validationTestFiles = [
	'draft2019-09/additionalItems.json',
	'draft2019-09/additionalProperties.json',
	'draft2019-09/allOf.json',
	'draft2019-09/anchor.json',
	'draft2019-09/anyOf.json',
	'draft2019-09/boolean_schema.json',
	// 'draft2019-09/const.json',
	// 'draft2019-09/contains.json',
	'draft2019-09/default.json',
	'draft2019-09/defs.json',
	// 'draft2019-09/dependentRequired.json',
	// 'draft2019-09/dependentSchemas.json',
	// 'draft2019-09/enum.json',
	'draft2019-09/exclusiveMaximum.json',
	'draft2019-09/exclusiveMinimum.json',
	'draft2019-09/format.json',
	// 'draft2019-09/if-then-else.json',
	'draft2019-09/items.json',
	'draft2019-09/maxItems.json',
	'draft2019-09/maxLength.json',
	'draft2019-09/maxProperties.json',
	'draft2019-09/maximum.json',
	'draft2019-09/minItems.json',
	'draft2019-09/minLength.json',
	'draft2019-09/minProperties.json',
	'draft2019-09/minimum.json',
	'draft2019-09/multipleOf.json',
	'draft2019-09/not.json',
	'draft2019-09/oneOf.json',
	'draft2019-09/pattern.json',
	'draft2019-09/patternProperties.json',
	'draft2019-09/properties.json',
	// 'draft2019-09/propertyNames.json',
	'draft2019-09/ref.json',
	// 'draft2019-09/refRemote.json',
	'draft2019-09/required.json',
	'draft2019-09/type.json',
	// 'draft2019-09/unevaluatedItems.json',
	// 'draft2019-09/unevaluatedProperties.json',
	// 'draft2019-09/uniqueItems.json',
	// 'draft2019-09/optional/bignum.json',
	// 'draft2019-09/optional/content.json',
	// 'draft2019-09/optional/ecmascript-regex.json',
	// 'draft2019-09/optional/format/date-time.json',
	// 'draft2019-09/optional/format/date.json',
	// 'draft2019-09/optional/format/email.json',
	// 'draft2019-09/optional/format/hostname.json',
	// 'draft2019-09/optional/format/idn-email.json',
	// 'draft2019-09/optional/format/idn-hostname.json',
	// 'draft2019-09/optional/format/ipv4.json',
	// 'draft2019-09/optional/format/ipv6.json',
	// 'draft2019-09/optional/format/iri-reference.json',
	// 'draft2019-09/optional/format/iri.json',
	// 'draft2019-09/optional/format/json-pointer.json',
	// 'draft2019-09/optional/format/regex.json',
	// 'draft2019-09/optional/format/relative-json-pointer.json',
	// 'draft2019-09/optional/format/time.json',
	// 'draft2019-09/optional/format/uri-reference.json',
	// 'draft2019-09/optional/format/uri-template.json',
	// 'draft2019-09/optional/format/uri.json',
	'draft2019-09/optional/zeroTerminatedFloats.json',
];

describe('Schema tests', function(){
	it('meta', function(){
		assert(validationTestFiles.length);
	});
	validationTestFiles.forEach(function(filename){
		var label = filename;
		var filepath = __dirname+'/vendor-schema-suite/tests/' + filename;
		describe(label, function(){
			var schemas = require(filepath);
			schemas.forEach(function(schemaTest){
				var tests = schemaTest.tests;
				describe(schemaTest.description, function(){
					tests.forEach(function(t, i){
						it(t.description, function(){
							var tjson = JSON.stringify(t.data, null, "\t");
							var registry = new SchemaRegistry;
							// This passes just one test
							metaschemas.forEach(function(v){ registry.scan(v); });
							var schema = registry.import('http://localhost/'+filename+'/'+i+'/schema', schemaTest.schema);
							assert(schema instanceof Schema);
							var p = schema.createParser({charset:'string'});
							p.parse(tjson);
							if(t.valid){
								if(p.errors.length) console.error(p.errors.map(function(v){ return v.toString(); }));
								assert.strictEqual(p.errors.length, 0);
								// assert.deepEqual(p.errors, []);
							}else{
								assert.notEqual(p.errors.length, 0);
							}
						});
					});
				});
			});
		});
	});
});
