/**
 * chek test
 *
 * Tests are synchronous and throw on first failure
 */

var assert = require('assert')
var tipe = require('tipe')      // type checker -- https://github.com:3meters/tipe
var isError = tipe.isError
var chek = require('./chek')
var tests = {}


// helper
function getSchema() {

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
  return schema
}


function getValue() {
  var value = {
    s1: 'hello',
    o1: { s1: 'foo', n1: 1, b1: true },
    o2: { no1: { s1: 'foo', } },
    o3: {s2: 'bla', a3: ['aaa', 'bbb', 'ccc']},
    a1: ['123', '456', '789'],
    a2: [{s1: 'foo'}, {s1: 'bar'}, {s1: 'baz'}, {s1: 'barney'}],
  }
  return value
}


tests.failsNicelyOnEmpty = function() {
  var err = chek()
  assert(isError(err))
  assert('missingParam' === err.code)
}


tests.basicSuccedes = function() {
  var value = getValue()
  var schema = getSchema()
  var err = chek(value, schema, {strict: true})
  if (err) throw err
  assert(value.s2)
  assert('hi' === value.s2)
  assert(value.o1)
  assert('hi' === value.o1.s2)
  assert(1 === value.o1.n2)
  assert(0 === value.o1.n3)
}


/*
tests.basicSuccedesProperly = function() {
  var schema = {
    str1: {type: 'string', required: true},
    num1: {type: 'number', required: true},
    boo1: {type: 'boolean', required: true},
    arr1: {type: 'array'},
    obj1: {type: 'object', value: {
      str1: {type: 'string'},
      str3: {type: 'string', default: '345'}
    }},
    num2: {type: 'number', default: 10},
  }
  var value =  {
    str1: 'hello',
    num1: 1,
    boo1: true,
    // arr1: [],
    obj1: {
      str1: '123',
      str2: '234',
    },
  },
  var err = chek(value, schema, )
      options: {
        setDefaults: true
      },
    },
  }, function(err, res, body) {
    t.assert(body.value.num2 === 10)
    t.assert(body.value.obj1.str3 === '345')
    test.done()
  })
}
*/

tests.minimalSuccedes = function() {
  var schema = {type: 'number', required: true}
  var value = 1
  var err = chek(value, schema)
  if (err) throw err
}

tests.minimalFailsProperly = function() {
  var schema = {type: 'number', required: true}
  var value = 'foo'
  var err = chek(value, schema)
  assert(isError(err))
  assert('badType' === err.code)
}

tests.coerceStringsWorks = function() {
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
  var err = chek(value, schema)
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

tests.missingRequiredScalar = function() {
  var schema =  {type: 'number', required: true}
  var value = null
  var err = chek(value, schema)
  assert(isError(err))
  assert('missingParam' === err.code)
}

tests.missingRequiredObject = function() {
  var schema =  {type: 'object', required: true}
  var value = null
  var err = chek(value, schema)
  assert(isError(err))
  assert('missingParam' === err.code)
}

tests.missingRequiredObject2 = function() {
  var schema = {
    s1: {type: 'string'},
    o1: {type: 'object', required: true}
  }
  var value = { s1: 'foo' }
  var err = chek(value, schema)
  assert(isError(err))
  assert('missingParam' === err.code)
}

tests.missingRequiredNestedScalar = function() {
  var schema = {
    s1: {type: 'string'},
    o1: {type: 'object', required: true, value: {
        s1: {type: 'string', required: true}
      }
    }
  }
  var value = {
    s1: 'foo',
    o1: {
      s2: 'I am not s1'
    }
  }
  var err = chek(value, schema)
  assert(isError(err))
  assert('missingParam' === err.code)
}

tests.strictWorks = function() {
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
  var options = { strict: true }
  var err = chek(value, schema, options)
  assert(isError(err))
  assert('badKey' === err.code)
}


tests.arrayTypesPass = function() {
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
  var err = chek(value, schema, options)
  if (err) throw err
}


tests.arrayBasicFailsProperly = function() {
  var schema = {
    a1: {type: 'array', value: {type: 'string'}, required: true}
  }
  var value = { a1: ['123', '456', '789', 11] }
  var options = { strict: true }
  var err = chek(value, schema, options)
  assert(isError(err))
  assert('badType' === err.code)
}

tests.schemasCanHaveExtraFields = function() {
  var schema = {
    s1: {type: 'string', foo: 'bar'}
  }
  var val = {s1: 'hello'}
  var err = chek(val, schema)
  if (err) throw err
}

tests.schemasCannotMistypeSchemaFields = function() {
  var schema = {
    s1: {type: 1}  // the type of schema type fields must be string
  }
  var val = {n1: 1}
  var err = chek(val, schema)
  assert(isError(err))
  assert('badSchema' === err.code)
}



// Run tests
console.log('chek tests:\n')
for (var test in tests) {
  tests[test]()
  console.log(test)
}
console.log('\npass')
