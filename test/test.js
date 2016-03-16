"use strict"
var sinon = require('sinon')
  , logger = require('winston')
  , assert = require('assert')
  , mockery = require('mockery')
  , _ = require('lodash')
  , request = require('request')
  , nock = require('nock')
  , http = require('http')
mockery.enable({
    warnOnReplace: false
    , warnOnUnregistered: false
    , useCleanCache: true
});
var HERCULES_BASE_URL = 'https://api.integrator.io'
if (process.env.NODE_ENV === 'staging') {
  HERCULES_BASE_URL = 'https://api.staging.integrator.io'
} else if (process.env.NODE_ENV === 'development') {
  //local testing of code
  HERCULES_BASE_URL = 'http://api.localhost.io:5000'
}
var utils = require('../utils.js')

describe('utils.js integratorRestClient function unit test cases', function() {
  it('should throw no auth token error', function(done) {
    utils.integratorRestClient({
      bearerToken: "",
      resourcetype: 'integrations'
    }, function(err, response, body) {
      if (err) {
        assert.equal(err.message, 'No Auth Token is given!')
        done()
      }
    })
  })
  it('should throw no resourceType error', function(done) {
    utils.integratorRestClient({
      bearerToken: 'TestToken',
      resourcetype: ''
    }, function(err, response, body) {
      if(err) {
        assert.equal(err.message, 'No resourcetype is given!')
        done()
      }
    }
  )})
  it('should use GET if no id and data is provided', function(done) {
    var api = nock(HERCULES_BASE_URL)
          .get("/v1/integrations")
          .reply(200, "GET http method has been used.");
    utils.integratorRestClient({
            bearerToken: "dkskwqyei8767876",
            resourcetype: 'integrations'
          }, function(err, response, body) {
            assert.equal(body, "GET http method has been used.")
            done()
          })
  })
  it('should use POST if no id and but data is provided', function(done) {
    var api = nock(HERCULES_BASE_URL)
          .post("/v1/integrations")
          .reply(200, "POST http method has been used.");
    utils.integratorRestClient({
            bearerToken: "dkskwqyei8767876",
            resourcetype: 'integrations',
            data: "sample Data"
          }, function(err, response, body) {
            assert.equal(body, "POST http method has been used.")
            done()
          })
  })
  it('should use PUT if id(externally) but no data is provided', function(done) {
    var api = nock(HERCULES_BASE_URL)
          .put("/v1/integrations/4389578hi8443jhj4")
          .reply(200, "PUT http method has been used.");
    utils.integratorRestClient({
            bearerToken: "dkskwqyei8767876",
            resourcetype: 'integrations',
            id: "4389578hi8443jhj4",
            data: {}
          }, function(err, response, body) {
            assert.equal(body, "PUT http method has been used.")
            done()
          })
  })
  it('should use PUT if id(internally) but no data is provided', function(done) {
    var api = nock(HERCULES_BASE_URL)
          .put("/v1/integrations/4389578hi8443jhj4")
          .reply(200, "PUT http method has been used.");
    utils.integratorRestClient({
            bearerToken: "dkskwqyei8767876",
            resourcetype: 'integrations',
            data: {"data" : "dummy data",
                   "_id" : "4389578hi8443jhj4"
                  }
          }, function(err, response, body) {
            assert.equal(body, "PUT http method has been used.")
            done()
          })
  })
  it('distributed should be added to url , with http method GET ', function(done) {
    var api = nock(HERCULES_BASE_URL)
          .get("/v1/integrations/4389578hi8443jhj4/distributed")
          .reply(200, "distributed has been added to url");
    utils.integratorRestClient({
            bearerToken: "dkskwqyei8767876",
            resourcetype: 'integrations',
            id: "4389578hi8443jhj4",
            distributed: true
          }, function(err, response, body) {
            assert.equal(body, "distributed has been added to url")
            done()
          })
  })
  it('distributed should be added to url , with http method PUT, with id provided externally', function(done) {
    var api = nock(HERCULES_BASE_URL)
          .put("/v1/integrations/4389578hi8443jhj41/distributed")
          .reply(200, "distributed has been added to url");
    utils.integratorRestClient({
            bearerToken: "dkskwqyei8767876",
            resourcetype: 'integrations',
            id: "4389578hi8443jhj41",
            distributed: true,
            data: "sample data"
          }, function(err, response, body) {
            assert.equal(body, "distributed has been added to url")
            done()
          })
  })
  it('distributed should be added to url , with http method PUT, with id provided internally', function(done) {
    var api = nock(HERCULES_BASE_URL)
          .put("/v1/integrations/4389578hi8443jhj42/distributed")
          .reply(200, "distributed has been added to url");
    utils.integratorRestClient({
            bearerToken: "dkskwqyei8767876",
            resourcetype: 'integrations',
            distributed: true,
            data: {"data" : "sample data",
                   "_id" : "4389578hi8443jhj42"}
          }, function(err, response, body) {
            assert.equal(body, "distributed has been added to url")
            done()
          })
  })
  it('distributed should be added to url , with http method POST, with no id', function(done) {
    var api = nock(HERCULES_BASE_URL)
          .post("/v1/integrations/distributed")
          .reply(200, "distributed has been added to url");
    utils.integratorRestClient({
            bearerToken: "dkskwqyei8767876",
            resourcetype: 'integrations',
            distributed: true,
            data: {"data" : "sample data"}
          }, function(err, response, body) {
            assert.equal(body, "distributed has been added to url")
            done()
          })
  })
  it('should return incorrect response error!', function(done) {

    var api = nock(HERCULES_BASE_URL)
          .get("/v1/integrations")
          .reply(401, "Hello World");

    utils.integratorRestClient({
      bearerToken: "dkskwqyei8767876",
      resourcetype: 'integrations'
    }, function(err, response, body) {
      if (err) {
        assert.equal(err.message, 'Unable to verify response')
        done()
      }
    })
  })
  it('should not return incorrect response error!', function(done) {
    var api = nock(HERCULES_BASE_URL)
          .get("/v1/integrations")
          .reply(201, "Hello World");

    utils.integratorRestClient({
      bearerToken: "dkskwqyei8767876",
      resourcetype: 'integrations'
    }, function(err, response, body) {
      if (err) {
        if(err.message !== 'Unable to verify response')
        done()
      }
      else {
        done()
      }
    })
   })
})
describe('integratorApiIdentifierClient function unit test cases!', function() {
  beforeEach(function() {
  })
  afterEach(function() {
  })
  it('should throw no auth token error', function(done) {
    utils.integratorApiIdentifierClient({
      bearerToken: "",
      apiIdentifier: 'brv75984365865'
    }, function(err, response, body) {
      if (err) {
        assert.equal(err.message, 'No Auth Token was provided!')
        done()
      }
    })
  })
  it('should throw no apiIdentifier error', function(done) {
    utils.integratorApiIdentifierClient({
      bearerToken: "kdjfk85748kjkjfjk84n",
      apiIdentifier: ""
    }, function(err, response, body) {
      if (err) {
        assert.equal(err.message, 'No apiIdentifier was provided!')
        done()
      }
    })
  })
  it('should return incorrect response error.', function(done) {
    var api = nock(HERCULES_BASE_URL)
          .post("/brv75984365865")
          .reply(401, "POST http method has been used.");
    utils.integratorApiIdentifierClient({
      bearerToken: "dhkjsh876jhr3894kj8",
      apiIdentifier: 'brv75984365865',
      data: {"field1": "value1"}
    }, function(err, response, body) {
        assert.equal(err.message, 'Unable to verify response', 'Incorrect response from server was the expected result, but that does seem like case here')
        done()
    })
  })
})
describe('createRecordsInOrder function unit test cases!', function() {
  it('loadJSON has been called once', function(done) {
    var metaData = require('../testData/allrecordsmeta.json')
    try {
    utils.createRecordsInOrder(metaData, { bearerToken : 'jshdkjsdh7567djd68b'}, function(error, success) {

    }) }catch(e) {
      assert.equal(e.code, "MODULE_NOT_FOUND")
      done()
    }
  })
  it('should return true since all dependencies are marked resolved', function(done) {
    var metaData = require('../testData/allrecordsmeta.json')
    _.each(metaData, function(record) {
      record.resolved = true,
      record.isLoaded = true
    })
    utils.createRecordsInOrder(metaData, { bearerToken : 'jshdkjsdh7567djd68b'}, function(error, success) {
    assert.equal(error, null)
    done()
    })
  })
  it('should throw cyclic dependency error!', function(done) {
    var circularJson = require('../testData/allRecordsMetaDataCircular.json')
    utils.createRecordsInOrder(circularJson, null, function(error, succss) {
      if(error) {
        assert.equal(error.message, 'The recordsArray has cyclic refreneces')
        done()
      }
    })
  })
  it('should throw no location error !', function(done) {
    var noLocationJson = require('../testData/allRecordsMetaDataNoLocation.json')
    utils.createRecordsInOrder(noLocationJson, null, function(error, success) {
      if(error) {
        var index = (error.message).search('Config Error: no filelocation given in record : ');
        assert.notEqual(index, -1)
        done()
      }
    })
  })
})
 describe('loadJSON function test cases!', function() {
  it('should throw MODULE_NOT_FOUND error', function(done) {
    try {
      utils.loadJSON('../testData/allrecordsmeta.json')
    } catch (e) {
    assert.equal(e.code, "MODULE_NOT_FOUND")
    done()
   }
  })
  //TODO: need to do proper mocking for require statement
  it.skip('should not throw MODULE_NOT_FOUND error if already loaded', function(done) {
    console.log(require.cache[require.resolve('../testData/allrecordsmeta.json')])
    if(utils.loadJSON('../testData/allrecordsmeta.json') !== undefined)
    done()
  })
})
describe('makeAsyncCalls function unit test cases.', function(){
  it('if make async calls has been called', function(done){
    var api = nock(HERCULES_BASE_URL)
          .post("/jhdjhs7dh67db6")
          .reply(402, "POST http method has been used.");
    var metaData = require('../testData/allrecordsmeta.json')
    _.each(metaData, function(record) {
      record.isLoaded = true,
      record.resolved = false,
      record.info = {"apiIdentifier" : true},
      record.info.data = { "apiIdentifier" : "jhdjhs7dh67db6",
                           "bearerToken" : "jshdkjsdh7567djd68b"},
      record.info.bearerToken = "jshdkjsdh7567djd68b"
    })

    utils.createRecordsInOrder(metaData, { bearerToken : 'jshdkjsdh7567djd68b'}, function(error, success) {
      if(error) {
        console.log(error)
        assert.equal(error.message, 'Unable to verify response')
        done()
      } else {
        console.log('no error!')
      }
    })
  })

  it('second block in makeAsyncCalls(integratorRestClient call)', function(done){
    var api = nock(HERCULES_BASE_URL)
          .get("/v1/connections")
          .reply(402, "Hello World");
   var metaData = require('../testData/allrecordsmeta.json')
   _.each(metaData, function(record) {
     record.isLoaded = true,
     record.resolved = false,
     record.info = {"resourcetype" : "connections",
                    "bearerToken": "dkskwqyei8767876"}
   })
    utils.createRecordsInOrder(metaData, { bearerToken : 'dkskwqyei8767876'}, function(error, success) {
      if(error) {
        console.log(error)
        assert.equal(error.message, 'Unable to verify response')
        done()
      } else {
        console.log('no error!')
      }
    })
  })
  it('should call makeAsyncCalls at the end.', function(done) {
    var metaData = require('../testData/allRecordsMetaData.json')
    var api = nock(HERCULES_BASE_URL)
          .post("/v1/connections")
          .reply(201, "First Time POST");
    var api = nock(HERCULES_BASE_URL)
                .post("/v1/exports")
                .reply(201, "Second Time POST");
    _.each(metaData, function(record) {
      if(record.name === "connection-shopify")
      {
        record.isLoaded = true,
        record.resolved = false,
        record.info = {"resourcetype" : "connections",
                       "bearerToken": "dhskdh7djsd57dn",
                       "data": {"f1" : "v1"}}
      } else {
        record.isLoaded = true,
        record.resolved = false,
        record.info = {"resourcetype" : "exports",
                       "bearerToken": "dkskwqyei8767876",
                       "data": {"f2": "v2"}}
      }
    })
    utils.createRecordsInOrder(metaData, {}, function(error, success) {
    assert.equal((metaData["connection-shopify"].resolved), true, 'value of resolved for connection-shopify record was supposed to be true , but is is not.')
    assert.equal((metaData["export-order"].resolved), true, 'value of resolved for export-order record was supposed to be true , but is is not.')
    done()
    })
  })
    it('should use GET http method(as it provided inside info block) and delete data inside info', function(done) {
      var metaData = require('../testData/allRecordsMetaDataSingleRecord.json')
      var api = nock(HERCULES_BASE_URL)
            .get("/v1/connections/vjsdsd8sjdhj9sdj8")
            .reply(401, "GET http method has been used.")

      _.each(metaData, function(record) {
        if(record.name === "connection-shopify")
        {
          record.isLoaded = true,
          record.resolved = false,
          record.info = {"method": "GET",
                         "resourcetype" : "connections",
                         "bearerToken": "dhskdh7djsd57dn",
                         "data": {"_id" : "vjsdsd8sjdhj9sdj8"}}
        }
      })
      utils.createRecordsInOrder(metaData, {}, function(error, success) {
      assert.equal(error.message, 'Unable to verify response', 'is supposed to use GET http method using id provided inside info block, but seems like that is not the case here.')
      done()
   })
 })
})
