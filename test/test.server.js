/**
 * Testing the server
 */


"use strict";


// npm-installed modules
var _ = require("lodash");
var async = require("async");
var should = require("should");
var stringify = require("json-stable-stringify");


// own modules
var Server = require("../lib/server");
var utils = require("./utils");
var server, client;
var serverUniqueIds;
var config = {
    key: "test:Server",
    max_size: 10,
    min_size: 8,
};


before(function() {
    server = utils.getCacheServer(config);
    serverUniqueIds = utils.getCacheServer(_.assign({}, config, {
        uniqueIds: true,
    }));
    client = utils.getCacheClient(config);
});


function purge(done) {
    return async.parallel([
        server.purge.bind(server),
        serverUniqueIds.purge.bind(serverUniqueIds),
    ], done);
}
beforeEach(purge);
after(purge);


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
        items = utils.newItems(config.max_size * 2);
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


describe("Server#getSize", function() {
    it("returns '0' if zero items", function(done) {
        server.getSize(function(err, size) {
            should(err).not.be.ok();
            should(size).equal(0);
            return done();
        });
    });

    it("returns '1' if one item is added", function(done) {
        server.addOne(8, "item 8", function(err) {
            should(err).not.be.ok();
            server.getSize(function(getSizeErr, size) {
                should(getSizeErr).not.be.ok();
                should(size).equal(1);
                return done();
            });
        });
    });

    it("return 'n' if 'n' items are added", function(done) {
        var items = [{ id: 1 }, { id: 2 }];
        server.add(items, function(addErr) {
            should(addErr).not.be.ok();
            server.getSize(function(getSizeErr, size) {
                should(getSizeErr).not.be.ok();
                should(size).equal(items.length);
                return done();
            });
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

    it("id is optional", function(done) {
        should.doesNotThrow(function() {
            server.addOne({ id: 2434 }, done);
        });
    });

    it("callback is optional", function() {
        should.doesNotThrow(function() {
            server.addOne(200, "item 200");
        });
    });

    it("id and callback are both optional", function() {
        should.doesNotThrow(function() {
            server.addOne({ id: 243 });
        });
    });

    it("allows using an object", function(done) {
        var obj = { id: 2024, data: "data" };
        server.addOne(obj, function(err) {
            should(err).not.be.ok();
            client.get(function(clientErr, items) {
                should(clientErr).not.be.ok();
                should.equal(items[0], stringify(obj));
                return done();
            });
        });
    });

    it("allows unique IDs", function(done) {
        var item1 = { id: 1, data: "old" };
        var item2 = { id: 1, data: "new" };
        return async.series([
            function(next) {
                serverUniqueIds.addOne(item1, function(err) {
                    should(err).not.be.ok();
                    return next();
                });
            },
            function(next) {
                serverUniqueIds.addOne(item2, function(err) {
                    should(err).not.be.ok();
                    return next();
                });
            },
            function(next) {
                client.get(function(err, items) {
                    should(err).not.be.ok();
                    should(items.length).equal(1);
                    should(items[0]).equal(stringify(item2));
                    return next();
                });
            },
        ], done);
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

    it("allows unique IDs", function(done) {
        var items1 = [{ id: 1, data: "1" }, { id: 2, data: "2" }];
        var items2 = [{ id: 1, data: "3" }, { id: 2, data: "4" }];
        return async.series([
            function(next) {
                serverUniqueIds.add(items1, function(err) {
                    should(err).not.be.ok();
                    return next();
                });
            },
            function(next) {
                serverUniqueIds.add(items2, function(err) {
                    should(err).not.be.ok();
                    return next();
                });
            },
            function(next) {
                client.get(function(err, items) {
                    should(err).not.be.ok();
                    should(items.length).equal(2);
                    should(items[0]).equal(stringify(items2[0]));
                    should(items[1]).equal(stringify(items2[1]));
                    return next();
                });
            },
        ], done);
    });
});


describe("Server#removeOne", function() {
    it("removes a single item", function(done) {
        var id = 434;
        server.addOne(id, "item 434", function(addErr) {
            should(addErr).not.be.ok();
            server.removeOne(id, function(removeErr) {
                should(removeErr).not.be.ok();
                client.get(function(getErr, items) {
                    should(getErr).not.be.ok();
                    should(items.length).equal(0);
                    return done();
                });
            });
        });
    });

    it("ignores non-existing item", function(done) {
        server.removeOne(243, function(removeErr) {
            should(removeErr).not.be.ok();
            return done();
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
