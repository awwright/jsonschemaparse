"use strict";

const assert = require('assert');
const lib = require('..');
const createReadStream = require('fs').createReadStream;

const SchemaRegistry = lib.SchemaRegistry;

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

describe('StreamParser', function(){
	it('StreamParser#parse', function(){
		var stream = new lib.StreamParser();
		stream.on("openobject", function (node) {
			// same object as above
		});
		// pipe is supported, and it's readable/writable
		// same chunks coming in also go out.
		createReadStream(__dirname+"/vendor-schema-suite/tests/draft2019-09/allOf.json").pipe(stream);
		return new Promise(function(done){ stream.on('finish', done); });
	});
	it('new StreamParser({schema})');
	it('new StreamParser({charset})');
	it('new StreamParser({reviver})');
	it('new StreamParser({parseValue})');
	it('new StreamParser({parseAnnotations})');
	it('new StreamParser({parseInfo})');
	it('new StreamParser({maxKeyLength})');
	it('new StreamParser({maxStringLength})');
	it('new StreamParser({maxNumberLength})');
	it('new StreamParser({maxItems})');
	it('new StreamParser({maxProperties})');
	it('new StreamParser({maxUniqueItems})');
	it('new StreamParser({interoperable})');
	it('new StreamParser({bigNumber})');
	it('new StreamParser({niceNumber})');
	it('new StreamParser({syntaxLineComment})');
	it('new StreamParser({syntaxHashComment})');
	it('new StreamParser({syntaxBlockComment})');
	it('new StreamParser({syntaxNestedComment})');
	it('new StreamParser({syntaxUnquotedKeys})');
	it('new StreamParser({syntaxTrailingComma})');
	it('new StreamParser({syntaxSingleQuote})');
	it('new StreamParser({syntaxEscapeLF})');
	it('new StreamParser({syntaxUTF32})');
	it('new StreamParser({syntaxHexadecimal})');
	it('new StreamParser({syntaxBareDecimal})');
	it('new StreamParser({syntaxInf})');
	it('new StreamParser({syntaxNaN})');
	it('new StreamParser({syntaxPlus})');
});

describe('StreamParser methods', function(){
	it('StreamParser#parse (valid)', function(){
		var stream = new lib.StreamParser({});
		stream.parse("{}");
		assert.strictEqual(stream.errors.length, 0);
	});
	it('StreamParser#parse (invalid)', function(){
		var stream = new lib.StreamParser({});
		assert.throws(function(){
			stream.parse("{");
		});
	});
	it('StreamParser#done (valid)', function(){
		const stream = new lib.StreamParser({parseValue:true});
		createReadStream(__dirname+'/data/well-formed.json').pipe(stream);
		return stream.done.then(function(){
			assert(stream.value);
		});
	});
	it('StreamParser#done (well-formed-invalid)', function(){
		const stream = new lib.StreamParser({parseValue:true, throw:true, schema:{type:'string'}});
		createReadStream(__dirname+'/data/well-formed.json').pipe(stream);
		return stream.done.then(function(){
			throw new Error('Expected error');
		}, function(e){
			assert(e);
		}).then(function(){
			assert(stream.errors.length);
		});
	});
	it('StreamParser#done (invalid)', function(){
		const stream = new lib.StreamParser({parseValue:true});
		createReadStream(__dirname+'/data/invalid.json.txt').pipe(stream);
		return stream.done.then(function(){
			throw new Error();
		}, function(e){
			assert(e);
		}).then(function(){
			assert(stream.errors.length);
		});
	});
	it('parse valid', function(){
		var registry = new SchemaRegistry;
		// This passes just one test
		var schema = registry.import('http://localhost/this.json', {});
		var stream = new lib.StreamParser({parseValue:true, schema});
		stream.on("openobject", function (node) {
			// same object as above
		});
		// pipe is supported, and it's readable/writable
		// same chunks coming in also go out.
		createReadStream(__dirname+"/vendor-schema-suite/tests/draft2019-09/allOf.json").pipe(stream);
		return new Promise(function(done){ stream.on('finish', done); });

	});
	it('parse ref', function(){
		var registry = new SchemaRegistry;
		metaschemas.forEach(function(v){ registry.scan(v); });
		// This passes just one test
		var schema = registry.import('http://localhost/this.json', {
			"$ref": "https://json-schema.org/draft/2019-09/schema",
		});
		var p = new lib.StreamParser({schema});
		p.parse('{"bar": 1}');
		assert(p.errors.length===0);
	});
});

describe('interface', function(){
	it('SchemaRegistry', function(){
		assert(lib.SchemaRegistry);
	});
	it('Schema', function(){
		assert(lib.Schema);
	});
});
