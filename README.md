json/parse/schema: Parse a JSON Document into an object structure and/or while validating it against a JSON Schema

Features:

* Stream parse a JSON document
* Provide useful feedback about JSON parse errors
	- Line numbers
	- Repeated keys
	- Syntax errors
* Validates the JSON document against a JSON Schema
	- Provides line/character information of error
* Parse JSON instances into an instance of an arbritrary object - parse dates directly into Date, integers into arbritrary precision object, objects into Immutable Map, etc.
	- Allow JSON values to be filtered through a filter after parsing, so strings can be cast to Dates, objects to Immutable objects, etc.
   - Filter based on schema URI, type, format, and non-trivial cases like too-big numbers, and whatever else is appropriate

## class: Parser

Parser is a transforming stream that accepts a byte stream or string stream, and outputs events.

```javascript
var parser = new Parser(new Schema('http://localhost/schema.json', {type: 'array'}), {keepValue:true});

fs.createReadStream('file.json')
	.pipe(parser)
	.on('finish', function(err, res){
		console.log(parser.errors);
		console.log(parser.value);
	});
```

### Parser.parse(schema, options, document)

Shortcut for parsing a one-off block of JSON.

* schema: Schema instance to be validated against
* options: additional options for validating/parsing the JSON document
 * charset: Specifies how the Buffer or Uint8Array is encoded: "ASCII", "UTF-8", or "string" for a native string (UTF-16).
 * keepValue: If true, saves parsed value to `Parser#value`. Default `false`.
* document: The entire JSON document to parse, provided as a string, Buffer, or Uint8Array.

```javascript
var parser = Parser.parse(
	new Schema('http://localhost/schema.json', {type: 'array'}),
	{},
	fs.readFileSync('file.json') );
console.log(parser.errors);
console.log(parser.value);

```

### Parser#errors

An Array of ValidationError instances representing accumulated validation errors.
Parsing will end when an error is detected, not all errors in the document may be listed.


### Parser#value

If `keepValue: true` was passed in `options`, the parsed value will be available here.

### Parser#on('startObject', function() )
Emitted when an object is opened (when `{` is observed).


### Parser#on('endObject', function() )
Emitted when an object is closed (when `}` is observed).


### Parser#on('startArray', function() )
Emitted when an array is opened (when `[` is observed).


### Parser#on('endArray', function() )
Emitted when an array is closed (when `]` is observed).


### Parser#on('key', function(name) )
Emitted inside an object when a key is fully parsed.


### Parser#on('string', function(value) )
Emitted when a string value is parsed.


### Parser#on('boolean', function(value) )
Emitted when a boolean value is parsed.


### Parser#on('null', function(value) )
Emitted when a null is parsed.


### Parser#on('finish', function() )
Emitted when the incoming stream has ended and has been processed. Guarenteed to be called once. Indicates end of processing.


## class: Schema(baseURI, schemaObject)

* baseURI: The URI the schema was downloaded at, if any.
* schemaObject: A parsed JSON schema. Must be an object, JSON Schema documents can simply be run through `JSON.parse` to generate a compatible object.

```javascript
var schema = new Schema('http://localhost/schema.json', { type: 'array' });
var parser = schema.createParser({keepValue:true});

fs.createReadStream('file.json')
	.pipe(parser)
	.on('finish', function(err, res){
		console.log(parser.errors);
		console.log(parser.value);
	});
```

### Schema#createParser(options)
Create a `Parser` instance with the given options.
The parser will validate the incoming stream against the Schema.


## class: SchemaRegistry

Use SchemaRegistry if one schema references another.

### SchemaRegistry#import

Import a schema so that it's referencable by its given URI by other schemas.

```javascript
var registry = new SchemaRegistry();
var baseSchema = registry.import('http://localhost/schema.json', { type: 'array', items:{$ref:'http://localhost/item.json'} });
var stringSchema = registry.import('http://localhost/item.json', { type: 'string' });
// Alternatively:
// var schema = new Schema('http://localhost/schema.json', { type: 'array' }, registry);
var parser = baseSchema.createParser({keepValue:true});

fs.createReadStream('file.json')
	.pipe(parser)
	.on('finish', function(err, res){
		console.log(parser.errors);
		console.log(parser.value);
	});
```
