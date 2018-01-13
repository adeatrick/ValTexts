var https = require('https');
var twilio = require('twilio');
var bl = require('bl');

module.exports.notify = function notify(userData){

  let d = new Date();
  if(userData.nextDay){
    d.setDate(d.getDate() + 1)
  }
  getMenu(d, (menu) => {
    let twilioClient = new twilio(process.env.twilio_sid, process.env.twilio_auth);
    constructMessage(d, menu, userData.menuOptions, (message) => {
        twilioClient.messages.create({
            body: message,
            to: userData.phone,  // Text this number
            from: process.env.twilio_number // From a valid Twilio number
        }).then((message) => console.log(message.sid));
    });
  });
}

function generateId(date){
  //Example: dining-menu-2017-10-12-meals
  let suffix = "meals";
  let day = (date.getDate() < 10) ? "0" + date.getDate() : date.getDate();
  let month = (date.getMonth()+1 < 10)  ? "0" + (date.getMonth()+1) : (date.getMonth()+1);

  return "dining-menu-" + date.getFullYear() + "-" + month + "-" + day + "-" + suffix;
}

function getMenu(d, callback){

  let baseUrl = "https://whatsatval.com/menus/"
  let id = generateId(d)
  let suffix = ".json"
  let url = baseUrl + id + suffix

  https.get(url,function(response){
    response.pipe(bl(function(err, data){
      if(err) {
        console.error(err);
      }
      else {
        var dataString = data.toString();
        //console.log(dataString)
        menu = JSON.parse(dataString)
        callback(menu);
      }
    }));
  });
}

//TODO: Make it so that it only doesn't say "Breakfast: " if the menuOptions don't ask for any info on breakfast ie all options are false.

//Constructs a message
function constructMessage(d, menu, menuOptions, callback){ //menuOptions is an object; breakfast, lunch, dinner are objects within that object

  let msg = d.toDateString() + "\n\n"
  let meals = Object.keys(menuOptions)
  meals.forEach((mealName) => {
    let meal = menuOptions[mealName] //meal now is the menuOptions object referenced by, say, "breakfast".
    foodStations = Object.keys(meal)
    foodStations.forEach(foodStation => {
      if(meal[foodStation] && menu[mealName][foodStation]){
        if(msg.indexOf(mealName.toUpperCase()) === -1){
          msg += ("-----" + mealName.toUpperCase() + "-----"+ "\n")
        }
        food = menu[mealName][foodStation] //food is now a string containing the menu's information on whatever that foodStation is serving for the day
        msg += (foodStation.toUpperCase() + ": " + food + "\n")
      }
    });
    msg += "\n\n"
  });
  callback(msg)
}
