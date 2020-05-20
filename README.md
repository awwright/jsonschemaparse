 # JSONSchemaParse
 
 Parse a JSON Document into an object structure, validating it against a JSON Schema

Features:

* Stream parse a JSON document
* Provide useful feedback about JSON parse errors
	- Line numbers
	- Repeated keys
	- Syntax errors
* Validates the JSON document against a JSON Schema
	- Provides line/character information of error
* Parse JSON instances into an instance of an arbitrary object - parse dates directly into Date, integers into arbitrary precision object, objects into Immutable Map, etc.
	- Allow JSON values to be filtered through a filter after parsing, so strings can be cast to Dates, objects to Immutable objects, etc.
   - Filter based on schema URI, type, format, and non-trivial cases like too-big numbers, and whatever else is appropriate

## API

### parse(text)

Parses _text_ and turns it into a native value.

For reading a Uint8Array/Buffer, specify `charset` in the options (see the `parse(text, options)` form below).


### parse(text, reviver)

Parses _text_ and turns it into a native value. The _reviver_ argument is applied to each value, compatible with ECMAScript `JSON.parse`.

Equivalent to ECMAScript `JSON.parse(text, reviver)`.


### parse(text, schema)

Parses _text_ while validating it against the Schema instance in the _schema_ argument. Parsing will terminate at the first validation error.

```javascript
try {
	const schema = new lib.Schema({ type: 'string' });
	const value = lib.parse(jsonText, schema);
}catch(e){
	// handle SchemaError or ValidationError
}
```


### parse(text, options)

Parses _text_, and accepts an object _options_ as found in StreamParser, except for the "parse" options, which are called with the following values: `parseValue:true, parseAnnotations:false, parseInfo:false`.

```javascript
try {
	const value = lib.parse(jsonText, {
		schema: { type: 'string' },
		charset: 'UTF-8',
	});
}catch(e){
	// handle SchemaError or ValidationError
}
```


### parseInfo(text, options)

Parses _text_ and returns an Instance instance. Use it when you need to know additional information about the JSON document, including JSON Schema annotations on each value, or the line/character position information of each value.

`options` is an object with any of the following properties:

* schema: a Schema instance, or an object representing a parsed schema document
* reviver: An ECMAScript `JSON.parse` compatible reviving function.
* charset: The character set, if `text` is a Uint8Array/Buffer. `ASCII` and `UTF-8` values permitted.
* annotations: true/false to collect or ignore annotations. Default true.


The returned object will have the following properties:

* type: object/array/string/number/boolean/null, depending on the type
* native: the JSON.parse equivalent value
* annotations: A list of all the JSON Schema annotations collected for this instance
* links: A list of all the links collected through JSON Hyper-schema. Unlike "annotations", each rel= in a single link produces a new item in this list.
* properties: if instance is an object, contains a list of PropertyInstance items.
* keys: if instance is an object, contains a map of key names to PropertyInstance items.
* key: if instance is a PropertyInstance, this contains a StringInstance holding the key of the property.
* items: if instance is an array, contains a list of Instance items.
* map: a Map of all the child objects/arrays in the instance, mapped to their corresponding Instance


### new StreamParser(options)

StreamParser is a writable stream that accepts a byte stream or string stream, and outputs events.

It outputs an "end" event when the document has been fully parsed.

options is an object with any of the following properties:

* `schema`: A schema instance or plain object, to be validated against the incoming document.
* `charset`: The character set used to decode a Buffer/Uint8Array. Valid values: `ASCII`, `UTF-8`
* `reviver`: A function that consumes and maps values immediately after validation (same interface as ECMAScript).
* `parseValue`: if `true`, return value will include a `value` property with the JSON.parse equivalent parsed value. Default `false`.
* `parseAnnotations`: If `true`, return value will include annotations/links properties, with JSON Schema annotations (e.g. the "title", "description" keywords.)
* `parseInfo`: If `true`, return value will include properties/keys/map properties with StreamParser output from child instances.
* `maxKeyLength`: Enforces a limit on object keys, in UTF-16 characters, for memory purposes
* `maxStringLength`: Enforces a limit on strings (except keys), in UTF-16 characters, for memory purposes
* `maxNumberLength`: Enforces a limit on the lexical representation of numbers, in characters, for memory purposes when "bigNumber" is enabled.
* `maxItems`: Enforces a limit on number of items in each array, for memory purposes
* `maxProperties`: Enforces a limit on number of properties in each object, for memory purposes
* `maxUniqueItems`: Enforces a limit on size of all arrays tested by `uniqueItems` (since this is an O(n²) operation)
* `interoperable`: Raise an error if the document is outside the I-JSON (RFC 7493) subset of JSON.
* `bigNumber`: Determines behavior for numbers too large to represent in an ECMAScript number without loss of precision. See "bigNumber" section below for possible values.
* `niceNumber`: Determines behavior for all other numbers (numbers accurately represented in an ECMAScript number).
* `syntaxLineComment`: Treats `//` as whitespace until the end of the line
* `syntaxHashComment`: Treats `#` as whitespace until the end of the line
* `syntaxBlockComment`: Treats `/*` as whitespace until a `*/` sequence (no nested comments)
* `syntaxNestedComment`: Treats `/*` as whitespace until a `*/` sequence (allows nesting, overrides syntaxBlockComment)
* `syntaxUnquotedKeys`: Permits a bare, unqouted ECMAScript 5.1 IdentifierName as a property key
* `syntaxTrailingComma`: Allows arrays and objects to end with a trailing comma (by configuring the parser so a comma doesn't imply another property/item)
* `syntaxSingleQuote`: Permits single quotes for strings, including property keys
* `syntaxEscapeLF`: A backslash linefeed sequence (i.e. a backslash as the last character on a line) will ignore the newline. (The backslash and LF character will both be discarded entirely.) This allows a ␊ character to be broken across multiple lines as the four-character string `"\n\␊"` (instead of the two character-string `"\n"` all on a single line).
* `syntaxUTF32`: Permits `\Uxxxxxxxx` or `\u{x...}` sequences (where `x` is a hex digit) for representing Unicode code points outside the BMP (Basic Multilingual Plane), that would normally only be escaped via a UTF-16 surrogate pair.
* `syntaxHexadecimal`: Permits numbers starting with `0x` to be interpreted as hexadeciamal. Only integers can be expressed with this form.
* `syntaxBareDecimal`: Permits numbers to start or end with a decimal (otherwise, a `0` would have to come before or after it).
* `syntaxInf`: Permits `Infinity` and `-Infinity`. This is not compatible with JSON Schema, use with caution.
* `syntaxNaN`: Permits `NaN` as a number value. This is not compatible with JSON Schema, use with caution.
* `syntaxPlus`: Permits a leading + before a number.

Values for "bigNumber" (all these options are performed after JSON Schema validation):

* `default`: Use nearest floating point representation, same behavior as JSON.parse
* `error`: Treat as a validation error
* function: Pass a function `function(json, validator)` that returns the value to use.
* `json`: Use the raw JSON in a string. This may be in exponential notation, depending on how it was present in the original document.
* `string`: Cast to a decimal number. There will be an optional minus sign, one or more digits, a decimal point, and one or more digits. The `maxNumberLength` will be enforced on this new string, if present.
* `intstr`: Encode as a string, but only guarantees the accuracy of the integer part. This is best used with the `type: "integer"` keyword.
* `fraction`: will return an array with two BitInt numbers: the numerator, and denominator. The denominator will always be a non-negative exponent of 10, with one zero for each number past the decimal point.
* `properfraction`: will return an array with three BitInt numbers: the whole part, the fractional part numerator, and the fractional part denominator. The denominator will always be a non-negative exponent of 10, with one zero for each number past the decimal point.

```javascript
var parser = new StreamParser(new Schema('http://localhost/schema.json', {type: 'array'}), {parseValue:true});

fs.createReadStream('file.json')
	.pipe(parser)
	.on('finish', function(err, res){
		console.log(parser.errors);
		console.log(parser.value);
	});
```

### StreamParser#errors

An Array of ValidationError instances representing accumulated validation errors.
Parsing will end when an error is detected, not all errors in the document may be listed.


### StreamParser#value

If `parseValue: true` was passed in `options`, the parsed value will be available here.


### StreamParser#on('startObject', function() )
Emitted when an object is opened (when `{` is observed).


### StreamParser#on('endObject', function() )
Emitted when an object is closed (when `}` is observed).


### StreamParser#on('startArray', function() )
Emitted when an array is opened (when `[` is observed).


### StreamParser#on('endArray', function() )
Emitted when an array is closed (when `]` is observed).


### StreamParser#on('key', function(name) )
Emitted inside an object when a key is fully parsed.


### StreamParser#on('string', function(value) )
Emitted when a string value is parsed.


### StreamParser#on('boolean', function(value) )
Emitted when a boolean value is parsed.


### StreamParser#on('null', function(value) )
Emitted when a null is parsed.


### StreamParser#on('end', function() )
Emitted when the incoming stream been fully consumed, parsed, and a final result is available.


### new Schema(baseURI, schemaObject)

* baseURI: The URI the schema was downloaded at, if any.
* schemaObject: A parsed JSON schema. Must be an object, JSON Schema documents can simply be run through `JSON.parse` to generate a compatible object.

```javascript
var schema = new Schema('http://localhost/schema.json', { type: 'array' });
var parser = schema.createParser({parseValue:true});

fs.createReadStream('file.json')
	.pipe(parser)
	.on('finish', function(err, res){
		console.log(parser.errors);
		console.log(parser.value);
	});
```

### Schema#parse(text, options)

Parses the given string against the schema, into a native value. Throws on a validation or parse error.

Similar to the `parse(text, options)` function, but with the "schema" option set.


### Schema#parseInfo(text, options)

Parses the given string against the schema, into a validation result.

Similar to the `parse(text, options)` function, with the "schema" option set.


### Schema#createParser(options)
Create a `StreamParser` instance with the given options.
The parser will validate the incoming stream against the Schema.


### class: SchemaRegistry

Use SchemaRegistry if one schema references another.


### SchemaRegistry#import(uri, schema)

Import a schema so that it may be referenced by its given URI by other schemas.

```javascript
var registry = new SchemaRegistry();
var baseSchema = registry.import('http://localhost/schema.json', { type: 'array', items:{$ref:'http://localhost/item.json'} });
var stringSchema = registry.import('http://localhost/item.json', { type: 'string' });
// Alternatively:
// var schema = new Schema('http://localhost/schema.json', { type: 'array' }, registry);
var parser = baseSchema.createParser({parseValue:true});

fs.createReadStream('file.json')
	.pipe(parser)
	.on('finish', function(err, res){
		console.log(parser.errors);
		console.log(parser.value);
	});
```

### ValidationError

Stores information about a failed validation of a keyword against an instance. Contains the following properties:

* message: A human-readable, english message.
* path: array of keys or array indexes leading to the instance.
* layer: the current parse state of the current item in the stack
* position: An object with line/column properties. Zero-indexed, and may vary depending on character set.
* to: An object with line/column properties, indicating the position where the error ends.
* schema: the Schema object that generated the error
* schemaId: the URI address of the schema that generated the error
* keyword: The keyword in the schema that generated the error
* expected: The value of the keyword
* actual: the value of the instance that failed validation


### Interface: Validator
A Validator is the paradigm used to validate information from the JSON parser as it is streaming. It validates a single instance against a single schema by reading SAX events from the parser, as well as listening to results from subordinate validators (Validator instances for child instances and subschemas), and comparing them to the range of events permitted by the schema.

It is an ECMAScript object that consumes information about a single layer in the parser stack as it tokenizes input.
A validator only evaluates over a single layer in the stack (like an object or a string), it is not notified of events that happen in children or grandchildren layers.
Instead, when a child is encountered (like an array item), a function is called requesting a list of validators that can process that sub-instance.
When the child finishes parsing, the validator can then examine the return value and act on it.

A new validator does not yet know the type of incoming value, and may not know until e.g. all whitespace is consumed. You must wait for a start{type} call.

### new Validator(options, errors)
Called to create a validator, whenever a new layer in the parsing stack is entered.

Optionally pass an outside array that errors will be pushed to.
Normally, this will be the instance of StreamParser#errors, so that errors from all validators get gathered together at the parser.
Otherwise, a local array will be created.

The parser will call the following methods, depending on the tokens it encounters during parsing:

* Validator#startObject(layer)
* Validator#endObject(layer)
* Validator#validateProperty(k)
* Validator#startKey(layer)
* Validator#endKey(layer, name)
* Validator#startArray(layer)
* Validator#endArray(layer)
* Validator#validateItem(i)
* Validator#startNumber(layer)
* Validator#endNumber(layer, value)
* Validator#startString(layer)
* Validator#endString(layer, value)
* Validator#startBoolean(layer)
* Validator#endBoolean(layer, value)
* Validator#startNull(layer)
* Validator#endNull(layer, value)


## Migrating from other parsers


### ECMAScript builtin JSON.parse

Use `lib.parse` in place of `JSON.parse`.

This library only parses, so there is no equivalent to `JSON.stringify`


### JSON5

Homepage: <https://github.com/json5/json5>

JSON5 is a library that supports a superset of the JSON syntax, with a JSON.parse compatible API.

In place of `JSON5.parse`, use `lib.parse` as follows:

```
const JSON5opts = {
	syntaxUnquotedKeys: true,
	syntaxTrailingComma: true,
	syntaxSingleQuote: true,
	syntaxEscapeLF: true,
	syntaxHexadecimal: true,
	syntaxBareDecimal: true,
	syntaxInf: true,
	syntaxNaN: true,
	syntaxPlus: true,
}
const parsed = lib.parse(text, JSON5Opts);
```

If you need the reviver function, add a "reviver" property to the options.

This library only parses, so there is no equivalent to `JSON5.stringify`.

### JSONStream




### Clarinet.js

Homepage: https://github.com/dscape/clarinet

Clarinet is a SAX-like streaming parser for JSON.


### Oboe.js

Homepage: http://oboejs.com/

Oboe.js is a streaming parser for JSON, derived from Clarinet, that supports retrieval over the network, and an API to split a (potentially very large) document into subdocuments, for easier processing by the application.

This library does not perform any network or filesystem functions; get a readable stream, somehow, and pipe it into a . For example in Node.js, use `fs.createReadStream`.


## Table of Files

* index.js: Entry point for Node.js
* parse.js: JSON parser
* schema.js: JSON validation logic & JSON Schema implementation
* runner.js: Executable to run the parser & validator against test suites
* package.json: npm metadata
* UNLICENSE: Public Domain dedication
* test/schema-suite: link to the official JSON Schema test suite
* test/syntax-suite: link to a JSON parser test suite
