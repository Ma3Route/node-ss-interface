/**
 * Some utilties for easier and faster testing
 */


"use strict";


exports = module.exports = {
    getCacheClient: getCacheClient,
    getCacheServer: getCacheServer,
    getRedisClient: getRedisClient,
    getSource: getSource,
    newItems: newItems,
    parse: parse,
};


// built-in modules
var events = require("events");


// npm-installed modules
var redis = require("redis");


// own modules
var Client = require("../lib/client");
var Server = require("../lib/server");


// module variables
var redisClient;
var redisPort = process.env.REDIS_PORT || 6379;


/**
 * Create a new redis client
 */
function getRedisClient() {
    if (!redisClient) {
        redisClient = redis.createClient(redisPort, "127.0.0.1");
    }
    return redisClient;
}


/**
 * Simple client
 */
function getCacheClient(config) {
    return new Client(getRedisClient(), config);
}


/**
 * Simple server
 */
function getCacheServer(config) {
    return new Server(getRedisClient(), config);
}

/**
 * Parse each element in `items`
 *
 * @param {String[]} items - an array of json strings
 * @return {Object[]} an array of objects
 */
function parse(items) {
    var parsed = [];
    for (var i = 0; i < items.length; i++) {
        parsed.push(JSON.parse(items[i]));
    }
    return parsed;
}


/**
 * Generate a items array of any length
 *
 * @param {Number} length
 * @return {Array}
 */
function newItems(length) {
    var items = [ ];
    for (var i = 1; i <= length; i++) {
        items.push({ id: i });
    }
    return items;
}


/**
 * Return a phony source that we can control ourselves. This will help
 * in observing the behaviour of the cache collection in our tests.
 */
function getSource() {
    var source = new events.EventEmitter();
    source.sendMessage = function(message) {
        source.emit("message", message);
    }
    return source;
}
