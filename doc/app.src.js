
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
	var schema = null;
	if(schema_editor){
		try {
			var parse = JSONSchemaParse.parse(null, {charset:'string', keepValue:true}, schema_editor.getValue());
		} catch(e) {
			console.error(e);
		}
		var value = parse.value;
		if(value !== undefined){
			var schema = new JSONSchemaParse.Schema('_:root', value);
		}
	}
	var found = [];
	try {
		var parse = new JSONSchemaParse.StreamParser(schema, {charset:'string', keepValue:true});
		parse.parse(text);
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
}

