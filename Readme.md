#chk

  A simple, recursive, javascript value checker

  chk tests values against simple schemas. It supports required and default values, string enums, nested objects and arrays, optional type coercion, custom functional validators, and optional rejection of unknown keys.  It is particularly well-suited for validating public-facing web services. Chk may modify the chked value if you tell it to.
  
  chk is reasonably mature, used heavily in a closed-source production system. Since diagnosing schema failures in deeply nested object can be tricky, particular care has been taken to provide detailed context in errors.
   
## Install for nodejs

```
npm install chk
```

## Use
Call chk passing in a value and a schema.  Chk returns null on success or the first error it encouters on failure.  

### Bare minium
```js
var chk = require('chk')
var schema = {type: 'string'}
var val = 'foo'
var err = chk(val, schema)   // err is null
val = 1
err = chk(val, schema)       // err is Error with code 'badType'
```
### Values can be scalars or objects
```js
schema = {
  str1: {type: 'string'},
  num1: {type: 'number'}
}
err = chk({str1: 'foo', num1: 2}, schema)  // err is null
err = chk({str1: 2}, schema)  // err is Error with code 'badType'
```
### Required
```js
schema = {s1: {type: 'string', required: true}}
err = chk({s1: 'foo', s2: 'bar'}, schema)   // err is null
err = chk({s2: 'bar'}, schema)              // err is Error with code 'missingParam'
```

### Value checking with delimted string enums
```js
schema = {type: 'string', value: 'one|or|another'}
err = chk('or', schema)  // err is null
err = chk('notOne', schema)  // err is Error wtih code 'badValue'
```

### Optionally fail on unknown object keys with option strict
```js
schema = {foo: {type: 'string'}}
err = chk({foo: 'hello', bar: 'goodbye'}, schema)  // err is null
err = chk({foo: 'hello', bar: 'goodbye'}, schema, {strict: true})  // err is Error with code 'badParam'
```

### Custom Function Validators
```js
schema = {n1: {
  type: 'number',
  value: function(v) {
    if (v > 0) return null
    else return new Error('n1 must be greater than zero')
  }
}}
```
or
```js
schema = {
  a1: {type: 'array', value: {
    type: 'object',
    validate: function(v) {
      if (v.n1 > v.n2) return new Error('object.n1 must be greater than object.n2')
      return null
    }
  }}
}
```
Within validator functions, the this object refers to the value passed into the top-level call. 
```js
  var schema = {
    n1: {type: 'number', default: 0},
    n2: {type: 'number', validate: n2Validate}
  }
  function n2Validate(v) {
    if (v !== this.n1) return 'n2 must equal n1'
  }
  chk({n1:1, n2:1}, schema)  // null
  chk({n1:1, n2:2}, schema)  // Error: 'n2 must equal n1'

```
will run the validator for each element in the array
### Multiple Accepted Types
```js
schema = {val1: {type: 'string|number|date'}}
```
### Set Value Defaults
```js
schema = {
  s1: {type: 'string'}
  s2: {type: 'string', default: 'goodbye'}
}
val = {s1: 'hello'} 
err = chk(val, schema)  // err is null
console.log(val)        // {s1: 'hello', s2: 'goodbye'}
```
### Optionally Coerce Types
Handy for casting numbers or booleans from query strings
```js
schema = {n1: {type: 'number'}, b1: {type: 'boolean'}}
val = {n1: '12', b2: 'true'}
err = chk(val, schema)  // err is null
console.log(val)  // {n1: 12, b2: true}  // types have been cast from string to target type
val = {n1: '12', b2: 'true'}
err = chk({n1: '12', b2: 'true'}, schema, {doNotCoerce: true}) // coercion off, err is Error with code 'badType'
```
### Nested Objects
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
### Nested Arrays
Nested schemas are applied to each element in the array
```js
schema = {a1: {type: 'array', value: {type: 'number'}}}
err = chk({a1: [1,2,3]})  // err is null
err = chk({a1: [1, 2, '3']})  // err is Error with code 'badType'
```
### Arrays of Objects
```js
schema = {
  {type: 'array' value: {type: 'object', value: {s1: {type: 'string'}, n1: {type: 'number'}}}
}
var err = chk([{s1: 'foo', n1: 1}, {s1: 'bar', n1: 2}])  // err is null
var err = chk([{s1: 'foo', n1: 1}, {s1: 'bar', n1: 'baz'}])  // err is Error with code 'badType'
```
### Options
Options and their defaults are:
```js
  {
    strict: false,          // do not allow unspecified properties of objects
    ignoreDefaults: false,  // do not set default values, handy for db updates
    ignoreRequired: false,  // do not enforce required, handy for db updates
    doNotCoerce: false,     // do not coerce types
    log: false              // log the arguments to each recursive chk call,
                            //     handy for debugging deeply nested schemas
  }
```
Options can be set as an optional third argument to the top level call, or as properties of any schema or sub-schema.  They remain set for all children unless they are overridden.  For example, a top-level schema can be strict, meaning no unrecognized properties are allowed, except for one property, which can be unstrict, allowing un-specified sub-properties, except for one of its sub-properties, which must be strict, etc. For example: 
```js
schema = {
  o1: {type: 'object', value: {
    s1: {type: 'string'},
    s2: {type: 'string'},
  },
  o2: {type: 'object', strict: false, value: {
    s1: {type: 'string'},
    s2: {type: 'string'},
    o1: {type: 'object', strict: true: value: {
      n1: {type: 'number'}
    }
  }
}
val = {
  o1: {s1: 'foo', s2: 'bar'},
  o2: {s1: 'foo', s2: 'bar', s3: 'baz}
}
err = chk(val, schema, {strict: true}) // err is null because o2 strict attribute overrode option
val.o2.o1 = {n2: 100}
err = chk(val, schema, {strict: true}) // err is Error because schema.o2.o1 does not allow properties other than n1

```
## Copyright
  Copyright (c) 2013 3meters.  All rights reserverd.

## License
  MIT
