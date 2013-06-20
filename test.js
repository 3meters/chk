/**
 * chek test
 */

var assert = require('assert')
var tipe = require('tipe')
var chek = require('./chek')


function getTestSchema() {

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
        }}
    },
  }
  return clone(schema)
}


function getTestValue() {
  var value = {
    s1: 'hello',
    o1: { s1: 'foo', n1: 1, b1: true },
    o2: { no1: { s1: 'foo', } },
    o3: {s2: 'bla', a3: ['aaa', 'bbb', 'ccc']},
    a1: ['123', '456', '789'],
    a2: [{s1: 'foo'}, {s1: 'bar'}, {s1: 'baz'}, {s1: 'barney'}],
  }
  return clone(value)
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

var tests = {}

tests.basic = function() {
  var value = getTestValue()
  var schema = getTestSchema()
  var err = chek(value, schema, {strict: true})
  if (err) throw err
  assert(value.s2)
  assert(value.s2 === 'hi')
  assert(value.o1)
  assert(value.o1.s2 === 'hi')
  assert(value.o1.n2 === 1)
  assert(value.o1.n3 === 0)
}

for (var test in tests) {
  tests[test]()
  console.log(test + ' passed')
}
