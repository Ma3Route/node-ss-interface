/**
 * Testing the client
 */


"use strict";


// npm-installed modules
var should = require("should");


// own modules
var Client = require("../lib/client");
var utils = require("./utils");
var server, client;
var config = {
    key: "test:Client",
    batch_size: 5,
};


before(function() {
    server = utils.getCacheServer(config);
    client = utils.getCacheClient(config);
});


beforeEach(function(done) {
    server.purge(done);
});


describe("Client module", function() {
    it("exports a function as constructor", function() {
        should(Client).be.a.Function();
    });

    it("exports .Client for convenience", function() {
        should.strictEqual(Client.Client, Client);
    });
});


describe("Client constructor", function() {
    it("allows configurations be left out", function() {
        should.doesNotThrow(function() {
            return new Client(utils.getRedisClient());
        });
    });

    it("returns an instance of Client", function() {
        var myClient = new Client(utils.getRedisClient());
        should(myClient).be.an.instanceOf(Client);
    });
});


describe("Client#get", function() {
    function pump(items, getOptions, cb) {
        if (!cb) {
            cb = getOptions;
            getOptions = null;
        }
        server.add(items, function(serverErr) {
            should(serverErr).not.be.ok();
            return getOptions ? client.get(getOptions, getCb) : client.get(getCb);
        });
        function getCb(err, ret) {
            should(err).not.be.ok();
            return cb(utils.parse(ret));
        }
    }

    it("returns the latest items by default", function(done) {
        var items = [{ id: 1 }, { id: 2 }];
        pump(items, function(ret) {
            should.deepEqual(ret, items);
            return done();
        });
    });

    it("returns in order of oldest -> newest (IDs)", function(done) {
        var items = [ { id: 2 }, { id: 1 }, { id: 4 } ];
        pump(items, function(ret) {
            should.deepEqual(ret[0], { id: 1 });
            should.deepEqual(ret[1], { id: 2 });
            should.deepEqual(ret[2], { id: 4 });
            return done();
        });
    });

    it("returns items from the start id to +Infinity (inclusive)", function(done) {
        var items = [ { id: 1 }, { id: 2 }, { id: 3 } ];
        pump(items, { id: 2 }, function(ret) {
            should(ret.length).equal(2);
            should.deepEqual(ret, [ { id: 2 }, { id: 3 } ]);
            return done();
        });
    });

    it("returns older items if options.newer === false", function(done) {
        var items = [ { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 } ];
        pump(items, { newer: false, id: 2 }, function(ret) {
            should(ret.length).equal(2);
            should.deepEqual(ret, [ { id: 1 }, { id: 2 } ]);
            return done();
        });
    });

    it("return older items, when options.newer === false, even if their ids are not successive", function(done) {
        var items = [ { id: 1 }, { id: 2 }, { id: 8 } ];
        pump(items, { newer: false, id: 8 }, function(ret) {
            should(ret.length).equal(3);
            should.deepEqual(ret, [ { id: 1 }, { id: 2 }, { id: 8 } ]);
            return done();
        });
    });

    it("returns latest items in batch size", function(done) {
        var items = utils.newItems(20);
        pump(items, function(ret) {
            should(ret.length).equal(config.batch_size);
            return done();
        });
    });

    it("returns old items in batch size", function(done) {
        var items = utils.newItems(20);
        pump(items, { newer: false, id: 20 }, function(ret) {
            should(ret.length).equal(config.batch_size);
            return done();
        });
    });

    it("returns new items from options.id to +Infinity", function(done) {
        var items = utils.newItems(30);
        pump(items, { id: 1 }, function(ret) {
            should(ret.length).equal(30);
            return done();
        });
    });
});
