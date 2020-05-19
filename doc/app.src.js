"use strict";
var CodeMirror = window.CodeMirror = require('codemirror');
var JSONSchemaParse = window.JSONSchemaParse = require('..');
var modes = [
	require('codemirror/mode/javascript/javascript.js'),
	require('codemirror/addon/lint/lint.js'),
];

// declare global: JSONLint
window.JSONLint = function JSONLint(schema_editor, text) {
	if (!window.JSONSchemaParse) {
		if (window.console) {
			window.console.error("Error: window.JSONSchemaParse not defined, CodeMirror JSON linting cannot run.");
		}
		return found;
	}
	// First, parse the schema
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
	// Now, parse the instance against the schema
	var found = [];
	try {
		var parse = JSONSchemaParse.parseInfo(text, {parseValue:true, schema:schema});
		console.log(parse);
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
	return found;
};

