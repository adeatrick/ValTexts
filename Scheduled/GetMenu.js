var https = require('https');
var bl = require('bl');
var fs = require('fs');
var path = require('path');
let Client = require('ssh2').Client;
const redis = require('redis');
let redisClient = redis.createClient(process.env.REDIS_URL);
let k = process.env.ftp_private_key.replace(/{-}/g, '\n');

let baseUrl = 'https://www.amherst.edu/campuslife/housing-dining/dining/menu/';
console.log("STARTING GETMENU: " + new Date())

let maxWeeks = 2;

getData(new Date(), new Array(0), baseUrl, 0); //Line that actually does things.

function getData(startDate, uploadList, baseUrl, i){

  if(i === maxWeeks || i > maxWeeks){
    uploadMenus(uploadList);
    return;
  }

  //Example: 2017-10-08/2017-10-14
  var startDateUrl = startDate.getFullYear().toString() + "-" + (startDate.getMonth()+1) + "-" + startDate.getDate() + "/"; //Example: 2017-10-08/2017-10-14
  startDate.setDate(startDate.getDate() + 7);
  var endDateUrl = startDate.getFullYear().toString() + "-" + (startDate.getMonth()+1) + "-" + startDate.getDate();
  startDate.setDate(startDate.getDate() - 7);

  let url = baseUrl + startDateUrl + endDateUrl;

  https.get(url,function(response){
    response.pipe(bl(function(err, data){
      if(err) {
        console.error(err);
      }
      else {
            //console.log(url);
            //console.log(startDate.toDateString());
            var dataString = data.toString();
            uploadList = uploadList.concat(parseMenu(dataString, new Date(startDate)));
            startDate.setDate(startDate.getDate()+7);
            getData(startDate, uploadList, baseUrl, i+1); //d already got incremented to the next week above
      }
    }));
  });
}

function parseMenu(dataString, d){

  console.log(d.toDateString());
  let filePaths = new Array(0);

  for(let i = 0; i < 7; i++){

    let menu = {};
    let id = generateId(d, 0);
    //menu.id = id;

    let searchTerm = "id=\"" + id + "\"";

    let menuStartIndex = dataString.indexOf(searchTerm);
    dataString = dataString.substring(menuStartIndex, dataString.length);;

    for(var j = 1; j < 4; j++){

      let mealId = generateId(d, j);
      let meal = {};

      let mealStartIndex = dataString.indexOf("id=\"" + mealId + "\"");
      dataString = dataString.substring(mealStartIndex, dataString.length);

      let foodSearchTerm = "dining-course-name";

      while(nextDivContainsClass(dataString, foodSearchTerm)){

        let foodType = getNextMenuDivContents(dataString);
        let food = getNextParagraphContents(dataString);

        meal[foodType] = food;

        let newStart = dataString.indexOf("</p>") + 4; //+4 to account for the length of the p element.
        dataString = dataString.substring(newStart, dataString.length);
      }
      //console.log(JSON.stringify(meal));
      if(j === 1)
        menu.breakfast = meal;
      else if(j === 2)
        menu.lunch = meal;
      else
        menu.dinner = meal;
    }

    filePaths.push(saveMenu(menu, id, d));
    //console.log(d.toString());
    d.setDate(d.getDate() + 1);
  }

  return filePaths;
}

function generateId(date, i){
  //Example: dining-menu-2017-10-12-meals
  let suffix = ["meals","Breakfast-menu-listing","Lunch-menu-listing","Dinner-menu-listing"];
  let day = (date.getDate() < 10) ? "0" + date.getDate() : date.getDate();
  let month = (date.getMonth()+1 < 10)  ? "0" + (date.getMonth()+1) : (date.getMonth()+1);

  return "dining-menu-" + date.getFullYear() + "-" + month + "-" + day + "-" + suffix[i];
}

function nextDivContainsClass(dataString, searchTerm){
  let start = dataString.indexOf("<div ");
  let finish = dataString.indexOf("</div");
  let div = dataString.substring(start+5, finish); //+5 to account for the length of the div tag itself.

  //console.log(div);

  let index = dataString.indexOf(searchTerm);
  //console.log(index);

  if(div.includes(searchTerm) && start < index && index < finish)
    return true;
  else
    return false;
}

function getNextMenuDivContents(dataString){

  let start = dataString.indexOf("<div") + 4;
  while(dataString.charAt(start++) !== ">"); //Note that start is incremented--this sets start to the end of the div tag.
  let finish = dataString.indexOf("</div>");

  return dataString.substring(start, finish); //+3 to account for the length of the <p> tag itself.

}

function getNextParagraphContents(dataString){

  let start = dataString.indexOf("<p>");
  let finish = dataString.indexOf("</p>");

  return dataString.substring(start+3, finish); //+3 to account for the length of the <p> tag itself.
}

function saveMenu(menu, name, date){

  let fn = name + ".json"
  let curr = path.resolve(__dirname, fn);

  fs.writeFile(curr, JSON.stringify(menu), function(err) {
      if(err) {
        return console.log(err);
      }

      console.log(fn + " saved to localhost!");
  });

  return curr;
}

function uploadMenus(filePaths){

  var conn = new Client();
  conn.on('ready', function() {
      conn.sftp(function(err, sftp) {
          if (err) throw err;

          uploadNextMenu(filePaths, 0, sftp, conn);
      });
  }).connect({
    host: 'us96.siteground.us',
    port: '18765',
    username: 'whatsatv',
    password: process.env.ftp_password,
    privateKey: k,
    passphrase: process.env.ftp_passphrase
  });
}

function uploadNextMenu(filePaths, i, sftp, conn){

  //console.log("made it");

  let curr = filePaths[i];

  console.log(filePaths[i]);

  let name = curr.substring(curr.lastIndexOf("\\") + 1, curr.length);

  let dest = "/home/whatsatv/public_html/menus/" + name;

  sftp.fastPut(curr, dest, function(err){
    if(err){
      sftp.readdir("/", function(err, list) {
        if (err) throw err;
        console.dir(list);
      });
      console.log(dest);
      return console.log(err);
    }

    console.log(dest + " ----transferred succesfully" );
    if(i < filePaths.length - 1){ //7 days in a week and we increment i below, so i must be <6
      uploadNextMenu(filePaths, i + 1, sftp, conn)
    } else {
      console.log( "sftp connection closed" );
      conn.end();
      process.exit();
    }
  });
}
