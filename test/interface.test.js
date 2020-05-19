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
	it('parse(text, {reviver}) (valid)', function(){
		function reviver(k, v){
			if(v && v.$Date) return new Date(v.$Date);
			return v;
		}
		const text = '{"begin": {"$Date": "2020-05-15T21:39:22.626Z"}}';
		const v = lib.parse(text, reviver);
		assert(typeof v==='object');
		assert(v.begin);
		assert(v.begin instanceof Date);
	});
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

describe('Parser', function(){
	it('new Parser()', function(){
		var registry = new SchemaRegistry;
		// This passes just one test
		var schema = registry.import('http://localhost/this.json', {});
		var stream = schema.createParser({charset:'string', keepValue:true});
		stream.on("openobject", function (node) {
			// same object as above
		});
		// pipe is supported, and it's readable/writable
		// same chunks coming in also go out.
		createReadStream("file.json").pipe(stream);
		return new Promise(function(done){ stream.on('finish', done); });
	});
	it('new Parser({schema})');
	it('new Parser({charset})');
	it('new Parser({reviver})');
	it('new Parser({parseValue})');
	it('new Parser({parseAnnotations})');
	it('new Parser({parseInfo})');
	it('new Parser({maxKeyLength})');
	it('new Parser({maxStringLength})');
	it('new Parser({maxNumberLength})');
	it('new Parser({maxItems})');
	it('new Parser({maxProperties})');
	it('new Parser({maxUniqueItems})');
	it('new Parser({interoperable})');
	it('new Parser({bigNumber})');
	it('new Parser({niceNumber})');
	it('new Parser({syntaxLineComment})');
	it('new Parser({syntaxHashComment})');
	it('new Parser({syntaxBlockComment})');
	it('new Parser({syntaxNestedComment})');
	it('new Parser({syntaxUnquotedKeys})');
	it('new Parser({syntaxTrailingComma})');
	it('new Parser({syntaxSingleQuote})');
	it('new Parser({syntaxEscapeLF})');
	it('new Parser({syntaxUTF32})');
	it('new Parser({syntaxHexadecimal})');
	it('new Parser({syntaxBareDecimal})');
	it('new Parser({syntaxInf})');
	it('new Parser({syntaxNaN})');
	it('new Parser({syntaxPlus})');
	it('Parser#parse', function(){
		var registry = new SchemaRegistry;
		// This passes just one test
		var schema = registry.import('http://localhost/this.json', {});
		var stream = schema.createParser({charset:'string', keepValue:true});
		stream.on("openobject", function (node) {
			// same object as above
		});
		// pipe is supported, and it's readable/writable
		// same chunks coming in also go out.
		createReadStream("file.json").pipe(stream);
		return new Promise(function(done){ stream.on('finish', done); });
	});
	it('parse valid', function(){
		var registry = new SchemaRegistry;
		// This passes just one test
		var schema = registry.import('http://localhost/this.json', {});
		var stream = schema.createParser({charset:'string', keepValue:true});
		stream.on("openobject", function (node) {
			// same object as above
		});
		// pipe is supported, and it's readable/writable
		// same chunks coming in also go out.
		createReadStream("file.json").pipe(stream);
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

