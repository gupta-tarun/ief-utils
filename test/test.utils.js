'use strict'

var sinon = require('sinon')
  , logger = require('winston')
  , assert = require('assert')
  , mockery = require('mockery')
  , lodash = require('lodash');

var HERCULES_BASE_URL = 'https://api.integrator.io';
//set enviornment as production
process.env.NODE_ENV = 'production';
//create a stub
mockery.enable({
  warnOnReplace: false
  , warnOnUnregistered: false
  , useCleanCache: true
});

var stub = sinon.stub();

mockery.registerMock('request', stub);

var utils = require('../utils.js')

var createStubResponses = function(stub, allResponses) {
  lodash.each(allResponses, function(responsefile) {
    //default opts
    var response = require('./data/' + responsefile)
    var opts = {
      uri: HERCULES_BASE_URL + '/v1/' + response.resourcetype
      , method: 'GET'
      , headers: {
        Authorization: 'Bearer TestToken'
        , 'Content-Type': 'application/json'
      }
      , json: true
    };
    if (!!response.id) {
      opts.uri = opts.uri + '/' + response.id;
      if (!!response.data) {
        opts.method = 'PUT';
        opts.json = response.data;
      }
    } else if (!!response.data) {
      opts.method = 'POST';
      opts.json = response.data;
    }
    logger.info(JSON.stringify(opts) + ' resgistered!');
    //register responseBody with the request
    if (!response.statusCode) {
      response.statusCode = 200
    }

    if(!!response.setError){
      if(!!response.failStatusCode){
        stub.withArgs(opts).yields(null, {
          statusCode: 500
        }, response.responseBody);
      }
      else{
        stub.withArgs(opts).yields(true, {
          statusCode: 200
        }, response.responseBody);
      }
    }
    else{
      stub.withArgs(opts).yields(null, {
        statusCode: response.statusCode
      }, response.responseBody);
    }
  });
};
var createStubResponsesForApiIdentifiers = function(stub, allResponses) {
  lodash.each(allResponses, function(responsefile) {
    //default opts
    var response = require('./data/' + responsefile)
    console.log('--------------------------------------\n')
    logger.info(response)
    var opts = {
      uri: HERCULES_BASE_URL + '/' + response.apiIdentifier
      , method: 'POST'
      , headers: {
        Authorization: 'Bearer TestToken'
        , 'Content-Type': 'application/json'
      }
      , json: true
    };
    if (!!response.data) {
      opts.json = response.data;
    }
    logger.info(JSON.stringify(opts) + ' resgistered!');
    //register responseBody with the request
    if (response.data && response.responseBody === 'data') {
      response.responseBody = response.data
    }

    if(!!response.setError){
      if(!!response.failStatusCode){
        stub.withArgs(opts).yields(null, {
          statusCode: 500
        }, response.responseBody);
      }
      else{
        stub.withArgs(opts).yields("error while connecting io", {
          statusCode: 200
        }, response.responseBody);
      }
    }
    else{
      stub.withArgs(opts).yields(null, {
        statusCode: 200
      }, response.responseBody);
    }

  });
};
var sandbox;
describe('VerifyDependency FUnction', function() {

  beforeEach(function() {
    console.log('beforeEach')
    sandbox = sinon.sandbox.create();
  });
  afterEach(function() {
    console.log('Clearing all strubs here...')
    sandbox.restore();
  });

  it('Should return success if there is no dependson property in records', function(done){
    var stubstoload = [
      'utils-mock-connection-netsuite.json'
    ]
    createStubResponses(stub, stubstoload)
    var records = require('./data/utils-recordsMeta-noDependson.json');
    var data = {}
    data.bearerToken = 'TestToken';
    data._integrationId = '551c7be9accca83b3e00000c';
    utils.createRecordsInOrder(records, data, function(error, success){
      if(error){
        logger.debug('Test failed : ' + JSON.stringify(error));
      }
      assert(success['connection-netsuite'].resolved, true, 'should return resolved as true')
      done();
    })
  })

  it('Should return success if there is with dependson property in records', function(done){
    var stubstoload = [
      'utils-mock-connection-netsuite.json',
      'utils-mock-export-fulfillment.json'
    ]
    createStubResponses(stub, stubstoload)
    var records = require('./data/utils-recordsMeta-withDependson.json');
    var data = {}
    data.bearerToken = 'TestToken';
    data._integrationId = '551c7be9accca83b3e00000c';
    utils.createRecordsInOrder(records, data, function(error, success){
      if(error){
        logger.debug('Test failed : ' + JSON.stringify(error));
      }
      assert(success['connection-netsuite'].resolved, true, 'should return resolved as true')
      done();
    })
  })
  //needs assertion to be added
  it('Should return false if resolved is false', function(done){
    var stubstoload = [
      'utils-mock-connection-netsuite.json',
      'utils-mock-export-fulfillment.json'
    ]
    createStubResponses(stub, stubstoload)
    var records = require('./data/utils-recordsMeta-withUnresolvedDependson.json');

    var data = {}
    data.bearerToken = 'TestToken';
    data._integrationId = '551c7be9accca83b3e00000c';
    utils.createRecordsInOrder(records, data, function(error, success){
      console.log(error)
      console.log(success)
      //assert(success['connection-netsuite'].resolved, true, 'should return resolved as true')
      done();
    })
  })

  it('Should put jsonpath as [], if jsonpath is not available', function(done){
    var stubstoload = [
      'utils-mock-connection-netsuite.json',
      'utils-mock-export-fulfillment-withoutJsonpath.json'
    ]
    createStubResponses(stub, stubstoload)
    var records = require('./data/utils-recordsMeta-withoutJsonpath.json');
    var data = {}
    data.bearerToken = 'TestToken';
    data._integrationId = '551c7be9accca83b3e00000c';
    utils.createRecordsInOrder(records, data, function(error, success){
      if(error){
        logger.debug('Test failed : ' + JSON.stringify(error));
      }
      assert.equal(!!success['export-fulfillment'].info.jsonpath, true, 'should set jsonpath as []')
      done();
    })
  })

})
