/**
 * tipe tests
 */

var tipe = require('./tipe.js')
var assert = require('assert')
var undef

// Basic use
assert('undefined' === tipe())
assert('undefined' === tipe(undef))
assert('null' === tipe(null))
assert('boolean' === tipe(true))
assert('boolean' === tipe(false))
assert('number' === tipe(0))
assert('number' === tipe(-1))
assert('number' === tipe(1))
assert('number' === tipe(new Number(1)))
assert('number' === tipe(NaN))
assert('string' === tipe('s'))
assert('null' === tipe(null))
assert('object' === tipe({}))
assert('date' === tipe(new Date()))
assert('array' === tipe([]))
assert('regexp' === tipe(/./))
assert('function' === tipe(Error))
assert('error' === tipe(new Error()))
assert('error' === tipe(new SyntaxError()))

// Sugar
assert(tipe.isUndefined())
assert(tipe.isUndefined(undef))
assert(tipe.isNull(null))
assert(!tipe.isNull(undef))
assert(tipe.isBoolean(true))
assert(tipe.isBoolean(false))
assert(!tipe.isBoolean(0))
assert(!tipe.isBoolean(1))
assert(tipe.isRegexp(/re/))
assert(tipe.isError(new Error()))
assert(tipe.isArray([]))
assert(tipe.isObject({}))
assert.throws(function() {tipe.bogusMethod()})

// User-defined tipes
function Dog() {}
var rover = new Dog()
assert(tipe.isObject(rover))
tipe.add('Dog', 'dog')
assert('dog' === tipe(rover))
assert(!tipe.isObject(rover))
assert(!tipe.isDog({}))
assert(tipe.isDog(rover))

console.log('tests pass')
