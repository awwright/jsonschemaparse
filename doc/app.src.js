"use strict";
var CodeMirror = window.CodeMirror = require('codemirror');
var JSONSchemaParse = window.JSONSchemaParse = require('..');
var modes = [
	require('codemirror/mode/javascript/javascript.js'),
	require('codemirror/addon/lint/lint.js'),
];

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
	try {
		const parse = JSONSchemaParse.parseInfo(text, {parseAnnotations:true, parseInfo:true, schema:schema});
		console.log(schema, parse);
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
	} catch(err) {
		var loc = err.position || {};
		found.push({
			from: CodeMirror.Pos(loc.line, loc.column-1),
			to: CodeMirror.Pos(loc.line, loc.column),
			message: err.message,
			severity: 'error',
		});
	}
	return found;
};
