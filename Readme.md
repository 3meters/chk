#chk

  A simple, recursive, javascript value checker

  chk validates values against simple schemas. It supports required and default values, string enums, nested objects and arrays, optional type coercion, custom functional validators, and optional rejection of unknown keys.  It is particularly well-suited for validating public-facing web services. Chk may modify the chked value if you tell it to.  
  
  chk is reasonably mature, used heavily in a closed-source production system. Since diagnosing schema failures in deeply nested object can be tricky, particular care has been taken to provide detailed context in errors.  
   
## Install for nodejs

```
npm install chk
```

## Use
Call chk passing in a value and a schema.  Chk returns null on success or the first error it encouters on failure.  

## Bare minium
```js
var chk = require('chk')
var schema = {type: 'string'}
var val = 'foo'
var err = chk(val, schema)   // err is null
val = 1
err = chk(val, schema)       // err is Error with code 'badType'
```
## Values can be scalars or objects 
```js
schema = {
  str1: {type: 'string'},
  num1: {type: 'number'}
}
err = chk({str1: 'foo', num1: 2}, schema)  // err is null
err = chk({str1: 2}, schema)  // err is Error with code 'badType'
```
## Required values
```js
schema = {s1: {type: 'string', required: true}}
err = chk({s1: 'foo', s2: 'bar'}, schema)   // err is null
err = chk({s2: 'bar'}, schema)              // err is Error with code 'missingParam'
```

## Value checking with delimted string enums
```js
schema = {type: 'string', value: 'one|or|another'}
err = chk('or', schema)  // err is null
err = chk('notOne', schema)  // err is Error wtih code 'badValue'
```

## Optionally fail on unknown object keys with option strict
```js
schema = {foo: {type: 'string'}}
err = chk({foo: 'hello', bar: 'goodbye'}, schema)  // err is null
err = chk({foo: 'hello', bar: 'goodbye'}, schema, {strict: true})  // err is Error with code 'badParam'
```

## Custom Function Validators
```js
schema = {n1: {
  type: 'number',
  value: function(v) {
    if (v > 0) return null
    else return new Error('n1 must be greater than zero')
  }
}}
```
## Cross-key Functional Validation
```js
schema = {
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
## Multiple Accepted Types
```js
schema = {val1: {type: 'string|number|date'}}
```
## Default Values
```js
schema = {
  s1: {type: 'string'}
  s2: {type: 'string', default: 'goodbye'}
}
val = {s1: 'hello'}
err = chk(val, schema) // err is null
console.log(val)       // {s1: 'hello', s2: 'goodbye'}
```
## Optionally attempt to coerce strings to numbers or booleans
Handy for accepting numbers or booleans from query strings
```js
schema = {n1: {type: 'number'}, b1: {type: 'boolean'}}
err = chk({n1: '12', b2: 'true'}, schema) // err is null
err = chk({n1: '12', b2: 'true'}, schema, {doNotCoerce: true}) // coercion off, err is Error with code 'badType'
```
## Nested Objects
```js
schema = {
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
## Nested Arrays
Validators are applied to each element in the array
```js
schema = {a1: {type: 'array', value: {type: 'number'}}}
err = chk({a1: [1,2,3]})  // err is null
err = chk({a1: [1, 2, '3']})  // err is Error with code 'badType'
```
## Arrays of Objects 
```js
schema = {
  {type: 'array' value: {type: 'object', value: {s1: {type: 'string'}, n1: {type: 'number'}}}
}
var err = chk([{s1: 'foo', n1: 1}, {s1: 'bar', n1: 2}])  // err is null
var err = chk([{s1: 'foo', n1: 1}, {s1: 'bar', n1: 'baz'}])  // err is Error with code 'badType'
```
## Element-specific option overrides
```js
schema = {
  o1: {type: 'object', value: {
    s1: {type: 'string'},
    s2: {type: 'string'},
  },
  o2: {type: 'object', strict: false, value: {
    s1: {type: 'string'},
    s2: {type: 'string'},
  }
}
val = {
  o1: {s1: 'foo', s2: 'bar'},
  o2: {s1: 'foo', s2: 'bar', s3: 'baz}
}
err = chk(val, schema, {strict: true}) // err is null because o2 strict attribute overrode option
```
## Copyright
  Copyright (c) 2013 3meters.  All rights reserverd.

## License
  MIT
