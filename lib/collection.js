/**
 * @description
 * A Collection of caches designed to allow easier management of several
 * caches by the server.
 */


"use strict";


// exporting the Constructor
exports = module.exports = Collection;
exports.Collection = Collection;


// npm-installed modules
var _ = require("lodash");
var async = require("async");
var debug = require("debug")("ss-interface:collection");


// own modules
var defaults = require("./defaults");


/**
 * @callback SwitchFunction
 * @param {Object} message - data/message payload
 * @return {Choice} choice - determined choice
 */


/**
 * @callback PopulateFunction
 * @param {String} id - id of the cache. Note that this will always be a
 *   string even if the original ID was a Number
 * @param {Cache} cache - the server cache
 * @param {Function} next - function that MUST be called to indicate completion
 *   of cache population
 */


/**
 * Required return value from a {@link switchFunction}
 * @typedef {Object} Choice
 * @property {Number} choice.cacheId - id of target cache
 * @property {Number} choice.id - id of the message itself
 * @property {Object} choice.data - message that will be inserted into cache
 */


/**
 * Create a new collection
 *
 * @constructor
 * @public
 * @param {Object} [configurations] - configurations for collection
 * @param {Number} [configurations.refreshInterval] - refresh interval
 * @return {Collection}
 */
function Collection(configurations) {
    this._configurations = configurations || {};
    _.defaultsDeep(this._configurations, {
        refreshInterval: defaults.cache_refresh_interval,
    });
    this._caches = { };
    this._sources = [ ];
    this._chooser = function() { throw new Error("no chooser function added"); };
    this._refreshing = false;
    this._refreshInterval = null;
}


/**
 * Add a cache
 *
 * @public
 *
 * @param {Number} id - id of cache
 * @param {cache.Server} cache - server's cache client
 * @param {PopulateFunction} populate - function called to populate cache
 * @return {this} for chaining
 */
Collection.prototype.addCache = function(id, cache, populate) {
    this._caches[id] = {
        cache: cache,
        populate: populate,
    };
    return this;
};


/**
 * Return a reference to a cache. Returns 'undefined' if cache is not found.
 *
 * @public
 *
 * @param {Number} id - id of the cache
 * @return {cache.Server|undefined}
 */
Collection.prototype.getCache = function getCache(id) {
    var c = this._caches[id];
    return c ? c.cache : c;
}


/**
 * Add function for deciding which cache is to be used
 *
 * If the function returns `null`, or the id it returns does
 * not resolve to a cache, the message is ignored.
 *
 * @public
 *
 * @param {SwitchFunction} choose - choose function
 * @return {this} for chaining
 */
Collection.prototype.switch = function(choose) {
    this._chooser = choose;
    return this;
};


/**
 * Add a source of data.
 *
 * While it might seem too much, I shall add option to add more than one
 * source of data. This might be useful if more sources would ensure more
 * fault tolerance or we actually have different sources.
 *
 * If a cache can not be resolved, the message is ignored.
 * If an error occurs while adding an item to cache, it is ignored.
 *
 * @public
 *
 * @param {EventEmitter} source - an Event Emitter
 * @return {this} for chaining
 */
Collection.prototype.addSource = function(source) {
    var self = this;
    source.on("message", function(data) {
        // do not insert an item, if we are in a refresh process
        if (self._refreshing) {
            return;
        }

        debug("new items from source");
        if (_.isArray(data)) {
            data.forEach(function(item) {
                putInItem(item);
            });
        } else {
            putInItem(data);
        }
    });

    function putInItem(item) {
        try {
            if (!_.isPlainObject(item)) item = JSON.parse(item);
        } catch(parseErr) {
            // ignore the message, if we can not parse it
            debug("could not parse message into object: %s", item);
            return;
        }
        var det = self._chooser(item);
        if (!det) {
            return;
        }
        var c = self._caches[det.cacheId];
        if (c) {
            c.cache.addOne(det.id, det.data);
        }
    }

    this._sources.push(source);
    return this;
};


/**
 * Start the refresh interval
 *
 * @param {Object} [options]
 * @param {Number} [options.invokeImmediately=true] Invoke immediately
 * @return {this}
 */
Collection.prototype.startRefreshInterval = function(options) {
    debug("starting refresh interval");
    var opts = _.defaults({}, options, {
        invokeImmediately: true,
    });
    var self = this;
    var funcs = {};

    for (var cacheId in self._caches) {
        funcs[cacheId] = wrapPopulateFunc(cacheId);
    }

    if (opts.invokeImmediately) {
        refresh();
    }
    self._refreshInterval = setInterval(refresh, self._configurations.refreshInterval);

    function wrapPopulateFunc(id) {
        return function(done) {
            var c = self._caches[id];
            return c.populate(id, function(populateErr, items) {
                if (populateErr) {
                    debug("error occurred while populating cache with id %s", cacheId);
                    return done(populateErr);
                }
                // if we do not receive an array, hit next with an error
                if (!_.isArray(items)) {
                    var msg = "Expected an array from the populate function. Instead got a " + typeof items + ".";
                    return done(new Error(msg));
                }
                // purge cache, then add items
                return async.series([
                    c.cache.purge.bind(c.cache),
                    function(next) { c.cache.add(items, next); },
                ], done);
            });
        };
    }

    function refresh() {
        if (self._refreshing) {
            return null;
        }

        self._refreshing = true;
        debug("## CACHE_REFRESH at %s", Date.now());
        return async.parallel(funcs, function(err) {
            if (err) {
                debug("error occurred during cache refresh: %s", err);
            }
            self._refreshing = false;
        });
    }

    return self;
};


/**
 * Stop the refresh interval
 *
 * @return {this}
 */
Collection.prototype.stopRefreshInterval = function() {
    clearInterval(this._refreshInterval);
    return this;
};
