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

describe('parse(text)', function(){
	it('parse valid', function(){
		const ret = lib.parse('true');
		assert.strictEqual(ret, true);
	});
	it('parse invalid', function(){
		assert.throws(function(){
			const ret = lib.parse('tru');
		});
	});
});

describe('parse(text, reviver)', function(){
	it('parse valid');
});

describe('parse(text, schema)', function(){
	const schema = new lib.Schema('http://example.com/', { type: 'string' });
	it('parse valid', function(){
		const val = lib.parse('""', schema);
		assert.strictEqual(val, "");
	});
	it('parse well-formed invalid', function(){
		assert.throws(function(){
			lib.parse('[]', schema);
		});
	});
	it('parse non-well-formed', function(){
		assert.throws(function(){
			lib.parse('[', schema);
		});
	});
});

describe('parse(text, options)', function(){
	it('parse(text, {schema: Schema}) (valid)', function(){
		const schema = new lib.Schema('http://example.com/', { type: 'string' });
		const text = '""';
		const v = lib.parse(text, {schema: schema});
		assert.strictEqual(v, "");
	});
	it('parse(text, {schema: Schema}) (invalid)', function(){
		const schema = new lib.Schema('http://example.com/', { type: 'string' });
		const text = '{}';
		assert.throws(function(){
			lib.parse(text, {schema: schema});
		});
	});
	it('parse(text, {schema: obj}) (valid)', function(){
		const schema = { type: 'string' };
		const text = '""';
		const v = lib.parse(text, {schema: schema});
		assert.strictEqual(v, "");
	});
	it('parse(text, {schema: obj}) (invalid)', function(){
		const schema = { type: 'string' };
		const text = '{}';
		assert.throws(function(){
			lib.parse(text, {schema: schema});
		});
	});
	it('parse(text, {invalid}) (invalid)', function(){
		const text = '{}';
		assert.throws(function(){
			lib.parse(text, {type: "string"});
		});
	});
	it('parse(text, {reviver}) (valid)');
	it('parse(text, {charset}) (valid ASCII)');
	it('parse(text, {charset}) (invalid ASCII)');
	it('parse(text, {charset}) (valid UTF-8)');
	it('parse(text, {charset}) (invalid UTF-8)');
});

describe('parse(text, {parseAnnotations})', function(){
	it('parse(text, {}) (default)');
	it('parse(text, {parseAnnotations: false}) (disabled)');
	it('parse(text, {parseAnnotations: true}) (enabled)');
});

describe('parse(text, {parseInfo})', function(){
	it('parse(text, {}) (default)');
	it('parse(text, {parseInfo: false}) (disabled)');
	it('parse(text, {parseInfo: true}) (enabled)');
});

describe('parse(text, {syntax})', function(){
});

describe('parseAnnotated(text, options)', function(){
	it('parse valid');
	it('parse ref');
});

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
	it('parse valid', function(){
		var registry = new SchemaRegistry;
		// This passes just one test
		var schema = registry.import('http://localhost/this.json', {});
		var stream = schema.createParser({charset:'string', parseValue:true});
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
		var p = schema.createParser({charset:'string'});
		p.parse('{"bar": 1}');
		assert(p.errors.length===0);
	});
});

describe('SchemaRegistry', function(){
	it('SchemaRegistry#import', function(){
		var registry = new SchemaRegistry;
		// This passes just one test
		var schema = registry.import('http://localhost/this.json', {});
		var stream = schema.createParser({charset:'string', parseValue:true});
		stream.on("openobject", function (node) {
			// same object as above
		});
		// pipe is supported, and it's readable/writable
		// same chunks coming in also go out.
		createReadStream(__dirname+"/vendor-schema-suite/tests/draft2019-09/allOf.json").pipe(stream);
		return new Promise(function(done){ stream.on('finish', done); });
	});
});
