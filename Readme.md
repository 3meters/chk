#chk

  Simple, recursive javascript object checker / validator

  chk validates objects against simple template schemas. It supports nested objects and arrays, string enums, default values, optional type coercion, custom functional validators, and optional rejection of unknown keys.  It is particularly well-suited for validating public-facing web services.  Chk is not idempotent: it may modify the chked value if you tell it to. 
   
## Install for nodejs

```
npm install chk
```

## Use

For each value you provide a template schema for the parameters.  
```
var chk = require('chk')

var schema = {
  str1: {
    type: 'string',
    required: true
  },
  str2: {
    type: 'string|number',
  }
}
var err = chk({str1: 'foo', }, schema)
if (err) throw err   // passes

err = chk({str2: 'bar'}, schema)  // err is Error with code 'missingParam'
```
chk returns null on success, or an error on the first failure.  Since errors inside deeply nested objects can be tricky, the errors attempt to provide as much context and detail as possible.  

Value checking
```js
var schema = {foo: {type: 'string', value: 'one|or|another'}}
var err = chk({foo: 'or'}, schema)  // err is null
```

Optionally fail on unknown keys with the strict option
```js
var schema = {foo: {type: 'number'}}
var err = chk({foo: 'hello', bar: 'goodbye'}, schema)  // err is null
err = chk({foo: 'hello', bar: 'goodbye'}, schema, {strict: true})  // err is Error with code 'badParam'
``

Functional Validators

Nested Objects

Nested Arrays


## Copyright
  Copyright (c) 2013 3meters.  All rights reserverd.

## License
  MIT
