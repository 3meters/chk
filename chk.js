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

// Main
function chk(value, schema, options) {

  // Validate schema
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
  options.schemaOk = false

  // Check value
  value = doCheck(value, schema, options)
  return (isError(value)) ? value : null
}


// Validate the schema
function checkSchema(schema) {

  log('schema:', schema)

  if (!isObject(schema)) return fail('badSchema')

  var err = null

  // Meta-schema
  var _schema = {
    type:     { type: 'string' },
    required: { type: 'boolean' },
    value:    { type: 'string|number|boolean|object|function' },
    strict:   { type: 'boolean' },
    validate: { type: 'function' },
  }

  if ('object' === schema.type && isObject(schema.value)) {
    err = checkSchema(schema.value)  // recurse nested schema
  }
  else {
    err = doCheck(schema, _schema)
  }

  return (isError(err)) ? err : null
}


// Main entry point for check.
// Value can be an object, array, or scalar
function doCheck(value, schema, options) {

  var err = null
  options = options || {}
  var args = {value: value, schema: schema, options: options}

  if (!isObject(schema)) return value  // success

  // Set default
  if (!options.ignoreDefaults
      && isDefined(schema.default)
      && isUndefined(value)) { // null is not overridden
    value = clone(schema.default)
  }

  // Check required
  if (!options.ignoreRequired &&
      schema.required &&
      (isUndefined(value) || isNull(value))) {
    return fail('missingParam', options.key, args)
  }

  // Check type
  value = coerceType(value, schema, options)
  if (isString(schema.type) && !match(tipe(value), schema.type)) {
    return fail('badType', args)
  }

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

  return value
}

// Check an object
function checkObject(value, schema, options) {
  var args = {value: value, schema: schema, options: options}

  // In strict mode check for unrecognized keys
  var beStrict = (isBoolean(schema.strict)) ? schema.strict : options.strict
  if (beStrict) {
    for (var key in value) {
      if (!schema[key]) return fail('badParam', key, args)
    }
  }
  // Schema fields may be nested inside an object
  var fields = ('object' === schema.type && isObject(schema.value))
    ? schema.value
    : schema

  // Set defaults and check for missing required properties
  for (var key in fields) {
    if (!options.ignoreDefaults
        && isDefined(fields[key].default)
        && isUndefined(value[key])) {
      value[key] = clone(fields[key].default)
    }
    if (!options.ignoreRequired
        && fields[key].required
        && (isUndefined(value[key]) || isNull(value[key]))) {
      return fail('missingParam', key, args)
    }
  }
  // Check the value's properties
  for (var key in value) {
    if (fields[key]) {
      options.key = key
      // SubSchema may be expressed as a nested object
      var subSchema = (isObject(fields[key].value) && 'object' === fields[key].type)
        ? fields[key].value
        : fields[key]
      value[key] = doCheck(value[key], subSchema, options)  // recurse
      if (isError(value[key])) {
        return value[key]
      }
    }
  }
  return value
}


// Check an array
function checkArray(value, schema, options) {
  var err = null
  var args = {value: value, schema: schema, options: options}
  if (schema.value) {
    // Schema may be expressed as a nested object
    var subSchema = ('object' === schema.value.type && isObject(schema.value.value))
      ? schema.value.value
      : schema.value
    value.forEach(function(elm) {
      elm = doCheck(elm, subSchema, options)  // iterate
      if (isError(elm)) {
        err = elm
        return // forEach
      }
    })
  }
  return (isError(err)) ? err : value
}


// Check a scalar value against a simple rule, a specified validator
// function, or via a recusive nested schema call
// returns the passed in value, which may be modified
function checkScalar(value, schema, options) {

  var args = {value: value, schema: schema, options: options}

  delete args.options

  if (!isObject(schema)) return value  // success

  if (isNull(value) || isUndefined(value)) return value // success

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
