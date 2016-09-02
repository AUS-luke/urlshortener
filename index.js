'use strict';

const express = require('express');
const mongodb = require('mongodb');
const validUrl = require('valid-url');

const app = express();
const MongoClient = mongodb.MongoClient;
const port = process.env.PORT || 8080;
const mongoUrl = process.env.MONGOLAB_URI;


app.use('/', (req, res) => {
  // strip leading / and return either the url if valid or undefined if invalid
  let param = req.url.replace(/^\/|\/$/g, '').toString() || null;
  let domain = req.headers.host;

  // if favicon request ignore
  if (req.url === '/favicon.ico') {
    res.writeHead(200, {'Content-Type': 'image/x-icon'} );
    res.end();
    console.log('favicon requested');
    return;
  }
  // if no param supplied
  else if (req.url == '/') {
    res.end('Please Enter a valid url to be shortened\ne.g.\nhttp://' + domain + '/http://www.google.com');
  }
  //if param is invalid and url is not a number
  else if (!/^[0-9]+$/.test(param) && !validUrl.isUri(param) ) {
    res.write('ERROR: Not a valid URL OR valid url number\n\n');
    res.end('Please Enter a valid url to be shortened\ne.g.\nhttp://' + domain + '/http://www.google.com');
  }
  //if param is a url
  else if (validUrl.isUri(param)) 
  {
    setUpDb(function (db) { processUrl(param, res, domain, db);});
  }
  //if param is a number
  else if (/^[0-9]+$/.test(param)) {
    setUpDb(function (db) { getUrl(param, res, db);});
  }
  else {
    console.log('uh oh shouldnt be here');
    console.log(param);
  }

});

app.listen(port);


function setUpDb(callback) {
  MongoClient.connect(mongoUrl, function (err, db) {
    if (err) {
      console.log('Unable to connect to the mongoDB server. Error:', err);
    } else {
      console.log('Connection established to', mongoUrl);
      callback(db);
    }
  });
}

function processUrl(url,res, domain, db) {
  let urlDb = db.collection('urls');
  urlDb.find({url:url}, function(err,cursor){
    cursor.toArray(function(err,results) {

      // if url is not in array - add to array
      if (results.length === 0) {
        insertEntry(urlDb, url, function (result) {
          res.send({
            original_url: url,
            short_url: result
          });
          res.end();
        });
      }
      // if url is in array prompt user
      else {
        res.send({
          original_url: url,
          short_url: 'http://' + domain + '/' + results[0]._id
        });
        res.end();
      }
    });
  });   
}



function getUrl(param, res, db) {
  let urlDb = db.collection('urls');
  urlDb.find({_id:parseInt(param)}, function(err,cursor){
    cursor.toArray(function(err,results) {
      if (err) {console.error(err);}

      if (results.length) {
        res.redirect(results[0].url);
      }
      res.end('Invalid short url id');
      db.close();
    });
  });
}


function insertEntry (collection, url, callback) {
  getNextSequence(collection, 'urlID', function (seq) {
    collection.insertOne(
      { _id: seq, 
        url: url 
      },
      function(err) {
        if (err) {console.error(err);}
        callback(seq);
      }
    );
  });
}

function getNextSequence(collection, name, callback) {
  collection.findAndModify(
    { _id: name },
    [], 
    { $inc: { seq: 1 } },
    { new: true },
    function(err, result) {
      if (err) {console.error(err);}
      return callback(result.value.seq);
    }
  );
  
}
