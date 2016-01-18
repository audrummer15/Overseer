/*************************************
//
// app app
//
**************************************/

// connect to our socket server
var socket = io.connect();

var app = app || {};

var nodeManager = new NodeManager();
var animator = new Animator();
nodeManager.addObserver(animator);

// shortcut for document.ready
$(function(){
  //setup some common vars
  var $allPostsTextArea = $('#allPosts'),
    $allTraffic = $('#trafficFeed'),
    $startButton = $('#startCapture');
    $stopButton = $('#stopCapture');


  //SOCKET STUFF
  socket.on("traffic", function(data) {
    $allTraffic.prepend(data.msg + '<br/>');
    animator.shootLaser(50, getRandom(0,500), 850, 250);
  });

  socket.on("newNode", function(data) {
    var newNode = new Node(data.ip);
    nodeManager.addNode(newNode);
  });

  $startButton.click(function(e) {
    socket.emit("startCapture");
  });

  $stopButton.click(function(e) {
    socket.emit("stopCapture");
  });

});

function getRandom(min, max) {
  return Math.random() * (max - min) + min;
}
