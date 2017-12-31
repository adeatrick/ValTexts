var https = require('https');
var express = require('express');
var app = express();

var twilio = require('twilio');
const MessagingResponse = twilio.twiml.MessagingResponse;

//const { Client } = require('pg'); //database

// ==============================================
// ==============================================

app.set('port', (process.env.PORT || 5000));
app.disable('x-powered-by');

function generateId(d){

  let day = (d.getDate() < 10) ? "0" + d.getDate() : d.getDate();
  return "dining-menu-" + d.getFullYear() + "-" + (d.getMonth()+1) + "-" + day + "-meals";
}

app.post('/sms', function(req, res){

  const twiml = new MessagingResponse();

  twiml.message("This is working: " + req.ip);

  res.writeHead(200, {'Content-Type': 'text/xml'});
  res.end(twiml.toString());
})

/*
client.messages.create({
    body: 'Hello from Node',
    to: '+17343586741',  // Text this number
    from: '++14139923507 ' // From a valid Twilio number
})
.then((message) => console.log(message.sid));
*/


var server = app.listen(app.get('port'), function() {
  var host = server.address().address;
  var port = server.address().port;
  console.log('Running at http://' + host + ':' + port)
  //console.log('Node app is running on port', app.get('port'));
});
