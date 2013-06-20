#tipe

  Simple, fast, sane javascript type checker.

  Tipe is a replacement for typeof that returns a single lower-case string value for all types.

## Install with nodejs

    npm install tipe

## Use

```js
var tipe = require('tipe')
var log = console.log
log(tipe({}))   // 'object'
log(tipe([]))   // 'array'
...
```

  is-methods, e.g. isObject, isArray are provided as sugar.

```js
log(tipe.isBoolean(false))      // true
log(tipe.isError(new Error()))  // true
```

  You can add your own custom tipes for constructors:

```js
function Dog(){}
var fido = new Dog()
log(tipe(fido))         // 'object'
tipe.add('Dog', 'dog')
log(tipe(fido))         // 'dog'
log(tipe.isDog(fido))   // true
```

## Copyright
  Copyright (c) 2013 3meters.  All rights reserverd.

## License
  MIT
