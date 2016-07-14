'use strict';

module.exports = {
    "name": "core_provision",
    "prefix": "",
    "servers": [
        {
            "host": "dataProxy-01",
            "port": 27017
        },
        {
            "host": "dataProxy-02",
            "port": 27017
        },
        {
            "host": "dataProxy-03",
            "port": 27017
        },
        {
            "host": "dataProxy-04",
            "port": 27017
        },
        {
            "host": "dataProxy-05",
            "port": 27017
        }
    ],
    "credentials": null,
    "streaming": {
        "batchSize" : 10000,
        "colName":{
            "batchSize" : 10000
        }
    },
    "URLParam": {
        "connectTimeoutMS": 0,
        "socketTimeoutMS": 0,
        "maxPoolSize": 5,
        "wtimeoutMS": 0,
        "readPreference": "secondaryPreferred",
        "replicaSet": "rs"
    },
    "extraParam": {
        "db": {
            "w": "majority",
            "bufferMaxEntries": 0
        },
        "replSet": {
            "ha": true
        }
    }
};