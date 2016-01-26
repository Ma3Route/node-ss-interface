/**
 * Testing the server
 */


"use strict";


// npm-installed modules
var should = require("should");


// own modules
var Server = require("../lib/server");
var utils = require("./utils");
var server, client;
var config = {
    key: "test:Server",
    max_size: 10,
    min_size: 8,
};


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


describe("Server module", function() {
    it("exports a function as constructor", function() {
        should(Server).be.a.Function();
    });

    it("exports .Server just for convenience", function() {
        should.strictEqual(Server.Server, Server);
    });
});


describe("constructor", function() {
    it("configuration is optional", function() {
        should.doesNotThrow(function() {
            return new Server(utils.getRedisClient());
        });
    });

    it("returns an instance of Server", function() {
        var server1 = new Server(utils.getRedisClient());
        should(server1).be.an.instanceOf(Server);
    });
});


describe("Server configurations", function() {
    var items = [ ];

    function pump(cb) {
        server.add(items, function(err) {
            should(err).not.be.ok();
            setTimeout(function() {
                client.get(function(clientErr, ret) {
                    should(clientErr).not.be.ok();
                    return cb(utils.parse(ret));
                });
            }, 100);
        });
    }

    before(function() {
        for (var i = 0; i < config.max_size * 2; i++) {
            items.push({ id: i });
        }
    });

    it("maximum size is respected", function(done) {
        pump(function(ret) {
            should(ret.length).below(config.max_size);
            return done();
        });
    });

    it("reduced to min_size", function(done) {
        pump(function(ret) {
            should(ret.length).equal(config.min_size);
            return done();
        });
    });
});


describe("Server#addOne", function() {
    it("works as expected", function(done) {
        server.addOne(100, "item 100", function(err) {
            should(err).not.be.ok();
            client.get(function(clientErr, items) {
                should(clientErr).not.be.ok();
                should.equal(items[0], "item 100");
                return done();
            });
        });
    });

    it("callback is optional", function() {
        should.doesNotThrow(function() {
            server.addOne(200, "item 200");
        });
    });
});


describe("Server#add", function() {
    it("adds several items", function(done) {
        var items = [{ id: 1 }, { id: 2 }];
        server.add(items, function(err) {
            should(err).not.be.ok();
            client.get(function(clientErr, ret) {
                should(clientErr).not.be.ok();
                ret = utils.parse(ret);
                should.deepEqual(ret, items);
                return done();
            });
        });
    });

    it("can add a single item", function(done) {
        var items = [{ id: 839 }];
        server.add(items, function(err) {
            should(err).not.be.ok();
            client.get(function(clientErr, ret) {
                should(clientErr).not.be.ok();
                should.deepEqual(utils.parse(ret), items);
                return done();
            });
        });
    });

    it("ignores empty arrays", function(done) {
        server.add([], function(err) {
            should(err).not.be.ok();
            client.get(function(clientErr, ret) {
                should(clientErr).not.be.ok();
                should(ret.length).equal(0);
                return done();
            });
        });
    });
});


describe("Server#purge", function() {
    it("empties cache", function(done) {
        server.addOne(1, "item 1", function(err) {
            should(err).not.be.ok();
            server.purge(function(purgeErr) {
                should(purgeErr).not.be.ok();
                client.get(function(clientErr, items) {
                    should(clientErr).not.be.ok();
                    should.equal(items.length, 0);
                    return done();
                });
            });
        });
    });
});
