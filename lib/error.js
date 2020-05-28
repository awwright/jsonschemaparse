"use strict";

module.exports.SyntaxError = SyntaxError;
function SyntaxError(message, propertyPath, position, expected, actual){
	this.message = message;
	this.path = propertyPath;
	this.position = position;
	this.expected = expected;
	this.actual = actual;
}

module.exports.ValidationError = ValidationError;
function ValidationError(message, layer, schema, keyword, expected, actual){
	this.message = message;
	this.path = layer.path;
	this.layer = layer;
	this.position = {line:layer.beginLine, column:layer.beginColumn};
	this.to = {line:layer.endLine, column:layer.endColumn};
	//this.schema = schema;
	this.schemaId = schema.id;
	this.keyword = keyword;
	this.expected = expected;
	this.actual = actual;
}
ValidationError.prototype.toString = function toString(){
	return this.message
		+ '\n\t' + JSON.stringify(this.expected)
		+ '\n\t' + JSON.stringify(this.actual);
};

module.exports.Annotation = Annotation;
function Annotation(value, layer, schema, keyword){
	this.value = value;
	this.path = layer.path;
	this.layer = layer;
	this.position = {line:layer.beginLine, column:layer.beginColumn};
	this.to = {line:layer.endLine, column:layer.endColumn};
	//this.schema = schema;
	this.schemaId = schema.id;
	this.keyword = keyword;
}
