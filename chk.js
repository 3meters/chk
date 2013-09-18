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


var inspect = require('util').inspect
var tipe = require('tipe')  // type checker, https://github.com:3meters/tipe


// Public entry point
function chk(value, schema, userOptions) {

  if (!tipe.object(schema)) {
    return fail('badType', 'schema object is required', arguments)
  }

  // Configure options
  var options = {
    ignoreDefaults: false,
    ignoreRequired: false,
    doNotCoerce: false,
    strict: false,
    log: false,
  }
  options = override(options, userOptions)

  // For contextual error reporting
  options.rootValue = value
  options.rootSchema = schema

  // Check value
  err = doCheck(value, schema, options)
  return (tipe.error(err)) ? err : null
}


// Main worker
function doCheck(value, schema, parentOptions) {

  if (!tipe.object(schema)) return value  // success

  // Override options with those specified in the schema
  options = override(parentOptions, schema)

  // Log arguments
  if (options.log) log(arguments)

  // Check required
  if (!options.ignoreRequired
      && schema.required
      && (tipe.undefined(value) || tipe.null(value))) {
    return fail('missingParam', options.key, arguments)
  }

  // Check type
  value = coerceType(value, schema, options)
  if (tipe.defined(value)
      && tipe.string(schema.type)
      && !match(tipe(value), schema.type)) {
    return fail('badType', tipe(value), arguments)
  }

  // Check value based on type
  switch (tipe(value)) {
    case 'object':
      value = checkobject(value, schema, options)
      break
    case 'array':
      value = checkArray(value, schema, options)
      break
    default:
      value = checkScalar(value, schema, options)
  }

  if (tipe.error(value)) return value

  // Check final validator function
  if (tipe.function(schema.validate)) {
    var err = validate(schema.validate, value, options)
    if (err) return err
  }

  return value
}


// Check an object
function checkobject(value, schema, options) {

  if (!tipe.object(schema)) return value

  // Schema fields may be nested inside an object
  var fields = ('object' === schema.type && tipe.object(schema.value))
    ? schema.value
    : schema

  // In strict mode check for unrecognized keys
  if (options.strict) {
    for (var key in value) {
      if (!fields[key]) return fail('badParam', key, arguments)
    }
  }

  // Set defaults
  if (!options.ignoreDefaults) {
    for (var key in fields) {
      if (tipe.defined(fields[key].default) && tipe.undefined(value[key])) {
        value[key] = clone(fields[key].default)
      }
    }
  }

  // Check for missing required
  if (!options.ignoreRequired) {
    for (var key in fields) {
      if (fields[key].required
          && (tipe.undefined(value[key]) || tipe.null(value[key]))) {
        return fail('missingParam', key, arguments)
      }
    }
  }

  // Recursively check the value's properties
  for (var key in value) {
    if (tipe.object(fields[key])) {
      options.key = key
      value[key] = doCheck(value[key], fields[key], options)  // recurse
      if (tipe.error(value[key])) return value[key]
    }
  }
  return value
}


// Check an array
function checkArray(value, schema, options) {
  if (!tipe.object(schema)) return value
  if (tipe.object(schema.value)) {
    for (var i = value.length; i--;) {
      options.key = i
      var elm = doCheck(value[i], schema.value, options)
      if (tipe.error(elm)) return elm
    }
  }
  return value
}


// Check a scalar value against a simple rule, a specified validator
// function, or via a recusive nested schema call
// returns the passed in value, which may be modified
function checkScalar(value, schema, options) {

  if (!tipe.object(schema)
      || tipe.null(value)
      || tipe.undefined(value))
    return value  // success

  switch (tipe(schema.value)) {

    case 'undefined':
      break

    case 'function':
      // schema-defined validator function
      var err = validate(schema.value, value, options)
      if (err) return err
      break

    case 'string':
      if (!match(value, schema.value)) {
        return fail('badValue', options.key + ': ' + schema.value, arguments)
      }
      break

    case 'number':
    case 'boolean':
      if (schema.value !== value) {
        return fail('badValue', options.key + ': ' + schema.value, arguments)
      }
      break

    default:
      return fail('badType', schema.value, arguments)
  }

  return value // success
}


// Execute a schema-defined validator function.
// Only for trusted code.
// TODO: add an untrusted option that will execute the
// function in a separate vm or process.
function validate(fn, value, options) {
  try { var err = fn(value) }
  catch (e) {
    return fail('badSchema', 'Validator threw exception ' + e.message)
  }
  if (err) {
    if (!tipe.error(err)) err = new Error(err)
    err.code = err.code || 'badValue'
    return err
  }
  return null
}


// Create a copy of obj1 with properties overridden by those
// of obj2 of the same type
function override(obj1, obj2) {
  if (!(tipe.object(obj1) && tipe.object(obj2))) return obj1
  var newObj = {}
  for (var key in obj1) { newObj[key] = obj1[key] }
  for (var key in obj2) {
    if (tipe(obj1[key]) === tipe(obj2[key])) {
      newObj[key] = obj2[key]
    }
  }
  return newObj
}


// Query string params arrive parsed as strings
// If the schema type is number or boolean try to cooerce
function coerceType(value, schema, options) {
  if (options.doNotCoerce) return value
  if (!tipe.string(value)) return value
  switch(schema.type) {
    case 'number':
      var f = parseFloat(value)
      var i = parseInt(value)
      if (Math.abs(f) > Math.abs(i)) value = f
      else if (i) value = i
      if (value === '0') value = 0
      break
    case 'boolean':
      value = tipe.truthy(value)
      break
  }
  return value
}


// Error helper
function fail(code, msg, args) {

  // Map error codes to strings
  var codeMap = {
    missingParam: 'Missing Required Parameter',
    badParam: 'Unrecognized Parameter',
    badType: 'Invalid Type',
    badValue: 'Invalid Value',
    badSchema: 'Invalid Schema',
  }


  // Convert arguments to a meaningful object
  if (args) {
    args = {
      value: args[0],
      schema: args[1],
    }
  }

  // If any options have been set add them to the argments
  var options = args && args[2] || {}
  var setOptions = {}
  for (var key in options) {
    if (options[key]) setOptions[key] = options[key]
  }
  if (Object.keys(setOptions).length) args.options = setOptions


  // Format the message
  msg = codeMap[code] + ': ' + msg

  // Create and return the error
  var err = new Error(msg)
  err.code = code
  err.info = args
  return err
}


// Pipe-delimited enum: returns true if 'bar' equals any of 'foo|bar|baz'
function match(str, strEnum) {
  if (!tipe.string(strEnum)) return false
  return strEnum.split('|').some(function(member) {
    return (member === str)
  })
}


// Returns null for objects that JSON can't serialize
function clone(obj) {
  if (!tipe.object(obj)) return obj
  try { var clonedObj = JSON.parse(JSON.stringify(obj)) }
  catch(e) { return null }
  return clonedObj
}


// Debugging helper
var log = function(s, o) {
  if (tipe.isArguments(s)) {
    if (tipe.isObject(s[2])) {
      var ops = s[2]
      // useful for errors, but noise log stack
      delete ops.rootSchema
      delete ops.rootValue
    }
    return log('chk arguments:', {
      value: s[0],
      schema: s[1],
      options: ops
    })
  }
  console.log(s += (o) ? '\n' + inspect(o, false, 10) : '')
}


// Export
module.exports = chk
