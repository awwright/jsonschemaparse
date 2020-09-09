"use strict";
module.exports.StreamParser = require('./lib/parse.js').StreamParser;
module.exports.parse = require('./lib/parse.js').parse;
module.exports.parseInfo = require('./lib/parse.js').parseInfo;
module.exports.SyntaxError = require('./lib/error.js').SyntaxError;
module.exports.ValidationError = require('./lib/error.js').ValidationError;
module.exports.SchemaRegistry = require('./lib/schema.js').SchemaRegistry;
module.exports.Schema = require('./lib/schema.js').Schema;
