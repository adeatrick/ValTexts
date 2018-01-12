let fs = require('fs');

fs.readFile("private.txt", "utf8", function(err, data) {
  if(err)
    console.log(err);

  console.log(data)

  let x = data.replace(/{-}/g, '\n');

  console.log(x)

  //fs.writeFile("private.txt", data, 'utf8', console.log())
});
