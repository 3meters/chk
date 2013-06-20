/**
 *  tipe.js
 *
 *  Simple javascript typeof replacement with sane handling
 *  of semi-primitives and easily configurable list of known
 *  constructors. Provides isString(v), isNumber(v), etc for
 *  all tipes as convenience methods.
 *
 *  Copyright (c) 2013 3meters
 *  MIT Licensed
 */


// Main
function tipe(v) {

  var result, className

  // Give typeof first crack
  result = tipeMap[typeof(v)]
  if (result) return result

  // Optimized checkers
  if (null === v) return 'null'
  if (Array.isArray(v)) return 'array'

  // Check for custom classes
  if (v.constructor) {
    result = tipeMap[v.constructor.name]
    if (result) return result
  }

  // We have some kind of object, but what kind?
  className = Object.prototype.toString.call(v).slice(8, -1)

  return tipeMap[className] || 'object'
}


// Map of value types to their tipes
var tipeMap = {
  'undefined': 'undefined',
  'boolean': 'boolean',
  'number': 'number',
  'string': 'string',
  'function': 'function',
  'Arguments': 'arguments',
  'Number': 'number',
  'String': 'string',
  'RegExp': 'regexp',
  'Array': 'array',
  'Date': 'date',
  'Error': 'error',
}


// Add a user-specfied tipe to the tipeMap
// The className must be the name of the constructor
tipe.add = function(className, tipeName) {
  if ('Object' === className || tipeMap[className]) return // ddt
  tipeMap[className] = tipeName
  addIsMethod(tipeName)
}


// Sweeten with tipe.isString(v), tipe.isPoodle(v), etc.
function addIsMethod(tipeName) {
  var upperCaseTipeName = tipeName.charAt(0).toUpperCase() + tipeName.slice(1)
  tipe['is' + upperCaseTipeName] = function(v) {
    return tipe(v) === tipeName
  }
}


// Add sugar on require
(function() {
  for (var key in tipeMap) {
    addIsMethod(tipeMap[key])
  }
  addIsMethod('null')
  addIsMethod('object')
})()


// Export
module.exports = tipe
