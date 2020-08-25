"use strict";
var CodeMirror = window.CodeMirror = require('codemirror');
var JSONSchemaParse = window.JSONSchemaParse = require('..');
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
var modes = [
	require('codemirror/mode/javascript/javascript.js'),
	require('codemirror/addon/lint/lint.js'),
];

function parseLint(text, schema){
	var found = [];
	try {
		var parse = JSONSchemaParse.parseInfo(text, {parseAnnotations:true, parseInfo:true, schema:schema});
	} catch(err) {
		var loc = err.position || {};
		found.push({
			from: CodeMirror.Pos(loc.line, loc.column-1),
			to: CodeMirror.Pos(loc.line, loc.column),
			message: err.message,
			severity: 'error',
		});
	}
	if(parse && parse.errors) parse.errors.forEach(function(err){
		var layer = err.layer || {};
		found.push({
			from: CodeMirror.Pos(layer.beginLine, layer.beginColumn),
			to: CodeMirror.Pos(layer.endLine, layer.endColumn),
			message: err.message,
			severity: 'warning',
		});
	});
	if(parse && parse.annotations) parse.annotations.forEach(function(ann){
		var layer = ann.layer || {};
		found.push({
			from: CodeMirror.Pos(layer.beginLine, layer.beginColumn),
			to: CodeMirror.Pos(layer.beginLine, layer.beginColumn+1),
			message: ann.value,
			severity: 'message',
		});
	});
	return found;

}

window.JSONSchemaLint = function JSONSchemaLint(text){
	console.log(text);
	if (!window.JSONSchemaParse) {
		if (window.console) {
			window.console.error("Error: window.JSONSchemaParse not defined, CodeMirror JSON linting cannot run.");
		}
		return [];
	}

	var registry = new JSONSchemaParse.SchemaRegistry;
	// This passes just one test
	metaschemas.forEach(function(v){ registry.scan(v); });
	const schema = registry.lookup('https://json-schema.org/draft/2019-09/schema');
	if(!schema){
		if (window.console) {
			window.console.error("Error: Schema <https://json-schema.org/draft/2019-09/schema> not found");
		}
		return [];
	}
	return parseLint(text, schema);
};

// declare global: JSONLint
window.JSONLint = function JSONLint(schema_editor, text) {
	// Now, parse the instance against the schema
	var found = [];
	if (!window.JSONSchemaParse) {
		if (window.console) {
			window.console.error("Error: window.JSONSchemaParse not defined, CodeMirror JSON linting cannot run.");
		}
		return found;
	}
	// First, parse the schema, if one is supplied
	if(schema_editor){
		try {
			var schemaObject = JSONSchemaParse.parse(schema_editor.getValue());
		} catch(e) {
			console.error(e);
		}
		if(schemaObject !== undefined){
			var schema = new JSONSchemaParse.Schema('_:root', schemaObject);
		}
	}
	return parseLint(text, schema);
};
