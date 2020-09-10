"use strict";
/**
 * @type {import('@stryker-mutator/api/core').StrykerOptions}
 */
module.exports = {
	mutator: "javascript",
	packageManager: "yarn",
	reporters: ["html", "clear-text", "progress"],
	testRunner: "mocha",
	transpilers: [],
	testFramework: "mocha",
	coverageAnalysis: "perTest",
	mochaOptions: {
		// Optional mocha options
		spec: [
			'test/interface.test.js',
			'test/parse.test.js',
			'test/parseInfo.test.js',
			'test/validate.test.js',
			'test/syntax-suite.test.js',
			'test/Schema.test.js',
			// 'test/SchemaRegistry.test.js',
		],
	},
	mutate: [
		'index.js',
		'lib/*.js',
	],
	files: [
		'index.js',
		'lib/*.js',
		'test/*.test.js',
		'test/vendor-syntax-suite/test_parsing/*.json',
		'test/vendor-schema-suite/tests/**/*.json',
	],
};
