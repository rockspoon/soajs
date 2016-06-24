'use strict';


module.exports = {
    "init": function () {
    },
    "loadData": function (dbConfiguration, envCode, param, callback) {
        var obj = {};
        obj['ENV_schema'] = {
            "services" : {
                "controller": {
                    "maxPoolSize": 100,
                    "authorization": true,
                    "requestTimeout": 30,
                    "requestTimeoutRenewal": 0
                },
                "config": {
                    "awareness": {
                    },
                    "key": {
                        "algorithm": "aes256",
                        "password": "soajs key lal massa"
                    },
                    "logger": {
                        "src": true,
                        "level": "debug",
                        "formatter": {
                            "outputMode": "long"
                        }
                    },
                    "cors": {
                        "enabled": true,
                        "origin": "*",
                        "credentials": "true",
                        "methods": "GET,HEAD,PUT,PATCH,POST,DELETE",
                        "headers": "key,soajsauth,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type",
                        "maxage": 1728000
                    },
                    "oauth": {
                        "grants": [
                            "password",
                            "refresh_token"
                        ],
                        "debug": false
                    },
                    "ports": {
                        "controller": 4000,
                        "maintenanceInc": 1000,
                        "randomInc": 100
                    },
                    "cookie": {
                    },
                    "session": {
                    }
                }
            }
        };
        return callback(null, obj);
    },
    "registerNewService": function (dbConfiguration, serviceObj, collection, cb) {
        return cb(null);
    },
    "addUpdateServiceIP": function (dbConfiguration, hostObj, cb) {
        return cb(null, true);
    },
    "loadRegistryByEnv": function (param, cb) {
        var obj = {};
        return cb(null, obj);
    },
    "loadOtherEnvHosts": function (param, cb) {
        var obj = {};
        return cb(null, obj);
    },
    "loadProfile": function (envFrom) {
        var regFileObj = {};
        var registry = {
            "timeLoaded": new Date().getTime(),
            "name": envFrom,
            "environment": envFrom,
            "profileOnly": true,
            "coreDB": {
                "provision": regFileObj
            }
        };
        return registry;
    }
};