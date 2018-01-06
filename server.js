const https = require('https');
const querystring = require('querystring');
const express = require('express');
const app = express();
const redisClient = require('redis').createClient(process.env.REDIS_URL);
const twilio = require('twilio');
const twilioClient = new twilio(process.env.twilio_sid, process.env.twilio_auth);
const MessagingResponse = twilio.twiml.MessagingResponse;
const bodyParser = require('body-parser');
const CronJob = require('cron').CronJob;
var Notifier = require('./notify')
var cronJobMap = {};

// ==============================================
// ==============================================

app.set('port', (process.env.PORT || 5000));
app.disable('x-powered-by');
app.use(bodyParser.json());

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
        }
        else if(reply == null){
          console.log("Already unsubscribed: " + phone)
        }
        else{ //Unsubscribe
          let userData = JSON.parse(reply);
          userData.unsubscribe = true;
          redisClient.del(phone, (err, reply) => {
            if(err){
              console.log(err);
            }
          });
          if(phone in cronJobMap){
            cronJobMap[phone].stop();
          }
        }
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
app.post('/subscribe/:phone', function(req, res){//TODO: Replace this with a userdata object passed as the request body.

  //TODO: server side verification/formatting on phone number. Should be formatted '+11234567890' with the extra '+1' at the start.

  redisClient.select(1, function(){
    let phone = querystring.unescape(req.params.phone);
    let userData = req.body;
    if(!checkUserData(userData)){ //If userData does not meet the template specifications.
      res.status(400).send(JSON.stringify({err:"userData did not meet template specifications."}));
      return;
    }
    userData.securityCode = (Math.floor(Math.random() * 900) + 100).toString(); //Random number between 100 and 999.
    twilioClient.messages.create({
        body: 'Your ValTexts security code expires in five minutes: ' + userData.securityCode,
        to: phone,  // Text this number
        from: process.env.twilio_number // From a valid Twilio number
    }).then((message) => {
      if(message.errorMessage){
        res.status(400).send(JSON.stringify({err:"Phone wasn't formatted correctly or was invalid."}));
        return;
      }
      redisClient.set(phone, JSON.stringify(userData), (err) => {
        if(err){
          console.log(err);
          res.sendStatus(500);
          return;
        }
        redisClient.expire(phone, 300);
        res.sendStatus(200);
      });
    });
  });
});

app.post('/verify/:phone/:securityCode', function(req, res){

  //TODO: server side verification/formatting on phone number. Should be formatted '+11234567890' with the extra '+1' at the start.
  //TODO: server side verification on options passed in body. If they don't match the expected format, reject the entry!

  let phone = req.params.phone
  let securityCode = req.params.securityCode

  redisClient.select(1, function(err){
    if(err){
      res.sendStatus(500);
      return;
    }
    redisClient.get(phone, (err, reply) => {
      if(err){
        res.sendStatus(500);
        return;
      }
      else if(reply == null){
        res.status(404).send(JSON.stringify({err:"Phone number could not be found in verification database."}));
      }
      else{
        let userData = JSON.parse(reply);
        if(securityCode == userData.securityCode){//correct code
          redisClient.del(phone, (err, reply) => {
            redisClient.select(0, function(err){
              if(err){
                res.sendStatus(500);
                return;
              }
              delete userData.securityCode;
              redisClient.set(phone, JSON.stringify(userData));

              startCronJob(userData); //Schedule notification text.

              twilioClient.messages.create({
                  body: "Code verified. Welcome to ValTexts!",
                  to: userData.phone,  // Text this number
                  from: process.env.twilio_number // From a valid Twilio number
              });
              res.status(200).send(JSON.stringify({reply:"Code verified. Welcome to ValTexts!"}));
            });
          });
        }
        else{//invalid code
          res.status(400).send(JSON.stringify({err:"Incorrect code."}));
        }
      }
    });
  });
});

//TODO: This should take in a phone number (which the user might have butchered) and format it as '+11234567890' with the extra '+1' at the start.
function formatPhone(phone){

}

//TODO: Better verification that the timeOptions are proper ie hours < 24. And maybe that there are the right number of keys in breakfast, lunch, dinner, etc.
//This function checks whether the userData provided meets the standard template it is expect to conform to.
function checkUserData(userData){

  try{
    if(userData && userData.phone && userData.name
      && userData.timeOptions && userData.timeOptions.minutes && userData.timeOptions.hours && userData.timeOptions.days && userData.timeOptions.days.length && userData.timeOptions.days.length == 7
      && userData.menuOptions && userData.menuOptions.breakfast && userData.menuOptions.lunch && userData.menuOptions.dinner){

      return true;
    }
    else {
      return false;
    }
  } catch (e){
    console.log("verifyUserData exception successfuly caught: \n\n" + e);
    return false;
  }
}

//Returns a cron string for when to run a certain
function getCronStr(userData){
  let dayStr = "";
  for(var i = 0; i < userData.timeOptions.days.length; i++){
    dayStr += (i + ",")
  }
  dayStr = dayStr.substring(0, dayStr.length - 1);

  return "00 " + userData.timeOptions.minutes + " " + userData.timeOptions.hours + " * * " + dayStr;
}

//Returns a map of phone : cronJob
function startAllCronJobs(){
  try{
    redisClient.select(0, (err) => {
      if(err){
        console.log(err);
        return;
      }
      redisClient.keys("*", (err, keys) => {
        if(err){
          console.log(err);
          return;
        }
        keys.forEach((phone) => { //each key is a phone number
            redisClient.get(phone, (err, reply) => {
              if(err){
                console.log(err);
                return;
              }
              let userData = JSON.parse(reply)
              startCronJob(userData);
            });
          });
        });
      });
  } catch (e){
    twilioClient.messages.create({
        body: 'ValTexts server failed to schedule cron jobs: ' + new Date().toString(),
        to: process.env.test_number,  // Text this number
        from: process.env.twilio_number // From a valid Twilio number
    });
  }
}

function startCronJob(userData){
  let cronStr = getCronStr(userData);
  cronJobMap[userData.phone] = new CronJob(cronStr, () => {
    Notifier.notify(userData);
  }, () => {}, true, 'America/New_York'); //don't do anything when the job is stopped, but do start the job now.
}

// ========================================
// CODE BELOW HERE EXECUTES AT SERVER START
// ========================================
startAllCronJobs();

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
