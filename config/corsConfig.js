const express = require('express');
const cors = require('cors');

const whitelist = [
  // Development origin and ports
  "http://localhost:2001",
  "http://localhost:3001",
  "http://localhost:3000",
  "http://localhost:5000",
  "http://localhost:4200",
  "http://127.0.0.1:2001",
  "http://164.52.200.120:3001",
  // Dev env
  "http://lb.softchilli.com",
  "http://softchilli.com",
  // prod env
  "https://sc-p1-local-buniya.herokuapp.com",
  "http://sc-p1-local-buniya.herokuapp.com"

];

// Todo - need to whitelist dynamically

const corsOptions = {
  origin: function (origin, callback) {
    // allow requests with no origin
    // (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (whitelist.indexOf(origin) === -1) {
      var msg = 'The CORS policy for this site [ ' + origin + ' ] does not allow access from the specified Origin.';
      console.log(msg);
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  }
}

module.exports = { corsOptions };
