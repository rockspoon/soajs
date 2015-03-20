'use strict';
var fs = require('fs');

var regEnvironment = (process.env.SOAJS_ENV || "dev");
regEnvironment = regEnvironment.toLowerCase();
var registryDir = (process.env.SOAJS_REGDIR || __dirname+"/../../../");//__dirname);
var projectPath = registryDir + 'profiles/' + (process.env.SOAJS_PRJ || 'default/');
var envPath = projectPath + 'environments/';
var regFile = envPath + regEnvironment.toLowerCase() + '.js';

var registry_struct = {};
registry_struct[regEnvironment] = null;

function deepFreeze(o) {
    var prop, propKey = null;
    Object.freeze(o); // First freeze the object.
    for(propKey in o) {
        if (o.hasOwnProperty(propKey)) {
            prop = o[propKey];
            if (!prop || !o.hasOwnProperty(propKey) || (typeof prop !== "object") || Object.isFrozen(prop)) {
                // If the object is on the prototype, not an object, or is already frozen,
                // skip it. Note that this might leave an unfrozen reference somewhere in the
                // object if there is an already frozen object containing an unfrozen object.
                continue;
            }
            deepFreeze(prop); // Recursively call deepFreeze.
        }
    }
}

function loadRegistry() {
    if (fs.existsSync(regFile)) {
        delete require.cache[require.resolve(regFile)];
        var registry = require(regFile);
        if (registry && typeof registry === 'object') {
            registry.projectPath = projectPath;
            deepFreeze(registry);
            registry_struct[regEnvironment] = registry;
        }
    }
    else
        throw new Error('Invalid profile path: ' + regFile);
}

loadRegistry();

exports.getRegistry = function () {
    try {
        return registry_struct[regEnvironment];
    } catch (e) {
        throw new Error('Failed to get registry: ' + e.message);
    }
};

exports.reloadRegistry = function () {
    try {
        loadRegistry();
        return registry_struct[regEnvironment];
    } catch (e) {
        throw new Error('Failed to get registry: ' + e.message);
    }
};