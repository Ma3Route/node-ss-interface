/**
 * @description
 * This module defines an interface to be used by the application,
 * on behalf of its users, when trying to retrieve items
 * from the redis server DB.
 */


"use strict";


// exporting the Cache constructor
exports = module.exports = Client;
exports.Client = Client;


// npm-installed modules
var _ = require("lodash");
var debug = require("debug")("ss-interface:client");


// own modules
var defaults = require("./defaults");


/**
 * Construct new instance of the client interface.
 *
 * @constructor
 * @public
 *
 * @param {RedisClient} client
 * @param {Object} [config] - configuration values. See {@link Client#_configure}
 */
function Client(client, config) {
    debug("constructing new client");
    this._client = client; // redis client
    this._key = null; // key to use on redis store
    this._batch_size = null; // size of a batch of items
    this._configure(config);
    return this;
}


/**
 * Configure the redis client. This supports multiple invocations, allowing
 * changing existing configuration. Most configuration values are optional,
 * defaulting to the existing value or the built-in default values.
 *
 * @private
 *
 * @param {Object} [config] - configuration values
 * @param {String} [config.key] - key to use in Redis
 * @param {Number} [config.batch_size] -size of a single batch
 */
Client.prototype._configure = function(config) {
    debug("configuring the client");
    config = config || { };
    _.defaults(config, defaults);
    this._key = config.key;
    this._batch_size = config.batch_size;
    return this;
};


/**
 * Get the latest added items. This retrieves an array of ordered,
 * most-recently-added items, of size <config.batch_size>.
 *
 * @todo allow overriding the batch size used
 *
 * @private
 *
 * @param {Object} [options] - options for retrieving items
 * @param {String} [options.key] - key to use; overriding the cache's key
 * @param {Function} callback - callback(err, items)
 */
Client.prototype._getLatest = function(options, callback) {
    if (!callback) {
        callback = options;
        options = { };
    }
    var key = options.key || this._key;

    debug("getting latest %d items from cache [%s]", this._batch_size, key);
    return this._client.zrange(key, -this._batch_size, -1, callback);
};


/**
 * Retrieve items from cache. Using a single item index, we can look
 * forward (towards the newest items) or behind (towards the oldest items).
 * By default, all the newer items are returned, even if the result array
 * size is larger than <config.batch_size>. Looking behind is limited to
 * return an array of maxium size of <config.batch_size>.
 *
 * @todo allow overriding the batch size
 *
 * @public
 *
 * @param {Object} [options] - options for fetching
 * @param {Number|null} [options.id] - id of item
 * @param {String} [options.key] - key to use; overriding the cache's key
 * @param {Boolean} [options.newer=true] - whether to return newer or older items
 * @param {Function} callback - callback(err, items)
 */
Client.prototype.get = function(options, callback) {
    if (!callback) {
        callback = options;
        options = { };
    }

    var key = options.key || this._key;
    var startIndex = options.id;
    var endIndex = +Infinity;

    // get the latest updates if no id is given
    if (_.isUndefined(startIndex) || _.isNull(startIndex)) {
        this._getLatest({ key: key }, callback);
        return;
    }

    if (options.newer === false) {
        endIndex = startIndex;
        startIndex = startIndex - this._batch_size + 1;
    }

    debug("getting items from cache [%s] {%d -> %s}", key, startIndex, endIndex);
    this._client.zrangebyscore(key, startIndex, endIndex, callback);
    return;
};
