/**
 * Grunt, The Javascript Task Runner
 */


"use strict";


exports = module.exports = function(grunt) {
    require("load-grunt-tasks")(grunt);

    grunt.initConfig({
        eslint: {
            lib: ["lib/**/*.js", "Gruntfile.js"],
            test: ["test/**/*.js"],
        },
        jsdoc: {
            docs: {
                src: ["lib/**/*.js", "index.js", "README.md", "package.json"],
                jsdoc: "./node_modules/.bin/jsdoc",
                options: {
                    destination: "docs",
                },
            },
        },
        mochaTest: {
            test: {
                options: {
                    reporter: "spec",
                    quiet: false,
                    clearRequireCache: false,
                },
                src: ["test/**/test.*.js"],
            },
        },
    });

    grunt.registerTask("test", ["eslint", "mochaTest"]);
    grunt.registerTask("docs", ["jsdoc"]);
};
