var https = require('https');
var express = require('express');
var app = express();

var twilio = require('twilio');
var client = new twilio(process.env.twilio_sid, process.env.twilio_auth);
const MessagingResponse = twilio.twiml.MessagingResponse;

// ==============================================
// ==============================================

app.set('port', (process.env.PORT || 5000));
app.disable('x-powered-by');

app.post('/sms', function(req, res){

  const twiml = new MessagingResponse();

  twiml.message("This is working: " + req.ip);

  res.writeHead(200, {'Content-Type': 'text/xml'});
  res.end(twiml.toString());
})

var server = app.listen(app.get('port'), function() {
  var host = server.address().address;
  var port = server.address().port;
  //console.log('Running at http://' + host + ':' + port)
  //console.log('Node app is running on port', app.get('port'));
});

client.messages.create({
    body: 'ValTexts deployed successfully at: ' + new Date().toDateString(),
    to: process.env.test_number,  // Text this number
    from: process.env.twilio_number // From a valid Twilio number
}).then((message) => console.log(message.sid));

//test
