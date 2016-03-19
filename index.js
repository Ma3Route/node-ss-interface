/**
 * @module ss-interface
 * @description
 * The exported module
 */


"use strict";


// exported classes
exports = module.exports = {
    /** for use by clients requesting data from cache. See {@link Client} class */
    Client: require("./lib/client"),
    /** for use by server adding data to cache and serving to clients. See {@link Server} class */
    Server: require("./lib/server"),
    /** for cache management, by server */
    Collection: require("./lib/collection"),
};
