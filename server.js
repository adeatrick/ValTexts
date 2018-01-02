const https = require('https');
const querystring = require('querystring');
const express = require('express');
const app = express();
const redisClient = require('redis').createClient(process.env.REDIS_URL);
const twilio = require('twilio');
const twilioClient = new twilio(process.env.twilio_sid, process.env.twilio_auth);
const MessagingResponse = twilio.twiml.MessagingResponse;

// ==============================================
// ==============================================

app.set('port', (process.env.PORT || 5000));
app.disable('x-powered-by');

//Receives incoming sms's
app.post('/sms', function(req, res){

  const twiml = new MessagingResponse();

  phone = req.body.From //Format of '+11234567890', notably including the extra +1.
  text = req.body.Body.toLowerCase()
  unsub = ["stop", "stopall", "unsubscribe", "cancel", "end", "quit"]
  if(unsub.indexOf(text) !== -1){
    redisClient.select(0, function(){
      redisClient.get(phone, (err, reply) => {
        if(err){
          console.log(err);
          twiml.message("Internal server error.");
        }
        else if(reply == null){
          twiml.message("Already unsubscribed. For help and FAQ, please visit https://WhatsAtVal.com.");
        }
        else{ //Unsubscribe
          redisClient.del(phone, (err, reply) => {
            if(err){
              console.log(err);
              twiml.message("Internal server error.");
            }
            else{
              twiml.message("Unsubscribed");
            }
            res.writeHead(200, {'Content-Type': 'text/xml'});
            res.end(twiml.toString());
          });
          return; //We write the message in the callback in this else,
        }
        res.writeHead(200, {'Content-Type': 'text/xml'});
        res.end(twiml.toString());
      });
    });
  }
  else{
    twiml.message("For help and FAQ, please visit https://WhatsAtVal.com. To unsubscribe, text \"STOP\"");
    res.writeHead(200, {'Content-Type': 'text/xml'});
    res.end(twiml.toString());
  }
});

//Receives new signups
app.post('/subscribe/:phone/:name/:options', function(req, res){//TODO: Replace this with URL query parameters?

  //TODO: server side verification/formatting on phone number. Should be formatted '+11234567890' with the extra '+1' at the start.

  redisClient.select(1, function(){
    let code = (Math.floor(Math.random() * 100) + 99).toString();
    console.log(code)
    let userData = {
      code: code,
      phone: querystring.unescape(req.params.phone),
      name: querystring.unescape(req.params.name),
      options: JSON.parse(querystring.unescape(req.params.options))
    }
    redisClient.set(userData.phone, JSON.stringify(userData));
  });
});

app.post('/verify/:phone/:code', function(req, res){

  //TODO: server side verification/formatting on phone number. Should be formatted '+11234567890' with the extra '+1' at the start.

  redisClient.select(1, function(){
    let phone = req.params.phone
    let code = req.params.code

    redisClient.get(phone, (err, reply) => {
      if(err){
        console.log(err);
      }
      else if(reply == null){
        console.log("Phone wasn't formatted correctly or was incorrect.")
      }
      else{
        let userData = JSON.parse(reply);
        if(code == userData.code){//correct code
          redisClient.del(phone, (err, reply) => {
            redisClient.select(0, function(){
              delete userData.code;
              redisClient.set(phone, JSON.stringify(userData))
              twilioClient.messages.create({
                  body: "Code verified. Welcome to ValTexts!",
                  to: userData.phone,  // Text this number
                  from: process.env.twilio_number // From a valid Twilio number
              });
              res.send(JSON.stringify({reply:"Code verified. Welcome to ValTexts!"}));
            });
          });
        }
        else{//invalid code
          res.send(JSON.stringify({err:"Incorrect code."})); //TODO: Should also delete old userdata in redis db1, or update code. Something like that.
        }
      }
    });

    redisClient.set(req.params.phone, JSON.stringify(userData));
  });
});

//TODO: This should take in a phone number (which the user might have butchered) and format it as '+11234567890' with the extra '+1' at the start.
function formatPhone(phone){


}

// ========================================
// CODE BELOW HERE EXECUTES AT SERVER START
// ========================================

var server = app.listen(app.get('port'), function() {
  var host = server.address().address;
  var port = server.address().port;
});

/*
twilioClient.messages.create({
    body: 'ValTexts deployed successfully at: ' + new Date().toDateString(),
    to: process.env.test_number,  // Text this number
    from: process.env.twilio_number // From a valid Twilio number
}).then((message) => console.log(message.sid));
*/
