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
var isDefined = tipe.isDefined
var isNull = tipe.isNull
var isBoolean = tipe.isBoolean
var isNumber = tipe.isNumber
var isString = tipe.isString
var isObject = tipe.isObject
var isError = tipe.isError
var isScalar = tipe.isScalar
var isFunction = tipe.isFunction


// Public entry point
function chk(value, schema, userOptions) {

  if (!isObject(userSchema)) {
    return fail('badType', 'schema object is required')
  }

  options = {
    ignoreDefaults: false,
    ignoreRequired: false,
    doNotCoerce: false,
    untrusted: false,
    strict: false,
  }

  options = override(options, userOptions)

  // Configure options
  if (isObject(userOptions)) {
    for (var key in userOptions) {
      if (isBoolean(options[key]) && isBoolean(userOptions[key])) {
        options[key] = userOptions[key]
      }
    }
  }

  // Check value
  err = doCheck(value, schema, options)
  return (isError(err)) ? err : null
}


// Main worker
function doCheck(value, schema, options) {

  var err = null
  options = options || {}
  var args = {value: value, schema: schema, options: options}
  // log('doCheck args', args)

  if (!isObject(schema)) return value  // success

  // Check required
  if (!options.ignoreRequired
      && schema.required
      && (isUndefined(value) || isNull(value))) {
    return fail('missingParam', options.key, args)
  }

  // Check type
  value = coerceType(value, schema, options)
  if (isString(schema.type) && !match(tipe(value), schema.type)) {
    return fail('badType', args)
  }

  // Check value based on type
  switch (tipe(value)) {
    case 'object':
      value = checkObject(value, schema, options)
      break
    case 'array':
      value = checkArray(value, schema, options)
      break
    default:
      value = checkScalar(value, schema, options)
  }

  if (isError(value)) return value

  // Check final validator function
  if (isFunction(schema.validate)) {
    value = schema.validate(value)
  }

  return value
}


// Check an object
function checkObject(value, schema, options) {

  if (!isObject(schema)) return value
  var args = {value: value, schema: schema, options: options}

  // Schema fields may be nested inside an object
  var fields = ('object' === schema.type && isObject(schema.value))
    ? schema.value
    : schema

  // In strict mode check for unrecognized keys
  if (schema.strict) {
    // log ('checking strict on ', value)
    for (var key in value) {
      if (!fields[key]) return fail('badParam', key, args)
    }
  }

  // Set defaults
  if (!options.ignoreDefaults) {
    for (var key in fields) {
      if (isDefined(fields[key].default) && isUndefined(value[key])) {
        value[key] = clone(fields[key].default)
      }
    }
  }

  // Check for missing required
  if (!options.ignoreRequired) {
    for (var key in fields) {
      if (fields[key].required
          && (isUndefined(value[key]) || isNull(value[key]))) {
        return fail('missingParam', key, args)
      }
    }
  }

  // Recursively check the value's properties
  for (var key in value) {
    if (isObject(fields[key])) {
      options.key = key
      if (!isBoolean(fields[key].strict)) {
        fields[key].strict = schema.strict
      }
      value[key] = doCheck(value[key], fields[key], options)  // recurse
      if (isError(value[key])) return value[key]
    }
  }
  return value
}


// Check an array
function checkArray(value, schema, options) {
  if (!isObject(schema)) return value
  if (isObject(schema.value)) {
    for (var i = value.length; i--;) {
      options.key = i
      var elm = doCheck(value[i], schema.value, options)
      if (isError(elm)) return elm
    }
  }
  return value
}


// Check a scalar value against a simple rule, a specified validator
// function, or via a recusive nested schema call
// returns the passed in value, which may be modified
function checkScalar(value, schema, options) {

  var args = {value: value, schema: schema, options: options}

  if (!isObject(schema)
      || isNull(value)
      || isUndefined(value))
    return value  // success

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

  return value // success
}

// If current schema has a strict setting use it,
// otherwise use the parent's
function beStrict(schema, parentIsStrict) {
  return (isBoolean(schema.strict))
    ? schema.strict
    : parentIsStrict
}

// Query string params arrive parsed as strings
// If the schema type is number or boolean try to cooerce
function coerceType(value, schema, options) {
  if (options.doNotCoerce) return value
  if (!isString(value)) return value
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


// Returns null for objects that JSON can't serialize
function clone(obj) {
  if (isScalar(obj)) return obj
  try { var clonedObj = JSON.parse(JSON.stringify(obj)) }
  catch(e) { return null }
  return clonedObj
}


// Debugging helper
var log = function(s, o) {
  if (o) s+= '\n' + util.inspect(o, false, 10)
  console.log(s)
}


// Export
module.exports = chk
