/*jslint nomen: true*/
/*global _ */

var _ = require('lodash')
  , async = require('async')
  , jsonPath = require('JSONPath')
  , request = require('request')
  , logger = require('winston')
  , handlebars = require('handlebars');
  //logger.level = 'error'
var HERCULES_BASE_URL = 'https://api.integrator.io';
if (process.env.NODE_ENV === 'staging') {
  HERCULES_BASE_URL = 'https://api.staging.integrator.io'
} else if (process.env.NODE_ENV === 'development') {
  //local testing of code
  HERCULES_BASE_URL = 'http://api.localhost.io:5000'
}

  var createRecordsInOrder = function(recordarray, options, callback) {
    //the record should Directed Acyclic Graph
    if(!!options && (!!options.upgradeMode || !!options.connectorEdition)){
      //TODO: add a function to validate edition of nodes to be compatible with editions of dependent nodes
      trimNodesBasedOnEdition(recordarray, options)
    }
    if (!verifyACircular(recordarray)) {
      return callback(new Error('The recordsArray has cyclic refreneces'));
    };
    //load all json data from filesystem into info variable
    var temprecord;
    for (temprecord in recordarray) {
      //for each record load file from fs into variable info
      if (!(recordarray[temprecord].filelocation || recordarray[temprecord].isLoaded)) {
        return callback(new Error(
          'Config Error: no filelocation given in record : ' + temprecord));
      }
      if (!recordarray[temprecord].isLoaded) {
        recordarray[temprecord].info = loadJSON(recordarray[temprecord].filelocation)
          //add bearer token in info node
        recordarray[temprecord].info.bearerToken = options.bearerToken;
        //if it is already resolved directly load in response
        if (recordarray[temprecord].resolved) {
          recordarray[temprecord].info.response = loadJSON(recordarray[temprecord].filelocation)
        }
      }
    }
    //while every dependency is not resolved
    makeAsyncCalls(recordarray, callback);
  }
  /**
   *   signature :
   *   options [{bearerToken, resourcetype, id, data}]
   *   callback
   */
  , integratorRestClient = function(options, callback) {
    if (!options.resourcetype) {
      logInSplunk('No resourcetype is given!');
      return callback(new Error('No resourcetype is given!'));
    }
    if (!options.bearerToken) {
      logInSplunk('No Auth Token is given!');
      return callback(new Error('No Auth Token is given!'));
    }
    var opts = {
      uri: HERCULES_BASE_URL + '/v1/' + options.resourcetype
      , method: 'GET'
      , headers: {
        Authorization: 'Bearer ' + options.bearerToken
        , 'Content-Type': 'application/json'
      }
      , json: true
    };

    if (!!options.id) {
      opts.uri = opts.uri + '/' + options.id;
      if (!!options.data) {
        opts.method = 'PUT';
        opts.json = options.data;
      }
      if (!!options.distributed) {
        opts.uri = opts.uri + '/distributed'
      }
    } else if (!!options.data) {
      opts.method = 'POST';
      opts.json = options.data;
      //if data cotains _id that means it is a put call
      if (options.data._id) {
        //remove the _id from data
        opts.uri = opts.uri + '/' + options.data._id;
        opts.method = 'PUT';
      }
      if (!!options.distributed) {
        opts.uri = opts.uri + '/distributed'
      }
    }
    logInSplunk('REST call : method|' + opts.method + ', uri|' + opts.uri);
    logInSplunk('REST call : json |' + JSON.stringify(opts.json));
    request(opts, function(error, res, body) {
      if (error) {
        return callback(new Error('Error while connecting to Integrator.io'));
      }
      if (!verifyResponse(res)) {
        return callback(new Error('Unable to verify response'));
      }
      //this means success
      return callback(null, res, body);
    });
  }
  , integratorApiIdentifierClient = function(options, callback) {
    if (!options.bearerToken) {
      logInSplunk('No Auth Token was provided!');
      return callback(new Error('No Auth Token was provided!'));
    }
    if (!options.apiIdentifier) {
      logInSplunk('No apiIdentifier was provided!');
      return callback(new Error('No apiIdentifier was provided!'))
    }

    var opts = {
      uri: HERCULES_BASE_URL + '/' + options.apiIdentifier
      , method: 'POST'
      , headers: {
        Authorization: 'Bearer ' + options.bearerToken
        , 'Content-Type': 'application/json'
      }
      , json: true
    };

    if (!!options.data) {
      opts.json = options.data;
    }
    //logInSplunk('call API: \n' + JSON.stringify(opts));
    request(opts, function(error, res, body) {
      if (error) {
        return callback(new Error('Error while connecting to Integrator.io'));
      }
      if (!verifyResponse(res)) {
        return callback(new Error('Unable to verify response'));
      }
      //this means success
      return callback(null, res, body);
    });
  }
  /**
   *   signature :
   *   options [{bearerToken, connectionId, method, scriptId, deployId, relativeURI}]
   *   callback
   */
  , integratorProxyCall = function(options, callback) {
    if (!options.bearerToken) {
      logInSplunk('No Auth Token is given!');
      return callback(new Error('No Auth Token is given!'));
    }
    if(!options.connectionId){
      logInSplunk('Connection id is not given');
      return callback(new Error('connection id is not given'));
    }
    var opts = {
      uri: HERCULES_BASE_URL + '/v1/connections/' + options.connectionId + '/proxy'
      , method: 'POST'
      , headers: {
        Authorization: 'Bearer ' + options.bearerToken
        , 'Content-Type': 'application/json'
      }
      , json: true
    };
    //Netsuite Restlet call
    if(!!options.scriptId && !!options.deployId && !!options.method){
      opts.headers['Integrator-Netsuite-ScriptId'] = options.scriptId
      opts.headers['Integrator-Netsuite-DeployId'] = options.deployId
      opts.headers['Integrator-Method'] = options.method
    }
    // REST call
    else if(!!options.relativeURI && !!options.method){
      opts.headers['Integrator-Relative-URI'] = options.relativeURI
      opts.headers['Integrator-Method'] = options.method
    }
    else{
      logInSplunk('Proxy request headers are not in correct format');
      return callback(new Error('Proxy request headers are not in correct format'));
    }
    request(opts, function(error, res, body) {
      if (error) {
        return callback(new Error('Error while connecting to Integrator.io'));
      }
      if (!verifyResponse(res)) {
        return callback(new Error('Unable to verify response'));
      }
      //this means success
      return callback(null, res, body);
    })
  }

  var verifyAndInjectDependency = function(recordarray, record) {
    logInSplunk('start verifyAndInjectDependency for ' + JSON.stringify(record));
    //get the dependency array and check if all are resolved in a loop
    var i;
    if(recordarray[record].dependencyVerified){
      logInSplunk('verifyAndInjectDependency : dependency has been verified for ' + record)
      return true;
    }
    // return true if there is no dependency for the input record
    if (!recordarray[record].dependson || recordarray[record].dependson.length === 0) {
      logInSplunk('verifyAndInjectDependency : no depenedency')
      recordarray[record].dependencyVerified = true
      return true;
    }
    //logInSplunk('recordarray[record].dependson : ' + JSON.stringify(recordarray[record].dependson))
    //return false if any dependency is not resolved for the input record
    for (i = 0; i < recordarray[record].dependson.length; i = i + 1) {
      if (!!recordarray[record].dependson[i] && (!recordarray[record].dependson[i].resolved
            || !recordarray[record].dependson[i].dependencyVerified)) {
        logInSplunk(record + ' still depend on ' + JSON.stringify(recordarray[record].dependson[i]))
        return false;
      }
    }
    logInSplunk('ready to resolve for ' + record)
    if (!recordarray[record].info.jsonpath) {
      recordarray[record].info.jsonpath = [];
    }
    //      sample jsonpath object
    //      {
    //             "record" : "connection-netsuite",
    //             "readfrom" : "$._id",
    //             "writeto"  : "_connectionId"
    //             "writetopath" : "the json path to node where we want to add writeto"
    //             "convertToString" : true
    //             "removeAll" : true
    //       }
    for (i = 0; i < recordarray[record].info.jsonpath.length; i = i + 1) {
      var temp = recordarray[record].info.jsonpath[i];
      //continue without resolving dependency if dependent record does not exist in meta file
      if(!!temp.record && !recordarray[temp.record]){
        //console.log("record node does not exist in meta file:", recordarray[record].info.jsonpath[i].record)
        continue
      }
      //logInSplunk(JSON.stringify(temp))
      //if readfrom and writeto both are $ replace object with incoming data
      if (temp.readfrom === '$' && temp.writeto === '$') {
        //deep copy
        if (!temp.record || !recordarray[temp.record]['info'] || !recordarray[temp.record]['info']['response']) {
          logInSplunk('Unable to resolve jsonpath for ' + temp, 'info')
          throw new Error('Unable to find jsonpath ' + temp)
        }
        recordarray[record].info.data = JSON.parse(JSON.stringify(recordarray[temp.record]['info']['response']))
        continue
      }
      //read the value of temprecord
      //if it is not an array put that in array
      if (!_.isArray(temp.readfrom)) {
        var ta = []
        ta.push({
          readfrom: temp.readfrom
        })
        if (temp.record) {
          ta[0].record = temp.record
        }
        temp.readfrom = ta
      }
      //iterate over this array and create tempvalue
      //tempReadValue
      var tempvalue = ""
      _.each(temp.readfrom, function(n) {
          //if there is no record use value directly
          //TODO: Hack, if the readfrom is object be can't change that in string
          //in that case use the record as is
          if (!n.record) {
            if (typeof(n.readfrom) === 'object' || typeof(tempvalue) === 'object') {
              tempvalue = n.readfrom
              logInSplunk('Setting hardcoded an object value')
              return
            } else {
              tempvalue = tempvalue + n.readfrom
              logInSplunk('Setting hardcoded value')
              return
            }
          }
          if (n.readfrom === '$') {
            //deep copy
            tempvalue = JSON.parse(JSON.stringify(recordarray[n.record].info.data))
            return
          }
          //handles bars if exists any.
          n.readfrom = evalHandleBar(n.readfrom, recordarray)
          tempJsonPath = jsonPath.eval(recordarray[n.record]['info']['response'], n.readfrom)
          logInSplunk('finding ' + n.readfrom + ' in ' + JSON.stringify(recordarray[n.record]['info']['response']))
          if (tempJsonPath.length <= 0) {
            logInSplunk('Unable to find ' + n.readfrom + ' in ' + JSON.stringify(recordarray[n.record]['info']['response']))
            tempJsonPath.push(null)
          }
          //Bug# in case of object do not add as string
          if (!(typeof(tempJsonPath[0]) === 'object')) {
            tempvalue = tempvalue + tempJsonPath[0]
          } else {
            tempvalue = tempJsonPath[0]
          }
        })
        //set in record
        //TODO: Add support for nested value writes
        //if it doesn't start with $ mean no need to run JSONPath eval on writeto
      var tempWriteto;
      if (temp.writetopath) {
        //adding support for dynamic write to path
        temp.writetopath = evalHandleBar(temp.writetopath, recordarray)
        tempWriteto = jsonPath.eval(recordarray[record].info.data, temp.writetopath);
        if (tempWriteto.length <= 0) {
          logInSplunk('Unable to find jsonpath ' + temp.writetopath + ' in ' + JSON.stringify(recordarray[record].info.data))
          throw new Error('Unable to find jsonpath ' + temp.writetopath + ' in ' + JSON.stringify(recordarray[record].info.data))
        }
        tempWriteto = tempWriteto[0];
      } else {
        tempWriteto = recordarray[record].info.data;
      }
      //if tempWriteto[temp.writeto] is an array, append tempvalue in tempWriteto[temp.writeto]
      //convert tempvalue in the required format
      if (temp.convertToString && typeof(tempvalue) !== "string") {
        tempvalue = JSON.stringify(tempvalue)
      }
      if (_.isArray(tempWriteto[temp.writeto])) {
        if (temp.removeAll) {
          //empty the array
          tempWriteto[temp.writeto].length = 0
        }
        tempWriteto[temp.writeto].push(tempvalue)
      } else {
        tempWriteto[temp.writeto] = tempvalue;
      }
      logInSplunk('setting ' + temp.writeto + ' as ' + tempWriteto[temp.writeto]);
    }
    //logInSplunk('After dependecy resolution record : ' + JSON.stringify(recordarray[record].info.data) );
    //mark dependecy veriified and return true
    recordarray[record].dependencyVerified = true
    return true;
  }
  , verifyACircular = function(graph) {
    var node, i;
    for (node in graph) {
      if (graph[node].dependson && _.isArray(graph[node].dependson) && graph[
          node].dependson.length > 0) {
        for (i = 0; i < graph[node].dependson.length; i = i + 1) {
          if (typeof(graph[node].dependson[i]) === 'string') {
            graph[node].dependson[i] = graph[graph[node].dependson[i]];
          }
        }
      }
    }
    try {
      JSON.stringify(graph);
      return true;
    } catch (e) {
      return false;
    }
  }
  , verifyAllResolved = function(graph) {
    var node;
    for (node in graph) {
      if (!graph[node].resolved) {
        return false;
      }
    }
    return true;
  }
  , logInSplunk = function(logmessage, loglevel) {
    //default level is debug
    if (!loglevel && process.env.NODE_ENV === 'production') {
      loglevel = 'debug'
    } else if (!loglevel) {
      loglevel = 'info'
    }
    logstring = 'module="extensionUtils" message="';
    logger.log(loglevel, logstring + logmessage + '"');
  }
  , verifyResponse = function(response) {
    if (response && response.statusCode && (response.statusCode >= 200 &&
        response.statusCode < 400)) {
      return true;
    }
    logInSplunk('Verification failed : ' + response.statusCode);
    return false;
  }
  , makeAsyncCalls = function(recordarray, callback) {
    logInSplunk('Making Async calls');
    if (verifyAllResolved(recordarray)) {
      logInSplunk('All depenedency are resolved');
      return callback(null, recordarray);
    }
    var batch = []
      , tempnode;

    for (tempnode in recordarray) {
      try {
        if(verifyAndInjectDependency(recordarray, tempnode) && !recordarray[tempnode].resolved){
            batch.push(recordarray[tempnode]);
        }
      } catch (e) {
        //we need to push that error message in callback
        return callback(e)
      }
    }
    //logInSplunk('batch : ' + JSON.stringify(batch))
    //we have all non dependent record perform aysn calls here
    async.each(batch, function(record, cb) {
      //we got record meta, try loading the record
      //logInSplunk('record.info :'+ JSON.stringify(record.info));
      if (record.info.apiIdentifier) {
        //Can't find a better way
        record.info.apiIdentifier = record.info.data.apiIdentifier
        record.info.data = record.info.data.apiIdentifierData

        integratorApiIdentifierClient(record.info, function(err, response, body) {
          //logInSplunk('Posting record : ' + JSON.stringify(body));
          if (err) {
            return cb(err);
          }
          //this mean call was successful, now go and save the info at location info.response
          record.info.response = body;
          logInSplunk('record got created in ' + JSON.stringify(body));
          //mark as resolved
          record.resolved = true;
          return cb(null);
        });
      } else {
        //if the record.info.method === GET remove data node and use _id as id
        //BAD WAY TO DO IT
        //TODO find a better way
        if (record.info.method === 'GET') {
          if (record.info.data && record.info.data._id) {
            record.info.id = record.info.data._id
            delete record.info.data
          }
        }
        integratorRestClient(record.info, function(err, response, body) {
          //logInSplunk('Posting record : ' + JSON.stringify(body));
          if (err) {
            return cb(err);
          }
          //this mean call was successful, now go and save the info at location info.response
          record.info.response = body;
          logInSplunk('record got created in ' + JSON.stringify(body));
          //mark as resolved
          record.resolved = true;
          return cb(null);
        });
      }
      //make a call to Integrator
      //call integrator rest client with resourceType
      //and data
    }, function(err) {
      if (err) {
        return callback(err)
      } //everything is successful for this batch let create another
      //logInSplunk('calling async');
      makeAsyncCalls(recordarray, callback);
    })
  }
  , trimNodesBasedOnEdition = function(recordarray, options){
    var temprecord;
    //trim nodes in upgrade mode
    if(options.upgradeMode){
      if(!options.currentEdition || !options.upgradeEdition){
        logInSplunk('Config Error: missing edition info to upgrade');
        return callback(new Error(
          'Config Error: missing edition info to upgrade'));
      }
      var currentEdition = options.currentEdition
      , upgradeEdition = options.upgradeEdition
      for(temprecord in recordarray) {
        //remove the node which is not eligible for provided edition
        if(_.isArray(recordarray[temprecord].edition) && _.contains(recordarray[temprecord].edition, upgradeEdition)
          && !_.contains(recordarray[temprecord].edition, currentEdition) && !_.contains(recordarray[temprecord].edition, "all")
          || !!recordarray[temprecord].includeToUpgrade){
          logInSplunk("including node " + temprecord, 'info')
          continue
        }
        else {
          delete recordarray[temprecord]
        }
      }
    }
    //trim nodes in installation mode
    else {
      var connectorEdition = options.connectorEdition
      for(temprecord in recordarray) {
        //remove the node which is not eligible for provided edition
        if(_.isArray(recordarray[temprecord].edition) && !_.contains(recordarray[temprecord].edition, connectorEdition)
            && !_.contains(recordarray[temprecord].edition, "all")){
              //console.log("deleting node", temprecord)
          delete recordarray[temprecord]
        }
      }
    }
  }
  /*
    Path should start with node name holding the bar data if bar data is provided through helper.
  */
  , evalHandleBar = function(sourceStr, recordarray){
    var temp = handlebars.compile(sourceStr)
    , barData = {} // dummy object
    handlebars.registerHelper('pathHelper', function(path) {
      var pathElement = path.split('.')
      , returnValue = null
      if(pathElement.length <= 0){
        return temp(barData)
      }
      returnValue = recordarray[pathElement[0]]['info']['response']
      pathElement.splice(0,1)
      _.each(pathElement, function(element){
        if(!returnValue[element]){
          throw new Error('Cannot find the bar value for the path: ' + path)
        }
        returnValue = returnValue[element]
      })
      if(!returnValue){
        throw new Error('bar path is not in required format: ' + path)
      }
      return returnValue;
    })
    return temp(barData)
  }
  //TODO: revert back to load file
  , loadJSON = function(filelocation) {
    try {
      if (require.cache) {
        delete require.cache[require.resolve('../../' + filelocation)];
      }
      return require('../../' + filelocation);
    } catch (e) {
      //backwards compatibility
      if (e.code === 'MODULE_NOT_FOUND') {
        if (require.cache) {
          delete require.cache[require.resolve(filelocation)];
        }
        return require(filelocation);
      }
    }
  };
exports.createRecordsInOrder = createRecordsInOrder
exports.integratorRestClient = integratorRestClient
exports.integratorApiIdentifierClient = integratorApiIdentifierClient
exports.integratorProxyCall = integratorProxyCall
exports.logInSplunk = logInSplunk
exports.loadJSON = loadJSON
