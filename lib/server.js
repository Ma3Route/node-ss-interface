/**
 * @description
 * This module defines an interface to be used by the server, on its own
 * behalf, to put/delete items from redis server DB.
 */


"use strict";


// Exporting the Constructor
exports = module.exports = Server;
exports.Server = Server;


// npm-installed modules
var _ = require("lodash");
var debug = require("debug")("ss-interface:server");
var stringify = require("json-stable-stringify");


// own modules
var defaults = require("./defaults");


/**
 * Create a new instance of the server interface.
 *
 * @constructor
 * @public
 *
 * @param {RedisClient} client
 * @param {Object} [config] - configuration values. See {@link Server#_configure}
 */
function Server(client, config) {
    debug("constructing new server client");
    this._client = client;
    this._minsize = null;
    this._maxsize = null;
    this._key = null;
    this._stringify = null;
    this._reducing = false;
    this._configure(config);
    return this;
}


/**
 * Configure the instance
 *
 * @private
 *
 * @param {Object} [config] - configuration values
 * @param {String} [config.key] - key to use in Redis
 * @param {Number} [config.min_size] - minimum size of a filled cache
 * @param {Number} [config.max_size] - maximum size of a filled cache. If
 *  '+Infinity' is passed, the cache can grow without limit
 * @param {Function} [config.stringify] - function for stringifying objects
 */
Server.prototype._configure = function _configure(config) {
    debug("configuring client");
    config = config || { };
    _.defaults(config, defaults, {
        stringify: stringify,
    });
    this._minsize = config.min_size;
    this._maxsize = config.max_size;
    this._key = config.key;
    this._stringify = config.stringify;
    return this;
};


/**
 * Return the size of the cache i.e. number of items in the cache. Note that
 * this function queries the redis server to determine this size and it is
 * therefore not stored in process memory. This ensure a consistent value
 * across multiple application instances using a single redis server DB.
 *
 * @public
 * @param {Function} callback - callback(err, size)
 */
Server.prototype.getSize = function(done) {
    var self = this;
    self._client.zcard(self._key, function(err, cardinality) {
        if (err) {
            return done(err);
        }
        return done(null, cardinality);
    });
    return self;
};


/**
 * Add one item to the cache. Ths ID is represents its position in the
 * ordered sequence of all items.
 *
 * @public
 *
 * @param {Number} [id] - id of the item
 * @param {Object|String} item - the item itself
 * @param {Function} [callback] - callback(err)
 */
Server.prototype.addOne = function addOne(id, item, callback) {
    if (!callback && _.isFunction(item)) {
        callback = item;
        item = id;
    }

    if (_.isPlainObject(id)) {
        item = id;
        id = item.id;
    }

    if (!_.isString(item)) {
        item = this._stringify(item);
    }

    debug("adding item to cache [%s] {%d}", this._key, id);
    this._client.zadd(this._key, id, item, this._wrapCallback(callback));
    return;
};


/**
 * Add several items to the cache. These <items> is an array of object,
 * each with an ID (.id prop) that defines its position in the ordered
 * sequence of all items.
 *
 * @public
 *
 * @param {Object[]} items - array of items
 * @param {Number} items[].id - id of the item
 * @param {Function} [callback] - callback(err)
 */
Server.prototype.add = function add(items, callback) {
    debug("adding new items to cache: [%s]", this._key);
    if (items.length === 0) {
        if (callback) {
            return callback(null);
        }
        return null;
    }

    var args = [this._key];
    var len = items.length;
    var item;

    for (var index = 0; index < len; index++) {
        item = items[index];
        args.push(item.id, this._stringify(item));
    }
    args.push(this._wrapCallback(callback));
    return this._client.zadd.apply(this._client, args);
};


/**
 * Remove one item from the cache. This ID represents its position in the
 * ordered sequence of all items.
 *
 * @public
 *
 * @param {Number} id - id of the item
 * @param {Function} [callback] - callback(err)
 */
Server.prototype.removeOne = function removeOne(id, callback) {
    debug("removing item from cache [%s] {%d}", this._key, id);
    this._client.zremrangebyscore(this._key, id, id, callback);
    return;
};


/**
 * Wrap callback for user. This allows us to add several hooks in one place,
 * to be executed just before we return the response to the callee. These
 * hooks include reducing the cache (when necessary).
 *
 * @private
 *
 * @param {Function} [callback] - user's callback
 * @return {Function} wrapped callback
 */
Server.prototype._wrapCallback = function _wrapCallback(callback) {
    var self = this;
    return function(err, added) {
        self._reduce();
        if (callback) {
            callback(err, added);
        }
        return;
    };
};


/**
 * Reduce the cache size to respect maximum limit. This means that at any
 * time, the maximum size the cache can grow to is <config.max_size>.
 * Whenever the size of the cache reaches this upper bound, it is reduced to
 * <config.min_size>. This helps avoid requests that will return 0 items
 * after a size reduction. This function queries the cache on each request.
 * A possible speed up would be have the cache alert the application when
 * maximum size is reached, thus calling this function only when it is
 * needed (and not on each request to add items to cache). Actually, it
 * might happen to fewer times than that as we are debouncing requests in
 * this app process.
 * All functions adding items to the cache call this function thus ensuring
 * the cache does not grow out of bounds.
 *
 * @todo handle errors that are being ignored
 *
 * @private
 */
Server.prototype._reduce = function _reduce() {
    var self = this;

    // this helps debounce requests in this application.
    if (self._reducing) {
        return;
    }

    // if the max_size is +Infinity, then we are NEVER reduce cache size
    if (self._maxsize === +Infinity) {
        return;
    }

    self._reducing = true;
    self.getSize(function(err, currentSize) {
        if (err) {
            // just ignore this error
            return;
        }
        // if the maximum size has not been reached
        if (currentSize < self._maxsize) {
            self._reducing = false;
            return;
        }

        // maximum size has been reached, so we have to reduce items
        debug("reducing size of cache '%s'", self._key);
        self._client.zremrangebyrank(self._key, 0, -(self._minsize + 1), function(reductionErr) {
            if (reductionErr) {
                // IGNORE
            }
            self._reducing = false;
        });
        return;
    });
    return;
};


/**
 * Purge the cache. This destroys your cache's items and its existence in the
 * backing store. This might be useful if your want
 * to reclaim memory in Redis. This function is DANGEROUS. How? If on app
 * startup, we decide to be purging the cache, it would mean that anytime
 * a new application is started, the cache is purged. Such random purges
 * may cause host instability due to the numerous creation and purges
 * requests (especially if we are starting multiple instances at once).
 * It is therefore recommended that you only purge cache when you intend to
 * do so. For example, from an admin panel, you can purge the cache (maybe
 * the cache for the host is misbehaving or during debugging).
 *
 * @public
 *
 * @param {Function} [callback] - callback(err)
 */
Server.prototype.purge = function purgeCache(callback) {
    debug("purging cache [%s]", this._key);
    callback = callback || function() {};
    return this._client.del(this._key, callback);
};
