/**
 * @license r.js 2.3.6 Copyright jQuery Foundation and other contributors.
 * Released under MIT license, http://github.com/requirejs/r.js/LICENSE
 */

/*
 * This is a bootstrap script to allow running RequireJS in the command line
 * in either a Java/Rhino or Node environment. It is modified by the top-level
 * dist.js file to inject other files to completely enable this file. It is
 * the shell of the r.js file.
 */

/*jslint evil: true, nomen: true, sloppy: true */
/*global readFile: true, process: false, Packages: false, print: false,
console: false, java: false, module: false, requirejsVars, navigator,
document, importScripts, self, location, Components, FileUtils */

var requirejs, require, define, xpcUtil;
(function (console, args, readFileFunc) {
    var fileName, env, fs, vm, path, exec, rhinoContext, dir, nodeRequire,
        nodeDefine, exists, reqMain, loadedOptimizedLib, existsForNode, Cc, Ci,
        version = '2.3.6',
        jsSuffixRegExp = /\.js$/,
        commandOption = '',
        useLibLoaded = {},
        //Used by jslib/rhino/args.js
        rhinoArgs = args,
        //Used by jslib/xpconnect/args.js
        xpconnectArgs = args,
        readFile = typeof readFileFunc !== 'undefined' ? readFileFunc : null;

    function showHelp() {
        console.log('See https://github.com/requirejs/r.js for usage.');
    }

    if (typeof process !== 'undefined' && process.versions && !!process.versions.node) {
        env = 'node';

        //Get the fs module via Node's require before it
        //gets replaced. Used in require/node.js
        fs = require('fs');
        vm = require('vm');
        path = require('path');
        //In Node 0.7+ existsSync is on fs.
        existsForNode = fs.existsSync || path.existsSync;

        nodeRequire = require;
        nodeDefine = define;
        reqMain = require.main;

        //Temporarily hide require and define to allow require.js to define
        //them.
        require = undefined;
        define = undefined;

        readFile = function (path) {
            return fs.readFileSync(path, 'utf8');
        };

        exec = function (string, name) {
            return vm.runInThisContext(this.requirejsVars.require.makeNodeWrapper(string),
                                       name ? fs.realpathSync(name) : '');
        };

        exists = function (fileName) {
            return existsForNode(fileName);
        };


        fileName = process.argv[2];

        if (fileName && fileName.indexOf('-') === 0) {
            commandOption = fileName.substring(1);
            fileName = process.argv[3];
        }
    }

    //INSERT require.js


    this.requirejsVars = {
        require: require,
        requirejs: require,
        define: define
    };

    if (env === 'node') {
        this.requirejsVars.nodeRequire = nodeRequire;
        require.nodeRequire = nodeRequire;

        //INSERT build/jslib/node.js

    }

    //Support a default file name to execute. Useful for hosted envs
    //like Joyent where it defaults to a server.js as the only executed
    //script. But only do it if this is not an optimization run.
    if (commandOption !== 'o' && (!fileName || !jsSuffixRegExp.test(fileName))) {
        fileName = 'main.js';
    }

    /**
     * Loads the library files that can be used for the optimizer, or for other
     * tasks.
     */
    function loadLib() {
        //INSERT1 LIB
    }


    /**
     * Sets the default baseUrl for requirejs to be directory of top level
     * script.
     */
    function setBaseUrl(fileName) {
        //Use the file name's directory as the baseUrl if available.
        dir = fileName.replace(/\\/g, '/');
        if (dir.indexOf('/') !== -1) {
            dir = dir.split('/');
            dir.pop();
            dir = dir.join('/');
            //Make sure dir is JS-escaped, since it will be part of a JS string.
            exec("require({baseUrl: '" + dir.replace(/[\\"']/g, '\\$&') + "'});");
        }
    }

    function createRjsApi() {
        //Create a method that will run the optimzer given an object
        //config.
        requirejs.optimize = function (config, callback, errback) {
            if (!loadedOptimizedLib) {
                loadLib();
                loadedOptimizedLib = true;
            }

            //Create the function that will be called once build modules
            //have been loaded.
            var runBuild = function (build, logger, quit) {
                //Make sure config has a log level, and if not,
                //make it "silent" by default.
                config.logLevel = config.hasOwnProperty('logLevel') ?
                                  config.logLevel : logger.SILENT;

                //Reset build internals first in case this is part
                //of a long-running server process that could have
                //exceptioned out in a bad state. It is only defined
                //after the first call though.
                if (requirejs._buildReset) {
                    requirejs._buildReset();
                    requirejs._cacheReset();
                }

                function done(result) {
                    //And clean up, in case something else triggers
                    //a build in another pathway.
                    if (requirejs._buildReset) {
                        requirejs._buildReset();
                        requirejs._cacheReset();
                    }

                    // Ensure errors get propagated to the errback
                    if (result instanceof Error) {
                      throw result;
                    }

                    return result;
                }

                errback = errback || function (err) {
                    // Using console here since logger may have
                    // turned off error logging. Since quit is
                    // called want to be sure a message is printed.
                    console.log(err);
                    quit(1);
                };

                build(config).then(done, done).then(callback, errback);
            };

            requirejs({
                context: 'build'
            }, ['build', 'logger', 'env!env/quit'], runBuild);
        };

        requirejs.tools = {
            useLib: function (contextName, callback) {
                if (!callback) {
                    callback = contextName;
                    contextName = 'uselib';
                }

                if (!useLibLoaded[contextName]) {
                    loadLib();
                    useLibLoaded[contextName] = true;
                }

                var req = requirejs({
                    context: contextName
                });

                req(['build'], function () {
                    callback(req);
                });
            }
        };

        requirejs.define = define;
    }

    //If in Node, and included via a require('requirejs'), just export and
    //THROW IT ON THE GROUND!
    if (env === 'node' && reqMain !== module) {
        setBaseUrl(path.resolve(reqMain ? reqMain.filename : '.'));

        createRjsApi();

        module.exports = requirejs;
        return;
    }

    if (commandOption === 'v') {
        console.log('r.js: ' + version +
                    ', RequireJS: ' + this.requirejsVars.require.version +
                    ', UglifyJS: 2.8.29');
    }

}((typeof console !== 'undefined' ? console : undefined),
    (typeof Packages !== 'undefined' || (typeof window === 'undefined' &&
        typeof Components !== 'undefined' && Components.interfaces) ?
        Array.prototype.slice.call(arguments, 0) : []),
    (typeof readFile !== 'undefined' ? readFile : undefined)));
