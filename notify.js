var https = require('https');
var twilio = require('twilio');
var bl = require('bl');
var redisClient = require('redis').createClient(process.env.REDIS_URL);
var client = new twilio(process.env.twilio_sid, process.env.twilio_auth);

module.exports.notify = function notify(userData){

  let d = new Date();
  let menu = getMenu(d, (menu) => {
    constructMessage(d, menu, userData.menuOptions, (message) => {
        client.messages.create({
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

//menuOptions is an object
//breakfast, lunch, dinner are objects within that object

function constructMessage(d, menu, menuOptions, callback){

  let msg = d.toDateString() + "\n\n"
  let meals = Object.keys(menuOptions)
  meals.forEach((mealName) => {
    msg += ("-----" + mealName.toUpperCase() + "-----"+ "\n") //TODO: this should only happen if at least one of the menuOptions for that meal is true. Ie don't say "Breakfast: " if the menuOptions don't ask for any info on breakfast.
    let meal = menuOptions[mealName] //meal now is the menuOptions object referenced by, say, "breakfast".
    foodStations = Object.keys(meal)
    foodStations.forEach(foodStation => {
      if(meal[foodStation] && menu[mealName][foodStation]){
        food = menu[mealName][foodStation] //food is now a string containing the menu's information on whatever that foodStation is serving for the day
        msg += (foodStation.toUpperCase() + ": " + food + "\n")
      }
    });
    msg += "\n\n"
  });
  callback(msg)
}
