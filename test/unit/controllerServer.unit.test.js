//this is comment

var assert = require("assert");
var async = require("async");
var helper = require("../helper.js");

var requester = helper.requester;

var controllerApp = new (helper.requireModule('./servers/controller.js'));
var soajs = helper.requireModule('index.js');

describe('Testing controllerServer', function() {
	before(function(done) {
	  controllerApp.start(function(err) {
	    assert.ifError(err);
	    done();
	  });
	});
	after(function(done) {
	  controllerApp.stop(function(err) {
	    assert.ifError(err);
	    done();
	  });
	});

	it('Testing /favicon.ico',function(done){
		requester('get', {
			uri: 'http://localhost:4000/favicon.ico'
			}, function(err,body,response){
	    		assert.ifError(err);
	    		assert.equal(typeof(body),'undefined');
	    		assert.equal(response.statusCode,200);
	    		assert.equal(response.headers['content-type'],'image/x-icon');
				done();	
		});
	});
	it('Testing /reloadRegistry',function(done){
		requester('get', {
			uri: 'http://localhost:5000/reloadRegistry'
			}, function(err,body,response){
	    		assert.ifError(err);
	    		assert.equal(response.statusCode,200);
	    		assert.equal(response.headers['content-type'],'application/json');
				done();	
		});
	});
	it('Testing /heartbeat',function(done){
		requester('get', {
			uri: 'http://localhost:5000/heartbeat'
			}, function(err,body,response){
	    		assert.ifError(err);
	    		assert.equal(response.statusCode,200);
	    		assert.equal(response.headers['content-type'],'application/json');
				done();	
		});
	});
	it('Testing /unknown',function(done){
		requester('get', {
			uri: 'http://localhost:5000/unknown'
			}, function(err,body,response){
	    		assert.ifError(err);
	    		assert.equal(response.statusCode,200);
	    		assert.equal(body,"nothing to do!");
	    		assert.equal(response.headers['content-type'],'text/plain');
				done();	
		});
	});
	it('Testing /example01 w/o starting service',function(done){
		requester('get', {
			uri: 'http://localhost:4000/example01'
			}, function(err,body,response){
	    		assert.ifError(err);
	    		assert.equal(response.statusCode,200);
	    		assert.deepEqual(body,{"result":false,"errors":{"codes":[135],"details":[{"code":135,"message":"Error occurred while redirecting your request to the service"}]}});
				done();	
		});
	});
	it('Testing /example02 w/o starting service',function(done){
		requester('get', {
			uri: 'http://localhost:4000/example02'
			}, function(err,body,response){
	    		assert.ifError(err);
	    		assert.equal(response.statusCode,200);
	    		assert.deepEqual(body,{"result":false,"errors":{"codes":[132],"details":[{"code":132,"message":"A valid key is needed to access any API."}]}});
				done();	
		});
	});
});

describe('Testing example01 via controllerServer w/services', function() {
	var service = new soajs.server.service({
	  "serviceName" : 'example01',
	  "bodyParser": true,
	  "methodOverride": true,
	  "cookieParser": true,
	  "logger": true,
	  "inputmask": true,
	  "session": false,
	  "security": false,
	  "multitenant": false,
	  "acl": false,
	  "config": {errors:{},schema:{
	  	"/validService" : {
	            "firstName": {
	                "source": ['query.firstName'],
	                "required": false,
	                "validation": {
	                    "type": "string"
	                }
	            }

	  	}
	  }}});
	service.get("/validService", function (req, res) {
	    res.json(req.soajs.buildResponse(null,{test:true}));
	});
	before(function(done) {
	  controllerApp.start(function(err) {
	  	service.start(function(err) {
		    assert.ifError(err);
		    done();
	  	});
	  });
	});
	after(function(done) {
	  controllerApp.stop(function(err) {
		  service.stop(function(err) {
		    assert.ifError(err);
		    done();
		  });
	  });
	});
	it('Testing /example01',function(done){
		requester('get', {
			uri: 'http://localhost:4000/example01'
			}, function(err,body,response){
	    		assert.ifError(err);
	    		assert.equal(response.statusCode,200);
	    		assert.deepEqual(body,{"result":false,"errors":{"codes":[151],"details":[{"code":151,"message":"You are trying to reach an unknown rest service!"}]}});
	    		done();	
		});
	});
	it('Testing /example01/wrongService',function(done){
		requester('get', {
			uri: 'http://localhost:4000/example01/wrongService'
			}, function(err,body,response){
	    		assert.ifError(err);
	    		assert.equal(response.statusCode,200);
	    		assert.deepEqual(body,{"result":false,"errors":{"codes":[151],"details":[{"code":151,"message":"You are trying to reach an unknown rest service!"}]}});
	    		done();	
		});
	});
	it('Testing /example01/validService',function(done){
		requester('get', {
			uri: 'http://localhost:4000/example01/validService'
			}, function(err,body,response){
	    		assert.ifError(err);
	    		assert.equal(response.statusCode,200);
	    		assert.deepEqual(body,{"result":true,"data":{"test":true}});
	    		done();	
		});
	});
	it('Testing /example01/heartbeat',function(done){
		requester('get', {
			uri: 'http://localhost:5010/heartbeat'
			}, function(err,body,response){
	    		assert.ifError(err);
	    		assert.equal(response.statusCode,200);
	    		delete body.ts;
	    		assert.deepEqual(body,{"result":true,"service":{"service":"example01","type":"rest","route":"/heartbeat"}});
	    		done();	
		});
	});
	it('Testing /example01/reloadRegistry',function(done){
		requester('get', {
			uri: 'http://localhost:5010/reloadRegistry'
			}, function(err,body,response){
	    		assert.ifError(err);
	    		assert.equal(response.statusCode,200);
	    		assert.equal(body.result,true);
	    		assert.deepEqual(body.service,{"service":"example01","type":"rest","route":"/reloadRegistry"});
	    		assert.equal(body.data.name,'dev');
	    		done();	
		});
	});
});

describe('Testing example03 via controllerServer w/services', function() {
	var service = new soajs.server.service({
	  "serviceName" : 'example03',
	  "bodyParser": true,
	  "cookieParser": true,
	  "logger": true,
	  "inputmask": true,
	  "session": false,
	  "security": false,
	  "multitenant": false,
	  "acl": false,
	  "config": {errors:{},schema:{
	  	"/validService" : {
	            "firstName": {
	                "source": ['query.firstName'],
	                "required": false,
	                "validation": {
	                    "type": "string"
	                }
	            }
	  	}
	  }}});

	service.get("/validService", function (req, res) {
	    res.json(req.soajs.buildResponse(null,{test:true}));
	});

	before(function(done) {
	  async.series([
	  	function(cb){ controllerApp.start(cb);},
	  	function(cb){ service.start(cb); }
	  	], 
	  	function(err) {
		    assert.ifError(err);
		    setTimeout(function(){
			    done();
		    }, 1000);
	  });
	});
	after(function(done) {
	  controllerApp.stop(function(err) {
		  service.stop(function(err) {
		    assert.ifError(err);
		    done();
		  });
	  });
	});
	it('Testing /example03/validService with valid key via direct in header',function(done){
		requester('get', {
			uri: 'http://localhost:4012/validService',
			headers:{'key':'aa39b5490c4a4ed0e56d7ec1232a428f7ad78ebb7347db3fc9875cb10c2bce39bbf8aabacf9e00420afb580b15698c04ce10d659d1972ebc53e76b6bbae0c113bee1e23062800bc830e4c329ca913fefebd1f1222295cf2eb5486224044b4d0c'}
			}, function(err,body,response){
	    		assert.ifError(err);
	    		assert.equal(response.statusCode,200);
	    		assert.deepEqual(body,{"result":true,"data":{"test":true}});
	    		done();	
		});
	});
	it('Testing /example03/validService with valid key via controller in qs',function(done){
		requester('get', {
			uri: 'http://localhost:4000/example03/validService?key=aa39b5490c4a4ed0e56d7ec1232a428f7ad78ebb7347db3fc9875cb10c2bce39bbf8aabacf9e00420afb580b15698c04ce10d659d1972ebc53e76b6bbae0c113bee1e23062800bc830e4c329ca913fefebd1f1222295cf2eb5486224044b4d0c'
			}, function(err,body,response){
	    		assert.ifError(err);
	    		assert.equal(response.statusCode,200);
	    		assert.deepEqual(body,{"result":true,"data":{"test":true}});
	    		done();	
		});
	});
	it('Testing /example03/validService with bad key',function(done){
		requester('get', {
			uri: 'http://localhost:4000/example03/validService?key=invalid-key'
			}, function(err,body,response){
	    		assert.ifError(err);
	    		assert.equal(response.statusCode,200);
	    		assert.deepEqual(body,{"result":false,"errors":{"codes":[132],"details":[{"code":132,"message":"A valid key is needed to access any API."}]}});
	    		done();	
		});
	});
});

describe('Testing services w/o serviceName via controllerServer ', function() {
	var service = new soajs.server.service({
	
	  "bodyParser": true,
	  "cookieParser": true,
	  "logger": true,
	  "inputmask": true,
	  "session": false,
	  "security": false,
	  "multitenant": false,
	  "acl": false,
	  "config": {errors:{},schema:{
	  	"/validService" : {
	            "firstName": {
	                "source": ['query.firstName'],
	                "required": false,
	                "validation": {
	                    "type": "string"
	                }
	            }
	  	}
	  }}});

	service.get("/validService", function (req, res) {
	    res.json(req.soajs.buildResponse(null,{test:true}));
	});
	service.post("/validService", function (req, res) {
	    res.json(req.soajs.buildResponse(null,{test:true}));
	});
	service.all("/validService", function (req, res) {
	    res.json(req.soajs.buildResponse(null,{test:true}));
	});
	service.put("/validService", function (req, res) {
	    res.json(req.soajs.buildResponse(null,{test:true}));
	});
	service.delete("/validService", function (req, res) {
	    res.json(req.soajs.buildResponse(null,{test:true}));
	});

	before(function(done) {
	  controllerApp.start(function(err) {
	    assert.ifError(err);
	    done();
	  });
	});
	after(function(done) {
	  controllerApp.stop(function(err) {
	    assert.ifError(err);
	    done();
	  });
	});
	it('Testing starting a serivice without a servicename and a dirname',function(done){
	  	service.start(function(err) {
		    assert.equal(err.toString(),'Error: Failed starting service');
		    done();
	  	});
	});
});

