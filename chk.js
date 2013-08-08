/**
 * chk.js
 *
 * var err = chk(value, schema, options)
 * if (err) throw err
 * ...
 *
 * Chk is a synchronous parameter checker. It returns null on
 * success or an error if the passsed-in object mismatches the
 * passed-in schema.
 *
 * Chk is not idempotent.  It may modify the passed-in value
 * via the defaults parameter of the schema, via type coersion,
 * or via arbitrary code in schema validator functions. Chk
 * never modifies the passed-in schema. It iterates for fields
 * of type array, and recurses for fields of type object.
 *
 *
 * Copyright (c) 2013 3meters.  All rights reserved.
 *
 * MIT Licensed
 */


var util = require('util')
var tipe = require('tipe')  // type checker, https://github.com:3meters/tipe
var isUndefined = tipe.isUndefined
var isNull = tipe.isNull
var isBoolean = tipe.isBoolean
var isNumber = tipe.isNumber
var isString = tipe.isString
var isObject = tipe.isObject
var isError = tipe.isError
var isScalar = tipe.isScalar


// Main
function chk(value, schema, options) {

  // Make sure the schema is valid
  var err = checkSchema(schema)
  if (err) return err

  // Configure options
  options = options || {}
  options.strict = options.strict || false  // allow non-specified fields
  options.ignoreDefaults = options.ignoreDefaults || false
  options.ignoreRequired = options.ignoreRequired || false
  options.doNotCoerce = options.doNotCoerce || false
  options.untrusted = options.untrusted || false
  options.rootValue = value
  options.rootSchema = schema

  // Do the work
  err = doCheck(value, schema, options)
  if (err) err.validArguments = schema
  return err
}


// Validate the user-provided schema against the meta schema
function checkSchema(schema) {

  var err

  if (isUndefined(schema)) {
    return fail('missingParam', 'Schema is required')
  }

  if (!isObject(schema)) {
    return fail('badType', 'Schema must be an object')
  }

  // Schema may target scalars or objects, figure out which
  var targetIsScalar = true
  for (var key in schema) {
    if (!_schema[key]) {
      targetIsScalar = false
      break
    }
  }

  if (targetIsScalar) {
    err = doCheck(schema, _schema)
  }
  else {
    for (var key in schema) {
      err = doCheck(schema[key], _schema)
      if (err) break
    }
  }

  if (err) return fail('badSchema', err.message)
  return null // success
}


// Meta schema for chk schemas
var _schema = {
  type:     { type: 'string' },
  required: { type: 'boolean' },
  default:  { },
  value:    { type: 'string|number|boolean|object|function' },
  strict:   { type: 'boolean' },
}


// Check all schema attributes except value
// Can modify value by setting defaults
// Value can be an object or a scalar
function doCheck(value, schema, options) {

  var err = null
  options = options || {}
  options.key = options.key || ''
  var args = {value: value, schema: schema, options: options}

  if (!isObject(schema)) return null  // success

  // Set defaults
  if (!options.ignoreDefaults
      && !isUndefined(schema.default)
      && isUndefined(value)) { // null is not overridden
    value = clone(schema.default)
  }

  // Check required
  if (!options.ignoreRequired &&
      schema.required &&
      (isUndefined(value) || isNull(value))) {
    return fail('missingParam', options.key, args)
  }

  // Schema is nested one level
  if (isObject(value)
      && 'object' === schema.type
      && isObject(schema.value)) {
    // schema = schema.value
    err = doCheck(value, schema.value, options)
    if (err) return err
    return
  }

  if (isScalar(value)) {
    return checkScalar(value, schema, options)
  }

  // Strict mode checks for unrecognized keys
  if (isObject(value)) {
    // Schema local option overrides global option
    var beStrict = (isBoolean(schema.strict)) ? schema.strict : options.strict
    if (beStrict) {
      for (var key in value) {
        if (!schema[key]) return fail('badParam', key, args)
      }
    }
  }

  // Set defaults and check required
  for (var key in schema) {
    if (!options.ignoreDefaults
        && !isUndefined(schema[key].default)
        && isUndefined(value[key])) { // null is not overridden
      value[key] = clone(schema[key].default)
    }
    if (!options.ignoreRequired &&
        schema[key].required &&
        (isUndefined(value[key]) || isNull(value[key]))) {
      return fail('missingParam', key, args)
    }
  }


  // Check elements
  for (var key in value) {
    options.key = key

    if (schema[key] && !schema[key].type) continue  // schema[key] is empty, move on

    switch(tipe(value[key])) {

      case 'object':
        if (schema[key] && schema[key].value) {
          err = doCheck(value[key], schema[key].value, options) // recurse
          if (err) return err
        }
        break

      case 'array':
        if (!schema[key]) break
        if (!match('array', schema[key].type)) {
          return fail('badType', 'Value may not be an array', args)
        }
        if (schema[key].value) {
          value[key].forEach(function(elm) {
            err = doCheck(elm, schema[key].value, options)
            if (err) return
          })
          if (err) return err
        }
        break

      case 'string':
        // Coerce stings to numbers and booleans
        if (!options.doNotCoerce && schema[key]) {
           value[key] = coerce(value[key], schema[key])
         }
        // fall through to default on purpose

      default:
        err = checkScalar(value[key], schema[key], options)
        if (err) return err
    }
  }

  return err
}


// Check a scalar value against a simple rule, a specified validator
// function, or via a recusive nested schema call
function checkScalar(value, schema, options) {

  var args = {value: value, schema: schema, options: options}

  /*
  console.log('checkScalar agrs')
  console.log(util.inspect(args))
  */

  if (!isObject(schema)) return null  // success

  if (isNull(value) || isUndefined(value)) return null // success

  // Check type, matching |-delimited target, i.e. 'string|number|boolean'
  if (schema.type && !isUndefined(value) && !isNull(value) &&
      !match(tipe(value), schema.type)) {
    return fail('badType', options.key + ': ' + schema.type, args)
  }

  switch (tipe(schema.value)) {

    case 'undefined':
      break

    case 'function':
      // Untrusted turns off function validators.  Useful if library
      // is exposed publically
      if (options.untrusted) {
        return fail('badSchema', 'Function validators are not allowed', args)
      }
      // Schema.value is a user-supplied validator function. Validators
      // work like chk itself:  they return null on success or an error
      // or other positive value on failure. Cross-key validation may be
      // performed using the optional params rootValue and key
      var err = schema.value(value, options.rootValue, options.key)
      if (err) {
        if (!isError(err)) err = new Error(err)
        err.code = err.code || 'badValue'
        return err
      }
      break

    case 'string':
      if (!match(value, schema.value)) {
        return fail('badValue', options.key + ': ' + schema.value, args)
      }
      break

    case 'number':
    case 'boolean':
      if (schema.value !== value) {
        return fail('badValue', options.key + ': ' + schema.value, args)
      }
      break

    default:
      return fail('badType', schema.value, args)
  }

  return null // success
}


// Query string params arrive parsed as strings
// If the schema type is number or boolean try to cooerce
function coerce(value, schema) {
  switch(schema.type) {
    case 'number':
      var f = parseFloat(value)
      var i = parseInt(value)
      if (Math.abs(f) > Math.abs(i)) value = f
      else if (i) value = i
      if (value === '0') value = 0
      break
    case 'boolean':
      value = tipe.isTruthy(value)
      break
  }
  return value
}


// Error helper
function fail(code, msg, info) {

  var errCodeMap = {
    missingParam: 'Missing Required Parameter',
    badParam: 'Unrecognized Parameter',
    badType: 'Invalid Type',
    badValue: 'Invalid Value',
    badSchema: 'Invalid Schema',
  }

  if (isObject(msg)) msg = util.inspect(msg, false, 10)
  if (isObject(info)) msg += '\n' + util.inspect(info, false, 10)
  var err = new Error(errCodeMap[code] + ': ' + msg)
  err.code = code
  return err
}


// Pipe-delimited enum: returns true if 'bar' equals any of 'foo|bar|baz'
function match(str, strEnum) {
  if (!isString(strEnum)) return false
  return strEnum.split('|').some(function(member) {
    return (member === str)
  })
}


// Iterate over the keys of an object or the elements of an array
function each(obj, fn) {
  if (isArray(obj)) {
    obj.forEach(fn)
  }
  else if (isObject(obj)) {
    for (var k in obj) {
      fn(obj[k])
    }
  }
  else fn(obj)
}


// Returns null for objects that JSON can't serialize
function clone(obj) {
  if (isScalar(obj)) return obj
  try { var clonedObj = JSON.parse(JSON.stringify(obj)) }
  catch(e) { return null }
  return clonedObj
}


// Export
module.exports = chk
