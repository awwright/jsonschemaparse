
var assert = require('assert');

var fs = require('fs');

var SchemaRegistry = require('../index.js').SchemaRegistry;
var Schema = require('../index.js').Schema;
var Parser = require('../index.js').StreamParser;

var metaschemaObject = require('json-metaschema/draft-07-schema.json');

var validationTestFiles = [
	'draft7/additionalItems.json',
	'draft7/additionalProperties.json',
	'draft7/allOf.json',
	'draft7/anyOf.json',
	'draft7/boolean_schema.json',
	'draft7/const.json',
	//'draft7/contains.json',
	'draft7/default.json',
	//'draft7/definitions.json',
	//'draft7/dependencies.json',
	//'draft7/enum.json',
	'draft7/exclusiveMaximum.json',
	'draft7/exclusiveMinimum.json',
	//'draft7/if-then-else.json',
	'draft7/items.json',
	'draft7/maximum.json',
	'draft7/maxItems.json',
	'draft7/maxLength.json',
	'draft7/maxProperties.json',
	'draft7/minimum.json',
	'draft7/minItems.json',
	'draft7/minLength.json',
	'draft7/minProperties.json',
	'draft7/multipleOf.json',
	'draft7/not.json',
	'draft7/oneOf.json',
	'draft7/pattern.json',
	'draft7/patternProperties.json',
	'draft7/properties.json',
	//'draft7/ref.json',
	//'draft7/refRemote.json',
	'draft7/required.json',
	'draft7/type.json',
	//'draft7/uniqueItems.json',
	//'draft7/optional/bignum.json',
	//'draft7/optional/content.json',
	//'draft7/optional/ecmascript-regex.json',
	'draft7/optional/zeroTerminatedFloats.json',
];

describe('Schema tests', function(){
	it('meta', function(){
		assert(validationTestFiles.length);
	})
	validationTestFiles.forEach(function(filename){
		var label = filename;
		var filepath = __dirname+'/vendor-schema-suite/tests/' + filename;
		describe(label, function(done){
			var schemas = require(filepath);
			schemas.forEach(function(schemaTest){
				var tests = schemaTest.tests;
				describe(schemaTest.description, function(){
					tests.forEach(function(t, i){
						it(t.description, function(){
							var tjson = JSON.stringify(t.data, null, "\t");
							var registry = new SchemaRegistry;
							// This passes just one test
							registry.import('http://json-schema.org/draft-07/schema', metaschemaObject);
							var schema = registry.import('http://localhost/'+filepath, schemaTest.schema);
							var p = schema.createParser({charset:'string'});
							p.parse(tjson);
							if(t.valid){
								if(p.errors.length) console.error(p.errors.map(function(v){ return v.toString(); }));
								assert.deepEqual(p.errors.length, 0);
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

