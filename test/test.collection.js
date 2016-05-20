/**
 * Testing the collection
 */


"use strict";


// npm-installed modules
var should = require("should");


// own modules
var Collection = require("../lib/collection");
var utils = require("./utils");


// module variables
var server, client;
var config = {
    key: "test:Collection",
    max_size: 10,
    min_size: 8,
};
var noop = function() {};


before(function() {
    server = utils.getCacheServer(config);
    client = utils.getCacheClient(config);
});


beforeEach(function(done) {
    server.purge(done);
});


after(function(done) {
    server.purge(done);
});


describe("Collection module", function() {
    it("exports a function as constructor", function() {
        should(Collection).be.a.Function();
    });

    it("exports .Collection just for convenience", function() {
        should.strictEqual(Collection.Collection, Collection);
    });
});


describe("Collection#Constructor", function() {
    it("configuration is optional", function() {
        should.doesNotThrow(function() {
            return new Collection();
        });
    });

    it("returns an instance of Collection", function() {
        var myCollection = new Collection();
        should(myCollection).be.an.instanceOf(Collection);
    });
});


describe("Collection#_chooser", function() {
    var collection = new Collection();

    it("throws an error if not configured yet", function() {
        should.throws(function() {
            collection._chooser();
        });
    });
});



describe("Collection#addCache", function() {
    var collection = new Collection();

    it("adds cache to the collection", function() {
        collection.addCache("mine", server, noop);
        should(collection.getCache("mine")).equal(server);
    });
});


describe("Collection#getCache", function() {
    var collection = new Collection();

    it("returns the cache, if was added previously", function() {
        collection.addCache("new", server, noop);
        should(collection.getCache("new")).equal(server);
    });

    it("returns 'undefined' if cache was not found", function() {
        should(collection.getCache("404")).equal(undefined);
    });
});


describe("Collection#switch", function() {
    var collection = new Collection();
    var source = utils.getSource();
    var originalItem = { id: 1, data: "hello" };

    it("adds a function used for switching between caches", function(done) {
        collection.addSource(source);
        collection.switch(function(item) {
            should(item).equal(originalItem);
            return done();
        });
        source.sendMessage(originalItem);
    });
});


describe("Collection#addSource", function() {
    var collection = new Collection();
    var source = utils.getSource();
    var originalItem = { id: 1, data: "message" };

    it("adds source of messages", function(done) {
        collection.switch(function() {
            return done();
        });
        collection.addSource(source);
        source.sendMessage(originalItem);
    });
});


describe("Collection's internal workings", function() {
    var collection, source;
    var originalItem = { id: 1, data: "internal workings" };
    var refreshInterval = 150;

    beforeEach(function() {
        collection = new Collection({
            refreshInterval: refreshInterval,
        });
        source = utils.getSource();
        collection.addSource(source);
    });

    afterEach(function() {
        collection.stopRefreshInterval();
    });

    it("ignores message if it can not be parsed", function(done) {
        collection.switch(function(item) {
            should(item).equal(originalItem);
            return done();
        });
        source.sendMessage("can not be parsed :)");
        source.sendMessage(originalItem);
    });

    it("allows a single message from source", function(done) {
        collection.switch(function(item) {
            should(item).equal(originalItem);
            return done();
        });
        source.sendMessage(originalItem);
    });

    it("allows an array of messages from source", function(done) {
        var items = [{ id: 1 }, { id: 2 }];
        var index = 0;
        collection.switch(function(item) {
            should(item).equal(items[index++]);
            if (index === items.length) return done();
        });
        source.sendMessage(items);
    });

    it("adds the message to the target cache", function(done) {
        var message = "just inserted by Collection#addCache";
        collection.addCache(1, server, noop);
        collection.switch(function(item) {
            process.nextTick(function() {
                client.get(function(err, items) {
                    should(err).not.be.ok();
                    should(items).containEql(message);
                    return done();
                });
            });
            return {
                cacheId: 1,
                id: 1,
                data: message,
            };
        });
        source.sendMessage(originalItem);
    });

    it("ignores the message, if the switch function does not return a Choice", function(done) {
        collection.addCache(1, server, noop);
        collection.switch(function() {
            process.nextTick(function() {
                client.get(function(err, items) {
                    should(err).not.be.ok();
                    should(items.length).equal(0);
                    return done();
                });
            });
            return null;
        });
        source.sendMessage(originalItem);
    });

    it("ignores message, if target cache can not be found", function(done) {
        var exitNow = false;
        collection.switch(function() {
            if (exitNow) return done();
            return {
                cacheId: "not to be found",
                id: 1,
                message: "useless",
            };
        });
        source.sendMessage(originalItem);
        exitNow = true;
        source.sendMessage(originalItem);
    });

    it("passes the cache ID and a done() callback to populate functions", function(done) {
        collection.addCache("mine", server, function(id, next) {
            should(id).equal("mine");
            should(next).be.a.Function();
            collection.stopRefreshInterval();
            next();
            return done();
        });
        collection.startRefreshInterval();
    });

    it("purges cache during cache refresh", function(done) {
        var firstRun = true;
        collection.addCache("mine", server, function(id, next) {
            var items = firstRun ? [originalItem] : [];
            firstRun = false;
            return next(null, items);
        });
        setTimeout(function() {
            collection.stopRefreshInterval();
            client.get(function(err, items) {
                should(err).not.be.ok();
                should(items.length).equal(0);
                return done();
            });
        }, refreshInterval * 3);
        collection.startRefreshInterval();
    });

    it("adds the items returned from the populate functions to cache", function(done) {
        var items = [{name: "items populated", id: 2332}];
        collection.addCache("items-populate", server, function(id, next) {
            return next(null, items);
        });
        setTimeout(function() {
            collection.stopRefreshInterval();
            client.get(function(getErr, returnedItems) {
                should(getErr).not.be.ok();
                returnedItems[0] = JSON.parse(returnedItems[0]);
                should.deepEqual(returnedItems, items);
                return done();
            });
        }, refreshInterval * 3);
        collection.startRefreshInterval();
    });
});


describe("Collection#startRefreshInterval", function() {
    var collection;
    var refreshInterval = 150;

    beforeEach(function() {
        collection = new Collection({
            refreshInterval: refreshInterval,
        });
    });

    afterEach(function() {
        collection.stopRefreshInterval();
    });

    it("invokes populate functions at once", function(done) {
        this.timeout(100);
        collection.addCache(1, server, function() {
            return done();
        });
        collection.startRefreshInterval();
    });

    it("does not invoke populate functions immediately, if options.invokeImmediately = false", function(done) {
        var then = Date.now();
        collection.addCache(1, server, function(id, next) {
            should(Date.now() - then).above(refreshInterval);
            next();
            return done();
        });
        collection.startRefreshInterval({
            invokeImmediately: false,
        });
    });

    it("starts a timed interval", function(done) {
        var interval = 0;
        collection.addCache(1, server, function(id, next) {
            next();
            if (++interval === 5) return done();
        });
        collection.startRefreshInterval();
    });
});


describe("Collection#stopRefreshInterval", function() {
    var collection;

    beforeEach(function() {
        collection = new Collection({
            refreshInterval: 150,
        });
    });

    it("stops refresh intervals", function(done) {
        var timeout = 800;
        var called = 0;
        this.timeout(timeout + 200);
        collection.addCache(1, server, function(id, next) {
            called++;
            return next();
        });
        setTimeout(function() {
            should(called).equal(3);
            return done();
        }, 800);
        setTimeout(function() {
            collection.stopRefreshInterval();
        }, 350);
        collection.startRefreshInterval();
    });
});
