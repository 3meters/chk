/**
 * chek.js
 *
 * Synchronous parameter checker. Returns null on success or
 * an error if the passsed-in object mismatches the passed-in
 * schema. May modify the passed-in object via the defaults param
 * of the schema, via type coersion, or via arbitrary code in
 * schema validator functions. Does not modify the passed-in
 * schema. Iterates for fields of type array. Recurses for fields
 * of type object.
 *
 * Copyright (c) 2013 3meters.  All rights reserved.
 *
 * MIT Licensed
 */


var inspect = require('util').inspect
var tipe = require('tipe')
var isObject = tipe.isObject
var isArray = tipe.isArray
var isString = tipe.isString
var isNull = tipe.isNull
var isUndefined = tipe.isUndefined


// Main
function chek(value, schema, options) {

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

  if (!isObject(schema)) {
    return fail('Invalid type: schema must be an object')
  }

  // first try a scalar-target schema
  var err = doCheck(schema, _schema)
  if (err) {
    // try an object-target schema
    for (var key in schema) {
      err = doCheck(schema[key], _schema)
      if (err) return fail('Invalid schema:', err)
    }
  }
  return null // success
}


// Meta schema for chek schemas
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

  if (!isObject(schema)) return null  // success

  // Schema is nested one level
  if (isObject(value)
      && 'object' === schema.type
      && isObject(schema.value)) {
    schema = schema.value
  }

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
    return fail('Missing required parameter: ' + options.key,
        {value: value, schema: schema})
  }

  if (!isObject(value)) { // arrays?
    return checkValue(value, schema, options)
  }


  // Fail on unrecognized keys
  // Schema local option overrides global option
  var beStrict = (isUndefined(schema.strict))
    ? options.strict
    : schema.strict
  if (beStrict) {
    for (var key in value) {
      if (!schema[key]) {
        return fail('Invalid key: ' + key, {value: value, schema: schema})
      }
    }
  }

  for (var key in schema) {

    // skip schema attributes
    if (!schema[key].type) continue

    // Set defaults
    if (!options.ignoreDefaults
        && !isUndefined(schema[key].default)
        && isUndefined(value[key])) { // null is not overridden
      value[key] = schema[key].default
    }

    // Check required
    if (!options.ignoreRequired &&
        schema[key].required &&
        (isUndefined(value[key]) || isNull(value[key]))) {
      return fail('Missing required parameter ' + key,
          {value: value, schema: schema})
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
          return fail('Invalid type: schema does not allow value of type array',
              {schema: schema, value: value})
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
        err = checkValue(value[key], schema[key], options)
        if (err) return err
    }
  }

  return err
}


// Check value against a simple rule, a specified validator
// function, or via a recusive nested schema call
function checkValue(value, schema, options) {

  /*
  log('\ncheckValue key: ' + options.key)
  log('value:', value)
  log('schema:', schema)
  */

  if (!isObject(schema)) return null  // success

  if (isNull(value) || isUndefined(value)) return null // success

  // Set defaults
  if (!options.ignoreDefaults &&
      schema.default && isUndefined(value)) { // null is not overridden
    value = clone(schema.default)
  }

  // Check type, matching |-delimited target, i.e. 'string|number|boolean'
  if (schema.type && !isUndefined(value) && !isNull(value) &&
      !match(tipe(value), schema.type)) {
    return fail('Invalid type ' + options.key + ': ' + schema.type,
        {value: value, schema: schema})
  }

  switch (tipe(schema.value)) {

    case 'undefined':
      break

    case 'function':
      // Untrusted turns off function validators.  Useful if library
      // is exposed publically
      if (options.untrusted) {
        return fail('Function validators not allowed')
      }
      // Call the validator function. Validators must return null
      // on success or an Error on failure. Perform cross-key
      // validation using optional params object and key
      var err = schema.value(value, options.rootValue, options.key)
      if (err) return err
      break

    case 'string':
      if (!match(value, schema.value)) {
        return fail('Invalid value ' + options.key + ': ' + schema.value,
            {value: value, schema: schema})
      }
      break

    case 'number':
    case 'boolean':
      if (schema.value !== value) {
        return fail('Invalid value ' + options.key + ': ' + schema.value,
            {value: value, schema: schema})
      }
      break

    default:
      return fail('Invalid value type: ' + schema.value,
          {value: value, schema: schema})
  }
  return null // success
}


// Query string params arrive parsed as strings
// If the schema type is number or boolean try to cooerce
function coerce(value, schema) {
  if (!isString(value)) return new Error('Expected value of type string')
  switch(schema.type) {
    case 'number':
      var f = parseFloat(value)
      var i = parseInt(value)
      if (Math.abs(f) > Math.abs(i)) value = f
      else if (i) value = i
      if (value === '0') value = 0
      break
    case 'boolean':
      value = truthy(value)
      break
  }
  return value
}


// Error helper
function fail(msg, data) {
  if (isObject(msg)) msg = inspect(msg)
  if (isObject(data)) msg += '\n' + inspect(data)
  return new Error(msg)
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
  try { var clonedObj = JSON.parse(JSON.stringify(obj)) }
  catch(e) { return null }
  return clonedObj
}


// True for positive numbers, strings castable to positive
// numbers, or strings 'true' or 'yes',
function truthy(val) {
  if (isNumber(val)) return (val > 0)  // negative numbers are false
  if (!isString(val)) return (val)     // fall back to javascript
  val = val.toLowerCase()
  if (val === 'true' || val === 'yes') return true
  if (parseInt(val) > 0) return true
  return false
}


// Export
module.exports = chek
