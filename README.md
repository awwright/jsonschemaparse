json/parse/schema: Parse a JSON Document into an object structure and/or while validating it against a JSON Schema

Features:

* Stream parse a JSON document
* Provide useful feedback about JSON parse errors
	- Line numbers
	- Repeated keys
	- Syntax errors
* Validates the JSON document against a JSON Schema
* Parse JSON instances into an instance of an arbritrary object - parse dates directly into Date, integers into arbritrary precision object, objects into Immutable Map, etc.
	- Allow JSON values to be filtered through a filter after parsing, so strings can be cast to Dates, objects to Immutable objects, etc.
   - Filter based on schema URI, type, format, and non-trivial cases like too-big numbers, and whatever else is appropriate

```javascript
var p = new Parser({type:'array'}, {keepValue:true});

fs.createReadStream('test/syntax-suite/test_parsing/i_structure_500_nested_arrays.json')
	.pipe(p)
	.on('finish', function(err, res){
		console.log(p.errors);
		console.log(p.value);
	});
```
