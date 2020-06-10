'use strict';

const async = require('async');

const coreModules = require("soajs.core.modules");
const core = coreModules.core;
const provision = coreModules.provision;
const lib = require("soajs.core.libs");

const express = require("express");

const registryModule = require("./../modules/registry");

let struct_jobs = {};

let autoRegHost = process.env.SOAJS_SRV_AUTOREGISTERHOST || true;
if (autoRegHost && typeof(autoRegHost) !== 'boolean') {
	autoRegHost = (autoRegHost === 'true');
}

let manualdeploy = !!process.env.SOAJS_DEPLOY_MANUAL;

function extractJOBsList(schema) {
	let jobList = {};
	for (let job in schema) {
		if (Object.hasOwnProperty.call(schema, job)) {
			let oneJob = {
				'l': schema[job].l
			};
			
			if (schema[job].group) {
				oneJob.group = schema[job].group;
			}
			
			if (schema[job].groupMain) {
				oneJob.groupMain = schema[job].groupMain;
			}
			jobList[job] = oneJob;
		}
	}
	return jobList;
}

/**
 *
 * @param param {}
 */
function Daemon(param) {
	let _self = this;
	
	//NOTE: added this to trigger a warning if someone is still using old style configuration
	if (!param) {
		param = {"oldStyleConfiguration": false};
	}
	if (param && param.config && param.config.serviceName) {
		param.oldStyleConfiguration = true;
		for (let configParam in param.config) {
			if (Object.hasOwnProperty.call(param.config, configParam)) {
				param[configParam] = param.config[configParam];
			}
		}
		delete param.config;
	}
	
	param.mw = manualdeploy;
	_self.soajs = {};
	_self.soajs.param = param;
	_self.daemonStats = {
		"step": "initialize",
		"jobs": {}
	};
	_self.daemonTimeout = null;
	_self.appMaintenance = express();
}

Daemon.prototype.init = function (callback) {
	let _self = this;
	let registry = null;
	
	_self.soajs.param.type = _self.soajs.param.type.toLowerCase();
	
	_self.soajs.param.serviceName = _self.soajs.param.serviceName.toLowerCase();
	_self.soajs.param.serviceGroup = _self.soajs.param.serviceGroup || "No Group Daemon";
	_self.soajs.param.serviceVersion = "" + (_self.soajs.param.serviceVersion || 1);
	
	if (!lib.version.validate(_self.soajs.param.serviceVersion)) {
		throw new Error('Daemon version must be of format [1.1] : [' + _self.soajs.param.serviceVersion + ']');
	}
	_self.soajs.param.servicePort = _self.soajs.param.servicePort || null;
	_self.soajs.param.serviceIp = process.env.SOAJS_SRVIP || null;
	_self.soajs.param.serviceHATask = null;
	
	let fetchedHostIp = null;
	let serviceIpNotDetected = false;
	if (!autoRegHost && !process.env.SOAJS_DEPLOY_HA) {
		_self.soajs.param.serviceIp = '127.0.0.1';
	}
	if (!_self.soajs.param.serviceIp && !process.env.SOAJS_DEPLOY_HA) {
		core.getHostIp(function (err, getHostIpResponse) {
			fetchedHostIp = getHostIpResponse;
			if (fetchedHostIp && fetchedHostIp.result) {
				_self.soajs.param.serviceIp = fetchedHostIp.ip;
				if (fetchedHostIp.extra && fetchedHostIp.extra.swarmTask) {
					_self.soajs.param.serviceHATask = fetchedHostIp.extra.swarmTask;
				}
			} else {
				serviceIpNotDetected = true;
				_self.soajs.param.serviceIp = "127.0.0.1";
			}
			resume();
		});
	} else {
		resume();
	}
	
	function resume() {
		_self.soajs.jobList = extractJOBsList(_self.soajs.param.schema);
		registryModule.load({
			"type": _self.soajs.param.type,
			"name": _self.soajs.param.serviceName,
			"group": _self.soajs.param.serviceGroup,
			"port": _self.soajs.param.servicePort,
			"version": _self.soajs.param.serviceVersion
		}, function (reg) {
			registry = reg;
			_self.soajs.daemonServiceConf = lib.registry.getDaemonServiceConf(_self.soajs.param.serviceName, registry);
			
			_self.soajs.log = core.getLogger(_self.soajs.param.serviceName, registry.serviceConfig.logger);
			if (_self.soajs.param.oldStyleConfiguration) {
				_self.soajs.log.warn("Old style configuration detected. Please start using the new way of passing param when creating a new daemon service.");
			}
			_self.soajs.log.info("Registry has been loaded successfully from environment: " + registry.environment);
			
			if (fetchedHostIp) {
				if (!fetchedHostIp.result) {
					_self.soajs.log.warn("Unable to find the daemon service host ip. The daemon service will NOT be registered for awareness.");
					_self.soajs.log.info("IPs found: ", fetchedHostIp.extra.ips);
					if (serviceIpNotDetected) {
						_self.soajs.log.warn("The default daemon service IP has been used [" + _self.soajs.param.serviceIp + "]");
					}
				} else {
					_self.soajs.log.info("The IP registered for daemon service [" + _self.soajs.param.serviceName + "] awareness : ", fetchedHostIp.ip);
				}
			}
			
			if (!_self.soajs.param.serviceName || !_self.soajs.daemonServiceConf) {
				if (!_self.soajs.param.serviceName) {
					_self.soajs.log.error('Daemon Service failed to start, serviceName is empty [' + _self.soajs.param.serviceName + ']');
				} else {
					_self.soajs.log.error('Daemon Service [' + _self.soajs.param.serviceName + '] failed to start. Unable to find the daemon service entry in registry');
				}
				return callback(new Error("Daemon Service shutdown due to failure!"));
			}
			// Registry now is loaded and all param are assured
			
			_self.soajs.log.info("Daemon Service middleware initialization started...");
			
			//This object will hold all the middleware needed by the daemon
			_self.soajs.mw = {};
			
			//Expose some core function after init
			_self.getCustomRegistry = function () {
				return registryModule.getCustom();
			};
			
			//exposing provision functionality to generate keys
			_self.provision = {
				"init": provision.init,
				"generateInternalKey": provision.generateInternalKey,
				"generateExtKey": provision.generateExtKey
			};
			
			callback();
		});
	}
};

/**
 *
 */
Daemon.prototype.start = function (cb) {
	let _self = this;
	
	let resume = function (err) {
		if (cb && typeof cb === "function") {
			cb(err);
		} else if (err) {
			throw err;
		}
	};
	
	if (_self.soajs) {
		_self.soajs.log.info("Daemon Service about to start ...");
		
		let registry = registryModule.get();
		_self.soajs.log.info("Loading Daemon Service Provision ...");
		provision.init(registry.coreDB.provision, _self.soajs.log);
		provision.loadProvision(function (loaded) {
			let maintenancePort = _self.soajs.param.servicePort;
			if (loaded) {
				_self.soajs.log.info("Daemon Service provision loaded.");
				_self.soajs.log.info("Starting Daemon Service ...");
				
				//MAINTENANCE Service Routes
				_self.soajs.log.info("Adding Daemon Service Maintenance Routes ...");
				
				//calculate the maintenance port value
				maintenancePort = _self.soajs.daemonServiceConf.info.port + _self.soajs.daemonServiceConf._conf.ports.maintenanceInc;
				if (!process.env.SOAJS_DEPLOY_HA) {
					if (process.env.SOAJS_SRVPORT) {
						let envPort = parseInt(process.env.SOAJS_SRVPORT);
						if (isNaN(envPort)) {
							throw new Error("Invalid port value detected in SOAJS_SRVPORT environment variable, port value is not a number!");
						}
						maintenancePort = envPort + _self.soajs.daemonServiceConf._conf.ports.maintenanceInc;
					} else if (process.env.SOAJS_ENV && process.env.SOAJS_ENV.toUpperCase() !== 'DASHBOARD') {
						maintenancePort += _self.soajs.daemonServiceConf._conf.ports.controller;
					}
				}
				
				//We only want to log once the error message while executing th daemon so we do not jam the logging system
				let execErrorMsgMainOn = true;
				let execErrorMsgSubOn = true;
				
				let defaultInterval = 1800000; //30 minutes
				/*
				let daemonConf_tpl = {
					"daemonConfigGroup": "group1", //group name
					"daemon": "order", //daemon name
					"status": 1, //1=on, 0=off
					"processing": "sequential", //sequential, parallel
					"order": [ //run the jobs in specific order
						"hello"
					],
					"solo": true,
					"interval": 5000, //30 minutes
					"type": "interval", //interval, cron
					"cronConfig": {
						"cronTime": '00 30 11 * * 1-5', //can also be a specific date. new Date()
						"timeZone": 'America/Los_Angeles' //https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
					},
					"jobs": {
						"hello": {
							"type": "global", // "tenant" || "global"
							"serviceConfig": {"mike": "testing"}, //if global
							"tenantExtKeys": [] //if tenant
						}
					}
				};
				*/
				
				let executeDaemon = function () {
					_self.daemonStats.step = "waiting";
					if (_self.daemonConf.status && _self.daemonConf.jobs) {
						execErrorMsgMainOn = true;
						//Set daemon stats object for stats maintenance route
						_self.daemonStats.daemonConfigGroup = _self.daemonConf.daemonConfigGroup;
						_self.daemonStats.Daemon = _self.daemonConf.daemon;
						_self.daemonStats.status = _self.daemonConf.status;
						//_self.daemonStats.interval = _self.daemonConf.interval;
						_self.daemonStats.ts = new Date().getTime();
						_self.daemonStats.step = "fetching";
						
						//build the jobs array
						let jobs_array = [];
						let buildJob = function (jobInfoObj, _job) {
							let jobObj = {};
							if (jobInfoObj.type === "global") {
								jobObj = {
									"soajs": {
										"meta": core.meta,
										"servicesConfig": jobInfoObj.serviceConfig
									},
									"job": _job,
									"thread": "global"
								};
								jobs_array.push(jobObj);
							} else if (jobInfoObj.tenantExtKeys) { //type === "tenant"
								for (let tCount = 0; tCount < jobInfoObj.tenantExtKeys.length; tCount++) {
									jobObj = {
										"soajs": {
											"meta": core.meta
										},
										"job": _job
									};
									let tExtKey = jobInfoObj.tenantExtKeys[tCount];
									jobObj.thread = tExtKey;
									provision.getExternalKeyData(tExtKey, _self.soajs.daemonServiceConf._conf.key, function (err, keyObj) {
										if (keyObj && keyObj.application && keyObj.application.package) {
											provision.getPackageData(keyObj.application.package, function (err, packObj) {
												if (packObj) {
													jobObj.soajs.tenant = keyObj.tenant;
													jobObj.soajs.tenant.key = {
														"iKey": keyObj.key,
														"eKey": keyObj.extKey
													};
													jobObj.soajs.tenant.application = keyObj.application;
													jobObj.soajs.tenant.application.package_acl = packObj.acl;
													jobObj.soajs.servicesConfig = keyObj.config;
													jobs_array.push(jobObj);
												}
											});
										}
									});
								}
							}
						};
						if (_self.daemonConf.processing && _self.daemonConf.processing === "sequential") {
							if (_self.daemonConf.order && Array.isArray(_self.daemonConf.order)) {
								for (let i = 0; i < _self.daemonConf.order.length; i++) {
									if (_self.daemonConf.jobs[_self.daemonConf.order[i]]) {
										buildJob(_self.daemonConf.jobs[_self.daemonConf.order[i]], _self.daemonConf.order[i]);
									}
								}
							}
						} else {
							for (let job in _self.daemonConf.jobs) {
								if ((Object.hasOwnProperty.call(_self.daemonConf.jobs, job)) && struct_jobs[job]) {
									buildJob(_self.daemonConf.jobs[job], job);
								}
							}
						}
						
						//execute the jobs array
						if (jobs_array.length > 0) {
							execErrorMsgSubOn = true;
							_self.daemonStats.step = "executing";
							let asyncEndFn = function (err) {
								if (err) {
									_self.soajs.log.warn('Unable to complete daemon execution: ' + err);
								}
								_self.daemonStats.step = "waiting";
								
								if (_self.daemonConf.type === "interval") {
									_self.daemonTimeout = setTimeout(executeDaemon, _self.daemonConf.interval);
								}
								if (_self.postExecutingFn && typeof  _self.postExecutingFn === "function") {
									_self.postExecutingFn();
									_self.postExecutingFn = null;
								}
							};
							let asyncIteratorFn = function (jobThread, callback) {
								let threadStartTs = new Date().getTime();
								
								let afterMWLoaded = function () {
									struct_jobs[jobThread.job](jobThread.soajs, function (err) {
										if (err) {
											callback(err);
										} else {
											let threadEndTs = new Date().getTime();
											if (!_self.daemonStats.jobs[jobThread.job]) {
												_self.daemonStats.jobs[jobThread.job] = {};
											}
											_self.daemonStats.jobs[jobThread.job].ts = threadStartTs;
											if (_self.daemonStats.jobs[jobThread.job].fastest) {
												if (_self.daemonStats.jobs[jobThread.job].fastest > (threadEndTs - threadStartTs)) {
													_self.daemonStats.jobs[jobThread.job].fastest = threadEndTs - threadStartTs;
												}
											} else {
												_self.daemonStats.jobs[jobThread.job].fastest = threadEndTs - threadStartTs;
											}
											if (_self.daemonStats.jobs[jobThread.job].slowest) {
												if (_self.daemonStats.jobs[jobThread.job].slowest < (threadEndTs - threadStartTs)) {
													_self.daemonStats.jobs[jobThread.job].slowest = threadEndTs - threadStartTs;
												}
											} else {
												_self.daemonStats.jobs[jobThread.job].slowest = threadEndTs - threadStartTs;
											}
											callback();
										}
									});
								};
								
								//Build soajs object to be passed to all the registered jobs
								jobThread.soajs.registry = registryModule.get();
								jobThread.soajs.log = _self.soajs.log;
								
								afterMWLoaded();
							};
							
							if (_self.daemonConf.processing && _self.daemonConf.processing === "sequential") {
								async.eachSeries(jobs_array, asyncIteratorFn, asyncEndFn);
							} else {
								async.each(jobs_array, asyncIteratorFn, asyncEndFn);
							}
						} else {
							_self.daemonStats.step = "waiting";
							if (execErrorMsgSubOn) {
								_self.soajs.log.info('Jobs stack is empty for daemon [' + _self.daemonConf.daemon + '] and group [' + _self.daemonConf.daemonConfigGroup + ']');
							}
							execErrorMsgSubOn = false;
							if (_self.daemonConf.type === "interval") {
								_self.daemonTimeout = setTimeout(executeDaemon, _self.daemonConf.interval);
							}
						}
					} else {
						_self.daemonStats.step = "waiting";
						if (execErrorMsgMainOn) {
							execErrorMsgMainOn = false;
							if (!_self.daemonConf.status) {
								_self.soajs.log.info('Daemon is OFF for daemon [' + _self.daemonConf.daemon + '] and group [' + _self.daemonConf.daemonConfigGroup + ']');
							}
							if (!_self.daemonConf.jobs) {
								_self.soajs.log.info('Jobs stack is empty for daemon [' + _self.daemonConf.daemon + '] and group [' + _self.daemonConf.daemonConfigGroup + ']');
							}
						}
						if (_self.daemonConf.type === "interval") {
							_self.daemonTimeout = setTimeout(executeDaemon, _self.daemonConf.interval);
						}
					}
				};
				
				let configureDaemon = function () {
					_self.daemonConf.type = _self.daemonConf.type || "interval";
					if (_self.daemonConf.type === "cron") {
						if (_self.daemonConf.cronConfig) {
							try {
								let cronJob = require('cron').CronJob;
								_self.daemonCronJob = new cronJob({
									"cronTime": _self.daemonConf.cronConfig.cronTime,
									"onTick": executeDaemon,
									"start": false,
									"timeZone": _self.daemonConf.cronConfig.timeZone || null
								});
								_self.daemonCronJob.start();
							} catch (ex) {
								_self.soajs.log.error('Cron configuration is not valid for daemon [' + _self.daemonConf.daemon + '] and group [' + _self.daemonConf.daemonConfigGroup + ']');
								_self.soajs.log.error('Daemon [' + _self.daemonConf.daemon + '] failed to setup and will not start.');
							}
						} else {
							_self.soajs.log.error('Cron configuration is not valid for daemon [' + _self.daemonConf.daemon + '] and group [' + _self.daemonConf.daemonConfigGroup + ']');
							_self.soajs.log.error('Daemon [' + _self.daemonConf.daemon + '] failed to setup and will not start.');
						}
					} else { // it is interval
						// Param assurance
						if (_self.daemonConf.interval) {
							_self.daemonConf.interval = parseInt(_self.daemonConf.interval);
							if (isNaN(_self.daemonConf.interval)) {
								_self.soajs.log.warn('Interval is not an integer for daemon [' + _self.daemonConf.daemon + '] and group [' + _self.daemonConf.daemonConfigGroup + '].');
								_self.daemonConf.interval = defaultInterval;
								_self.soajs.log.warn('The default interval [' + defaultInterval + '] will be used.');
							}
						} else {
							_self.daemonConf.interval = defaultInterval;
							_self.soajs.log.warn('The default interval [' + defaultInterval + '] will be used.');
						}
						executeDaemon();
						//_self.daemonTimeout = setTimeout(executeDaemon, _self.daemonConf.interval);
					}
				};
				
				let setupDaemon = function () {
					if (_self.daemonConf) {
						if (_self.daemonStats.step === "executing") {
							//wait then configure
							_self.postExecutingFn = function () {
								if (_self.daemonCronJob) {
									_self.daemonCronJob.stop();
								}
								if (_self.daemonTimeout) {
									clearTimeout(_self.daemonTimeout);
								}
								configureDaemon();
							};
						} else if (_self.daemonStats.step === "waiting" || _self.daemonStats.step === "fetching") {
							//stop any daemon scheduled task
							if (_self.daemonCronJob) {
								_self.daemonCronJob.stop();
							}
							if (_self.daemonTimeout) {
								clearTimeout(_self.daemonTimeout);
							}
							configureDaemon();
						} else { //initialize
							configureDaemon();
						}
					} else {
						_self.soajs.log.error('daemonConf is not valid for daemon [' + _self.soajs.param.serviceName + '] and group [' + process.env.SOAJS_DAEMON_GRP_CONF + ']');
						_self.soajs.log.error('Daemon [' + _self.soajs.param.serviceName + '] failed to setup and will not start.');
					}
				};
				
				let maintenanceResponse = function (req, route) {
					let response = {
						'result': false,
						'ts': Date.now(),
						'service': {
							'service': _self.soajs.param.serviceName.toUpperCase(),
							'type': 'daemon',
							'route': route || req.path
						}
					};
					return response;
				};
				_self.appMaintenance.get("/heartbeat", function (req, res) {
					let response = maintenanceResponse(req);
					response.result = true;
					res.jsonp(response);
				});
				_self.appMaintenance.get("/reloadRegistry", function (req, res) {
					registryModule.reload({
						"type": _self.soajs.param.type,
						"name": _self.soajs.param.serviceName,
						"group": _self.soajs.param.serviceGroup,
						"port": _self.soajs.param.servicePort,
						"version": _self.soajs.param.serviceVersion
					}, function (err, reg) {
						if (err) {
							_self.soajs.log.warn("Failed to load registry. reusing from previous load. Reason: " + err.message);
						}
						let response = maintenanceResponse(req);
						response.result = true;
						response.data = reg;
						res.jsonp(response);
						
					});
				});
				_self.appMaintenance.get("/loadProvision", function (req, res) {
					provision.loadProvision(function (loaded) {
						let response = maintenanceResponse(req);
						response.result = loaded;
						res.jsonp(response);
					});
				});
				_self.appMaintenance.get("/daemonStats", function (req, res) {
					let response = maintenanceResponse(req);
					response.result = true;
					response.data = _self.daemonStats;
					res.jsonp(response);
				});
				_self.appMaintenance.get("/reloadDaemonConf", function (req, res) {
					let response = maintenanceResponse(req);
					provision.loadDaemonGrpConf(process.env.SOAJS_DAEMON_GRP_CONF, _self.soajs.param.serviceName, function (err, daemonConf) {
						if (daemonConf) {
							_self.daemonConf = daemonConf;
							setupDaemon();
							response.result = true;
						} else {
							response.result = false;
							if (err) {
								_self.soajs.log.warn("Failed to load daemon config for [" + _self.soajs.param.serviceName + "@" + process.env.SOAJS_DAEMON_GRP_CONF + "]. reusing from previous load. Reason: " + err.message);
							}
						}
						response.data = _self.daemonConf;
						res.jsonp(response);
					});
				});
				_self.appMaintenance.all('*', function (req, res) {
					let response = maintenanceResponse(req, "heartbeat");
					response.result = true;
					res.jsonp(response);
				});
				_self.appMaintenance.httpServer = _self.appMaintenance.listen(maintenancePort, function (err) {
					if (err) {
						_self.soajs.log.error(err.message);
					}
					_self.soajs.log.info(_self.soajs.param.serviceName + " daemon service maintenance is listening on port: " + maintenancePort);
				});
				
				if (!process.env.SOAJS_DAEMON_GRP_CONF) {
					_self.soajs.log.error('Environment variable [SOAJS_DAEMON_GRP_CONF] for daemon [' + _self.soajs.param.serviceName + '] is not set.');
				} else {
					provision.loadDaemonGrpConf(process.env.SOAJS_DAEMON_GRP_CONF, _self.soajs.param.serviceName, function (err, daemonConf) {
						_self.daemonConf = daemonConf;
						setupDaemon();
					});
				}
			}
			if (autoRegHost && !process.env.SOAJS_DEPLOY_HA) {
				_self.soajs.log.info("Initiating service auto register for awareness ...");
				registryModule.autoRegisterService({
					"name": _self.soajs.param.serviceName,
					"description": _self.soajs.param.description,
					"type": _self.soajs.param.type,
					"subType": _self.soajs.param.subType,
					"group": _self.soajs.param.serviceGroup,
					"port": _self.soajs.param.servicePort,
					"portHost": maintenancePort,
					"ip": _self.soajs.param.serviceIp,
					"version": _self.soajs.param.serviceVersion,
					
					"jobList": _self.soajs.jobList,
					"maintenance": _self.soajs.param.maintenance,
					
					"mw": _self.soajs.param.mw || false,
					"serviceHATask": _self.soajs.param.serviceHATask
				}, function (err, registered) {
					if (err) {
						_self.soajs.log.warn('Unable to trigger autoRegisterService awareness for controllers: ' + err);
					} else if (registered) {
						_self.soajs.log.info('The autoRegisterService @ controllers for [' + _self.soajs.param.serviceName + '@' + _self.soajs.param.serviceIp + '] successfully finished.');
					}
				});
			} else {
				_self.soajs.log.info("Service auto register for awareness, skipped.");
			}
			return resume();
		});
	} else {
		return resume(new Error('Failed starting daemon service'));
	}
};

Daemon.prototype.stop = function (cb) {
	let _self = this;
	_self.soajs.log.info('stopping daemon service[' + _self.soajs.param.serviceName + '] on port:', _self.soajs.daemonServiceConf.info.port);
	if (_self.daemonTimeout) {
		clearTimeout(_self.daemonTimeout);
	}
	if (_self.daemonCronJob) {
		_self.daemonCronJob.stop();
	}
	_self.appMaintenance.httpServer.close(function (err) {
		if (cb) {
			cb(err);
		}
	});
};

/**
 *
 */
Daemon.prototype.job = function (jobName, cb) {
	let _self = this;
	if (struct_jobs[jobName]) {
		_self.soajs.log.warn("Job [" + jobName + "] already exist, overwriting its callback");
	}
	if (cb && typeof cb === "function") {
		struct_jobs[jobName] = cb;
	} else {
		_self.soajs.log.warn("Failed to registry job [" + jobName + "]. the second argument of daemon.job must be a function.");
	}
};

module.exports = Daemon;