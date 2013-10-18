/**
 * chk.js
 *
 * var err = chk(value, schema, options)
 * if (err) throw err
 * ...
 *
 * Chk is a synchronous value checker. It returns null on
 * success or an error if the passsed-in value violates the
 * passed-in schema.
 *
 * Chk may modify the passed-in value, but it never modifies
 * the passed-in schema.
 *
 * Chk iterates for fields of type array, and recurses for
 * fields of type object.
 *
 * Copyright (c) 2013 3meters.  All rights reserved.
 *
 * MIT Licensed
 */


var inspect = require('util').inspect
var tipe = require('tipe')  // type checker, https://github.com:3meters/tipe


// Public entry point
function chk(rootValue, rootSchema, rootOptions) {

  var err

  if (!tipe.object(rootSchema)) {
    return fail('badType', 'schema object is required', arguments)
  }

  // Configure options
  var _options = {
    ignoreDefaults: false,
    ignoreRequired: false,
    doNotCoerce: false,
    strict: false,
    log: false,
  }
  rootOptions = override(_options, rootOptions, true)

  // Call main worker
  err = _chk(rootValue, rootSchema, rootOptions)
  return (tipe.error(err)) ? err : null


  // Main worker
  function _chk(value, schema, parentOptions) {

    if (!tipe.object(schema)) return value  // success

    // Override options with those specified in the schema
    var options = override(parentOptions, schema, false)

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
      var err = callValidator(schema.validate, value, options)
      if (err) return fail(err.code, err, arguments)
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
          if (tipe.error(value[key])) {
            return fail('badSchema', 'Invalid default. Could not serialize as JSON.', arguments)
          }
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
        value[key] = _chk(value[key], fields[key], options)  // recurse
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
        var elm = _chk(value[i], schema.value, options)
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

      // deprecated, use validate property instead
      case 'function':
        // schema-defined validator function
        var err = callValidator(schema.value, value, options)
        if (err) return fail(err.code, err, arguments)
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


  /*
   * Execute a schema-defined validator function.
   * The this object inside validators refers to the
   * originally passed in root value, even though the
   * validator may be operating on a sub-node.
   *
   * Warning: this is only for trusted code.
   * TODO: add an untrusted option that will execute the
   * function in a separate vm or process.
   */
  function callValidator(fn, value, options) {
    var err
    try { err = fn.call(rootValue, value, options) }
    catch (schemaErr) {
      schemaErr.message = 'Validator threw exception ' + schemaErr.message
      schemaErr.code = 'badSchema'
      return schemaErr
    }
    if (err) {
      if (!tipe.error(err)) err = new Error(err)
      err.code = err.code || 'badValue'
      return err
    }
    return null
  }


  // Replace old object's values with new objects only if
  // they match on tipe.  Optially allow new properties.
  function override(obj1, obj2, allowNew) {
    if (!(tipe.object(obj1) && tipe.object(obj2))) return obj1
    var newObj = {}
    for (var key in obj1) { newObj[key] = obj1[key] }
    for (var key in obj2) {
      if (allowNew && tipe.isUndefined(obj1[key])) {
        newObj[key] = obj2[key]
      }
      else {
        if (tipe(obj1[key]) === tipe(obj2[key])) {
          newObj[key] = obj2[key]
        }
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

    var err, details

    // Map error codes to strings
    var codeMap = {
      missingParam: 'Missing Required Parameter',
      badParam: 'Unrecognized Parameter',
      badType: 'Invalid Type',
      badValue: 'Invalid Value',
      badSchema: 'Invalid Schema',
    }

    // Convert arguments to a meaningful object for error details
    if (args) {
      details = {
        value: args[0],
        schema: args[1],
        rootSchema: rootSchema,
        options: prune(args[2]),
      }
      for (var key in details.options) {
        if (!details.options[key]) delete details.options[key]  // only display set options
      }
    }

    if (tipe.isError(msg)) err = msg
    else {
      msg = codeMap[code] + ': ' + msg
      err = new Error(msg)
    }
    err.code = err.code || code
    if (details) err.details = details
    return err
  }
}  // chk


/*
 * helpers
 */


// Pipe-delimited enum: returns true if 'bar' equals any of 'foo|bar|baz'
function match(str, strEnum) {
  if (!tipe.string(strEnum)) return false
  return strEnum.split('|').some(function(member) {
    return (member === str)
  })
}


// Returns an error, rather than throws, for objects that JSON can't serialize
function clone(obj) {
  if (tipe.isScalar(obj)) return obj
  try { var clonedObj = JSON.parse(JSON.stringify(obj)) }
  catch(e) { return e }
  return clonedObj
}


// Debugging helper
function log(s, o) {
  if (tipe.isArguments(s)) {
    return log('chk arguments:', {
      value: s[0],
      schema: s[1],
      options: prune(s[2]),
    })
  }
  console.log(s += (o) ? '\n' + inspect(o, {depth: 10}) : '')
}


// Return a new object with all of the falsey values removed
function prune(obj) {
  var pruned = {}
  for (var key in obj) {
    if (obj[key]) pruned[key] = obj[key]
  }
  return pruned
}


// Export
module.exports = chk
