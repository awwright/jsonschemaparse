"use strict";

const assert = require('assert');
const lib = require('..');
const createReadStream = require('fs').createReadStream;

const SchemaRegistry = lib.SchemaRegistry;

describe('SchemaRegistry', function(){
	it('SchemaRegistry#import', function(){
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
		return stream.done;
	});
	it('SchemaRegistry#pending');
});
