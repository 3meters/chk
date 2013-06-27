#chk

  Simple recursive javascript object checker

  chk validates objects against simple schemas. It supports required and default values, string enums, nested objects and arrays, optional type coercion, custom functional validators, and optional rejection of unknown keys.  It is particularly well-suited for validating public-facing web services. Chk may modify the chked value if you tell it to. 
   
## Install for nodejs

```
npm install chk
```

## Use

For each value you provide a template schema:  
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
chk returns null on success or an error on the first failure.  Since errors inside deeply nested objects can be tricky, the errors attempt to provide as much context and detail as possible.  

Value checking
```js
var schema = {foo: {type: 'string', value: 'one|or|another'}}
var err = chk({foo: 'or'}, schema)  // err is null
```

Optionally fail on unknown keys with the strict option
```js
var schema = {foo: {type: 'string'}}
var err = chk({foo: 'hello', bar: 'goodbye'}, schema)  // err is null
err = chk({foo: 'hello', bar: 'goodbye'}, schema, {strict: true})  // err is Error with code 'badParam'
```

Functional Validators
```js
var schema = {n1: {
  type: 'number',
  value: function(v) {
    if (v > 0) return null
    else return new Error('n1 must be greater than zero')
  }
}}
```
Cross-key Functional Validation
```js
var schema = {
  n1: {
    type: 'number',
    required: true,
    value: function(v) {
      if (v > 0) return null
      else return new Error('n1 must be greater than zero')
    }
  },
  n2: {
    type: 'number'
    value: function(v, obj) { // obj is the entire value object
      if (v > obj.n1) return null
      return new Errow('n1 must be greater than n2')
    }
  }
}
```
Multiple Accepted Types
```js
var schema = {val1: {type: 'string|number|date'}}
```
Default Values
```js
var schema = {
  s1: {type: 'string'}
  s2: {type: 'string', default: 'goodbye'}
}
var val = {s1: 'hello'}
var err = chk(val, schema) // err is null
console.log(val)  // {s1: 'hello', s2: 'goodbye'}
```
Nested Objects
```js
var schema = {
  s1: {type: 'string'},
  o1: {type: 'object', value: {
    n1: {type: 'number', required: true},
    d1: {type: 'date'},
    o2: {type: 'object', value: {
      s1: {type: 'string', default: 'I am deep in my nest'}
    }
  }
}
```
Nested Arrays
```js
var schema = {a1: {type: 'array', value: {type: 'number'}}}
var err = chk({a1: [1,2,3]}) // err is null
err = chk({a1: [1, 2, '3']}) // err is Error with code 'badType'
```
Arrays of Objects 
```js
var schema = {
  a1: {type: 'array' value: {type: 'object', value: {s1: {type: 'string'}, n1: {type: 'number'}}}}
}
var err = chk({a1:[{s1: 'foo', n1: 1}, {s1: 'bar', n1: 2}]})  // err is null
var err = chk({a1:[{s1: 'foo', n1: 1}, {s1: 'bar', n1: 'baz'}]})  // err is Error with code 'badType'
```
Element-specific Strict
todo: example

## Copyright
  Copyright (c) 2013 3meters.  All rights reserverd.

## License
  MIT
