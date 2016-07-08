
# ss-interface

> Sorted Set Interface (for [Node.js][node])

[![Npm][npm-img]][npm] [![Node.js][node-img]][node] [![Travis][travis-img]][travis]

[npm]:https://npmjs.com/package/ss-interface
[npm-img]: https://img.shields.io/npm/v/ss-interface.svg?style=flat-square
[node]: https://nodejs.org
[node-img]:https://img.shields.io/node/v/ss-interface.svg?style=flat-square
[travis]:https://travis-ci.org/Ma3Route/node-ss-interface
[travis-img]:https://img.shields.io/travis/Ma3Route/node-ss-interface.svg?style=flat-square

This module defines interfaces that can be used by applications using a
Redis Server Database as a cache of items in a sorted set. Such items
*usually* have unique identifiers that can be used to determine their position
in the set. Such identifiers are mostly sequentially-generated IDs, with the
possibility of some IDs to be missing. However, should two or more items
share the same identifier, these items' values are compared with each other
lexicographically<sup>\[[how?][how]]</sup> to determine their final
position. It relies majorly on Redis' [Sorted Set][set] data-structure.

Example of such sets:

A set of 3 items with the IDs `6`, `7` and `8` and values `gocho`, `santa`
and `bull` respectively.

```
{   'gocho'     'santa'     'bull'    }
       6           7          8
```

You can use any string as your items' value. For example, messages on a
server (like IRC?) in JSON format may be stringified
(see [note on Object](#objects)) and stored in the data store.

```
    {id:201,            {id:213,            {id: 215,
{    user:gocho,         user:santa,         user:bull,     }
     message:...}        message:...}        message:...}

        201                 213                 215
```

This makes it favorable for applications:

* using time-sensitive, unique data items,
* with such sequentially-generated IDs,
* have an acceptance of missing items, and
* require the ability to insert items in any position in the set, while
  retaining order

For such applications, the identifiers increment with time. This also
implies that a request is made with the parameters **id** and a boolean value
**x** called 'newer'. If 'newer' is true, the request returns items in the range
`id -> +Infinity` with a limit of 'batch_size'. If 'newer' is false, the
request returns items in the range `-Infinity -> id` with a limit of
'batch_size'.

The interface is divided into main sub-interfaces, **Server** and **Client**.
The Server interface is intended to be used the application, on its own
behalf, to add new items to the set. The Client interface is intended
to be used by the application, on its own or its users' behalf, to
retrieve items from the set. The separation helps focus operations
to either manipulating the cache or simply accessing it.


[node]:http://nodejs.org/
[set]:http://redis.io/topics/data-types-intro#sorted-sets
[how]:http://redis.io/topics/data-types-intro#lexicographical-scores


## where does this module fit in?

```
    +-------------------------------------------------------------------+
    |                                                                   |
    |                           DATA STORE                              |
    |                                                                   |
    +-------------------------------------------------------------------+
                    ^                               ^
                    |                               |
    +------------------------------+  +---------------------------------+
    | +-------------------------+  |  | +-----------------------------+ |
    | |     ss-interface        |  |  | |       ss-interface          | |
    | +-------------------------+  |  | +-----------------------------+ |
    |                              |  |                                 |
    |        App Instance 1        |  |         App Instance 2          |
    |                              |  |                                 |
    +------------------------------+  +---------------------------------+
```

To make maximum use of multi-core systems, we usually tend to replicate our
application process (behind a load balancer). As shown above, the processes
(or rather the app instances) share a single datastore. This helps avoid
storing data in process memory, as it is ineffiecient, memory-consuming
and data can not be accessed across process memory boundaries. The module
provides a smooth interface that can be shared by all of these instances,
when working with sorted sets.


<a name="objects"></a>
## objects:

The interface methods allow passing objects, which are in turn turned into
strings using [json-stable-stringify][json-stable]. Why? JavaScript does
**not** guarantee the order of key-value pairs in objects and their string
equivalents. This fact will introduce duplicate items into the cache, as
`JSON.stringify` is **not** deterministic. However,
[json-stable-stringify][json-stable] is deterministic. "Equal" objects are
therefore, converted into the same string, regardless of the order of their
properties.

While objects will be converted to strings automatically, they will **not**
be converted back to objects (in the client interface). It remains the
responsibility of the caller to parse strings into objects, as necessary.

[json-stable]:https://github.com/substack/json-stable-stringify


## installation:

Using [npm][npm]:

```bash
$ npm install ss-interface
```


## usage:

```js
var ssInterface = require("ss-interface");

// constructing an 'instance' of the Server interface
var ssServerInterface = ssInterface.Server();

// constructing an 'instance' of the Client interface
var ssClientInterface = ssInterface.Client();
```


[npm]:https://npmjs.com/


## documentation:

The documentation can be found online at
https://ma3route.github.io/node-ss-interface/.

However, you can generate documentation on your own:

```bash
$ npm run docs
```

Documentation will be generated to `docs/`. Any decent web server can be
used to server the static files. For example,

```bash
$ npm install http-server
$ http-server docs/
# now you can view the docs at http://0.0.0.0:8080
```


## what's next?

Currently, the module only works with Redis. It would be nice to have the
choice to use alternative data stores.


## tests:

Before running tests, ensure that a Redis server is running at the port
`${REDIS_PORT}` or the default port `6379`.


To run the tests:

```bash
$ npm test
```

## license:

__THE MIT LICENSE__

__Copyright &copy; 2016 SkyeHi Limited__

