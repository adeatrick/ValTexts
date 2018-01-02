var https = require('https');
var twilio = require('twilio');
var bl = require('bl');
var redisClient = require('redis').createClient(process.env.REDIS_URL);
var client = new twilio(process.env.twilio_sid, process.env.twilio_auth);

function notify(number, message){
  client.messages.create({
      body: message,
      to: number,  // Text this number
      from: process.env.twilio_number // From a valid Twilio number
  }).then((message) => console.log(message.sid));
}

function generateId(d){

  let day = (d.getDate() < 10) ? "0" + d.getDate() : d.getDate();
  return "dining-menu-" + d.getFullYear() + "-" + (d.getMonth()+1) + "-" + day + "-meals";
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

//Options is an object
//breakfast, lunch, dinner are objects within that object

function constructMessage(d, menu, options, callback){

  let msg = d.toDateString() + "\n\n"
  let meals = Object.keys(options)
  meals.forEach((mealName) => {
    msg += ("-----" + mealName.toUpperCase() + "-----"+ "\n") //TODO: this should only happen if at least one of the options for that meal is true. Ie don't say "Breakfast: " if the options don't ask for any info on breakfast.
    let meal = options[mealName] //meal now is the options object referenced by, say, "breakfast".
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

//This function serves to return a sample options object for testing. In the future, this will come from
function getSampleOptions(){
  let options = {}
  options.breakfast = {}
  options.breakfast["Breakfast/Grill"] = false
  options.breakfast["Pastry Selection"] = false
  options.breakfast["Smoothies"] = false

  options.lunch = {}
  options.lunch["Deli"] = false
  options.lunch["Dessert"] = false
  options.lunch["Lighter Side"] = false
  options.lunch["Pasta"] = true
  options.lunch["Salad Bar"] = true
  options.lunch["Soup"] = true
  options.lunch["Traditional"] = true

  options.dinner = {}
  options.dinner["Bread Selection"] = true
  options.dinner["Dessert"] = true
  options.dinner["Lighter Side"] = true
  options.dinner["Pasta"] = false
  options.dinner["Pizza"] = false
  options.dinner["Soup"] = false
  options.dinner["Traditional"] = false

  return options
}

// =========================
// CODE BELOW HERE EXECUTES
// =========================

let year = "2017"
let month = "11" //DECEMBER, 0-indexed!!
let day = "01"
let d = new Date(year, month, day)
getMenu(d, (menu) => {

  //Here will be a loop through all relevant users. For now, it's just a single test.
  options = getSampleOptions();
  constructMessage(d, menu, options, (msg) => {
    notify(process.env.test_number, msg)
  });
});
