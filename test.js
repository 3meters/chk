/**
 * chk tests
 *
 * tests are synchronous and throw on first failure
 */

var assert = require('assert')
var util = require('util')
var tipe = require('tipe')    // type checker -- https://github.com:3meters/tipe
var isError = tipe.isError
var isNull = tipe.isNull
var chk = require('./chk')
var test = {}


test.failsOnEmptyOrNonObjectSchema = function() {
  assert(isError(chk(1)))
  assert(isError(chk(1, 1)))
}


test.minimalWorks = function() {
  var schema = {type: 'number', required: true}
  var err = chk(1, schema)
  assert(isNull(err), (err && err.stack) ? err.stack : '')
  err = chk('foo', schema)
  assert(isError(err))
  assert('badType' === err.code)
}


test.basicRequired = function() {
  var err = chk(undefined, {required: true})
  assert(isError(err))
  assert('missingParam' === err.code)
}


test.basicDefault = function() {
  var foo = {}
  var err = chk(foo, {n1: {default: 1}})
  assert(isNull(err))
  assert(1 === foo.n1)
}


test.basicArray = function() {
  var schema = {type: 'array', value: {type: 'string'}}
  var val = []
  var err = chk(val, schema)
  assert(isNull(err))
  val = ['foo', 'bar', 'baz']
  err = chk(val, schema)
  assert(isNull(err))
  val.push(1)
  err = chk(val, schema)
  assert(isError(err))
  assert('badType' === err.code)
}


test.bigSuccedes = function() {
  var schema = {
    s1: { type: 'string', required: true },
    s2: { type: 'string', default: 'hi' },
    o1: { type: 'object', value: {
      s1: { type: 'string' },
      s2: { type: 'string', default: 'hi' },
      s3: { type: 'string', default: '' },
      n1: { type: 'number' },
      n2: { type: 'number', default: 1 },
      n3: { type: 'number', default: 0 },
      b1: { type: 'boolean' },
    }},
    o2: {
      type: 'object', value: {
        no1: {type: 'object', value: {
          s1: { type: 'string', value: 'foo'}
        }}
      }
    },
    o3: {type: 'object', required: true, value: {
        s2: {type: 'string', required: true},
        a3: {type: 'array', required: true, value: {type: 'string'}}
      },
    },
    a1: {type: 'array', value: {type: 'string'}},
    a2: {type: 'array', value: {type: 'object', value: {
            s1: {type: 'string', required: true},
            s2: {type: 'string', default: 'hello'},
        }}
    },
  }
  var value = {
    s1: 'hello',
    o1: { s1: 'foo', n1: 1, b1: true },
    o2: { no1: { s1: 'foo', } },
    o3: {s2: 'bla', a3: ['aaa', 'bbb', 'ccc']},
    a1: ['123', '456', '789'],
    a2: [{s1: 'foo'}, {s1: 'bar'}, {s1: 'baz'}, {s1: 'barney'}],
  }
  var err = chk(value, schema, {strict: true})
  if (err) throw err
  assert(value.s2)
  assert('hi' === value.s2)
  assert(value.o1)
  assert('hi' === value.o1.s2)
  assert(1 === value.o1.n2)
  assert(0 === value.o1.n3)
  assert(4 === value.a2.length)
  value.a2.forEach(function(elm) {
    assert(tipe.isString(elm.s1))
    assert('hello' === elm.s2)
  })
  value.a2.push({s2: 'I should fail'})
  err = chk(value, schema)
  assert(err)
  assert('missingParam' === err.code)
}


test.coerceStrings = function() {
  var schema = {
    n1: {type: 'number'},
    n2: {type: 'number'},
    n3: {type: 'number'},
    n4: {type: 'number'},
    n5: {type: 'number'},
    b1: {type: 'boolean'},
    b2: {type: 'boolean'},
    b3: {type: 'boolean'},
    b4: {type: 'boolean'},
    b5: {type: 'boolean'},
  }
  var value =  {
    n1: '100',
    n2: '-1',
    n3: '0.52',
    n4: '1.7',
    n5: '0',
    b1: 'true',
    b2: 'foo',
    b3: '1',
    b4: '0',
    b5: '-1',
  }
  var err = chk(value, schema)
  if (err) throw err
  assert(100 === value.n1)
  assert(-1 === value.n2)
  assert(0.52 === value.n3)
  assert(1.7 === value.n4)
  assert(0 === value.n5)
  assert(true === value.b1)
  assert(false === value.b2)
  assert(true === value.b3)
  assert(false === value.b4)
  assert(false === value.b5)
}


test.missingRequiredScalar = function() {
  var schema =  {type: 'number', required: true}
  var value = null
  var err = chk(value, schema)
  assert(isError(err))
  assert('missingParam' === err.code)
}


test.missingRequiredObject = function() {
  var schema = {
    s1: {type: 'string'},
    o1: {type: 'object', required: true}
  }
  var value = { s1: 'foo' }
  var err = chk(value, schema)
  assert(isError(err))
  assert('missingParam' === err.code)
}


test.missingRequiredNested = function() {
  var schema = {
    s1: {type: 'string'},
    o1: {type: 'object', required: true, value: {
        s1: {type: 'string', required: true}
      }
    }
  }
  var value = {
    s1: 'foo',
    o1: {s1: 'I am nested s1'}
  }
  var err = chk(value, schema)
  assert(!err)
  var value = {
    s1: 'foo',
    o1: {s2: 'I am not nested s1'}
  }
  var err = chk(value, schema)
  assert(isError(err))
  assert('missingParam' === err.code)
}


test.topLevelArrays = function() {
  var schema = {type: 'array', value: {
    type: 'object', value: {
      n1: {type: 'number', required: true},
      s1: {type: 'string', default: 'foo'}
    }
  }}
  var value = [{n1: 1}, {n1: 2}]
  var err = chk(value, schema)
  assert(!err)
  assert('foo' === value[0].s1)
  assert('foo' === value[1].s1)
  value = [{n1: 1}, {s1: 'bar'}]
  var err = chk(value, schema)
  assert(isError(err))
  assert('missingParam' === err.code)
}


test.strictWorks = function() {
  var schema = {
    s1: {type: 'string'},
    o1: {type: 'object', required: true, value: {
        s1: {type: 'string', required: true}
      }
    },
  }
  var value = {
    s1: 'foo',
    o1: {
      s1: 'I am required',
      s2: 'I am not allowed with strict'
    }
  }
  var err = chk(value, schema)
  assert(isNull(err))
  err = chk(value, schema, {strict: true})
  assert(isError(err))
  assert('badParam' === err.code)
}
test.strictWorks()


test.nestedStrictWorks = function() {
  var schema = {
    s1: {type: 'string'},
    o1: {
      type: 'object',
      required: true,
      strict: false,
      value: {s1: {type: 'string', required: true}}
    }
  }
  var value = {
    s1: 'foo',
    o1: {
      s1: 'I am required',
      s2: 'I am not allowed with strict'
    }
  }
  var err = chk(value, schema)
  assert(isNull(err))
  err = chk(value, schema, {strict: true})
  assert(isNull(err))  // local option overroad global options
  schema.o1.strict = true
  err = chk(value, schema)
  assert(isError(err))
  assert('badParam' === err.code)
}

test.arrayTypesPass = function() {
  var schema = {
    a1: {type: 'array', value: {type: 'string'}},
    a2: {type: 'array', value: {type: 'object', value: {
            s1: {type: 'string', required: true},
        }}
    },
    o1: {type: 'object', required: true, value: {
        s2: {type: 'string', required: true},
        a3: {type: 'array', required: true, value: {type: 'string'}}
      }
    },
  }
  var value = {
    a1: ['123', '456', '789'],
    a2: [{s1: 'foo'}, {s1: 'bar'}, {s1: 'baz'}],
    o1: {s2: 'bla', a3: ['aaa', 'bbb', 'ccc']},
  }
  var options = { strict: true }
  var err = chk(value, schema, options)
  if (err) throw err
}


test.arrayBasicFailsProperly = function() {
  var schema = {
    a1: {type: 'array', value: {type: 'string'}, required: true}
  }
  var value = { a1: ['123', '456', '789', 11] }
  var options = { strict: true }
  var err = chk(value, schema, options)
  assert(isError(err))
  assert('badType' === err.code)
}


test.enumsWork = function() {
  var schema = {s1: {type: 'string', value: 'foo|bar|baz'}}
  var value = {s1: 'bar'}
  var err = chk(value, schema)
  if (err) throw err
  var err = chk({s1: 'notfoo'}, schema)
  assert(tipe.isError(err))
  assert('badValue' === err.code)
}


test.functionValidatorsWork = function() {
  var schema = {
    type: 'string',
    value: function(v) {
      // true if first char is uppercase
      if (v[0] && v[0] === v[0].toUpperCase()) return null
      else return new Error('Must be uppercase')
    }
  }
  var err = chk('Hello', schema)
  assert(!err)
  err = chk('hello', schema)
  assert(isError(err))
  assert('badValue' === err.code)
}


test.functionValidatorsWorkWithNonErrorReturnCodes = function() {
  var schema = {
    type: 'string',
    value: function(v) {
      // true if first char is uppercase
      if (v[0] && v[0] === v[0].toUpperCase()) return null
      else return 'Must be uppercase'
    }
  }
  var err = chk('Hello', schema)
  assert(!err)
  err = chk('hello', schema)
  assert(isError(err))
  assert('badValue' === err.code)
}


test.schemasCanHaveExtraFields = function() {
  var schema = {
    s1: {type: 'string', foo: 'bar'}
  }
  var val = {s1: 'hello'}
  var err = chk(val, schema)
  if (err) throw err
}


test.validatorFunctions = function() {
  function valid(v) {
    if (v < 1) return new Error()
  }
  var schema = {
    validate: valid
  }
  var err = chk(0, schema)
  assert(isError(err))
  err = chk(1, schema)
  assert(isNull(err))
}


test.validatorsOnWithArrays = function() {
  function valid(v) {
    if (v.n1 <= v.n2) {
      var err = new Error('n1 must be greater than n2')
      err.code = 'failedValidator'
      return err
    }
    return null
  }
  var schema = {
    type: 'array', value: {
      type: 'object', value: {
        n1: {type: 'number'},
        n2: {type: 'number'},
      },
      validate: valid
    }
  }
  var val = []
  var err = chk(val, schema)
  assert(isNull(err))
  val.push({n1: 2, n2: 1})
  err = chk(val, schema)
  assert(isNull(err))
  val.push({n1: 1, n2: 2})
  err = chk(val, schema)
  assert(isError(err))
  assert('failedValidator' === err.code)
}


// Run test
console.log('\nchk test\n==========')
for (var t in test) {
  console.log(t)
  test[t]()
}
console.log('\nchk test pass')
