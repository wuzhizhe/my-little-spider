var config = require('../config/index');
var MongoDB = require('mongodb');
var Promise = require('promise');
var MongoClient = MongoDB.MongoClient;
var dbconfig = config[env].dbconfig;
var url = dbconfig.dbportol + dbconfig.dbhost + dbconfig.dbport + dbconfig.dbname;
var mongodConnect = Promise.denodeify(MongoClient.connect);
global.assert = require('assert');

function getConnection(callback) {
    return mongodConnect(url).then().nodeify(function (err, db) {
        callback(err, db, function () {
            db.close();
        });
    });
};

global.insertMany = function (options, callback) {
    getConnection(function (err, db, cb) {
        db.collection(options.doc).insertMany(options.data, function (error, result) {
            assert.equal(error, null);
            cb();
            callback(error, result);
        });
    });
};

// require('../routes/spider/index').spideSite('https://cnodejs.org/');

//# sourceMappingURL=constantStart-compiled.js.map