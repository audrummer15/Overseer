/*************************************
//
// app app
//
**************************************/

// express magic
var express = require('express');
var app = express();
var server = require('http').createServer(app)
var io = require('socket.io').listen(server);
var device  = require('express-device');
var NetworkCaptor = require('./lib/capture');
var networkCaptor = new NetworkCaptor(io, {device: 'wlan0'});

var runningPortNumber = process.env.PORT || 3000;


app.configure(function(){
  // I need to access everything in '/public' directly
  app.use(express.static(__dirname + '/public'));

  //set the view engine
  app.set('view engine', 'ejs');
  app.set('views', __dirname +'/views');

  app.use(device.capture());
});


// logs every request
app.use(function(req, res, next){
  // output every request in the array
  console.log({method:req.method, url: req.url, device: req.device});

  // goes onto the next function in line
  next();
});

app.get("/", function(req, res){
  res.render('index', {});
});


io.sockets.on('connection', function (socket) {

  socket.emit('traffic', {msg:"<span style=\"color:red !important\">Connected to Server</span>"});

  socket.on('traffic', function(data) {
    console.log(data);
  });

  socket.on('startCapture', function() {
    networkCaptor.start(io);
    io.sockets.emit('traffic', {msg:"<span style=\"color:red !important\">Starting Capture!</span>"});
  });

  socket.on('stopCapture', function() {
    networkCaptor.stop();
    io.sockets.emit('traffic', {msg:"<span style=\"color:red !important\">Stopping Capture!</span>"});
  });

  socket.on('newNode', function(data) {
    console.log('New Node: ', data);
  });
});

console.log("Port: ", runningPortNumber);
server.listen(runningPortNumber);
