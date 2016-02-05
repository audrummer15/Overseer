var socketio = require('socket.io');
var _path = require('path');
var appPath = _path.dirname(require.main.filename);

var NetworkCaptor = require(_path.join(appPath, 'server', 'NetworkCaptor'));
var NodeManager = require(_path.join(appPath, 'server', 'NodeManager'));
var AddressUtilities = require(
  _path.join(appPath, 'server', 'Utilities', 'AddressUtilities')
);

module.exports = function(app) {
  var networkCaptor = new NetworkCaptor({device: 'wlan0'});
  var nodeManager = new NodeManager();
  var io = socketio.listen(app);
  io.set('log level', 1);

  /********************************/
  /* Communication from front end */
  /********************************/
  io.sockets.on('connection', function(socket) {
    socket.emit('system', {
      msg:"<span style=\"color:red !important\">Connected to Dispatch</span>"
    });

    socket.on('startCapture', function() {
      var msg = "";

      if (networkCaptor.start()) {
        msg = "<span style=\"color:red !important\">Starting Capture!</span>";
      } else {
        msg = "<span style=\"color:red !important\">An Error Occurred!</span>";
      }
      socket.emit('system', {
        msg: msg
      });
    });

    socket.on('stopCapture', function() {
      var msg = "";

      if (networkCaptor.stop()) {
        msg = "<span style=\"color:red !important\">Stopping Capture!</span>";
      } else {
        msg = "<span style=\"color:red !important\">An Error Occurred!</span>";
      }
      socket.emit('system', {
        msg: msg
      });
    });

    socket.on('nodeListRequest', function() {
      var list = nodeManager.getNodeList(socket);
      socket.emit('nodeList', {list: list});
    });
  });

  /****************************************/
  /* Communication of back end components */
  /****************************************/
  networkCaptor.on("arp", function(data) {
    try {
      var message = data.toString();
      var addresses = AddressUtilities.parseIPv4Addresses(message);
      nodeManager.checkTrafficForNewNodes(addresses);
      io.sockets.emit('traffic', {
        traffic: addresses,
        type: 'arp',
        msg: message
      });
    } catch (e) {
      console.log('ARP Signal Error: ', e);
    }
  });

  networkCaptor.on("ipv4", function(data) {
    try {
      var message = data.toString();
      var addresses = AddressUtilities.parseIPv4Addresses(message);
      nodeManager.checkTrafficForNewNodes(addresses);
      io.sockets.emit('traffic', {
        traffic: addresses,
        type: 'ipv4',
        msg: message
      });
    } catch (e) {
      console.log('IPv4 Signal Error: ', e);
    }
  });

  networkCaptor.on("ipv6", function(data) {
    try {
      var message = data.toString();
      var addresses = AddressUtilities.parseIPv6Addresses(message);
      nodeManager.checkTrafficForNewNodes(addresses);
      io.sockets.emit('traffic', {
        traffic: addresses,
        type: 'ipv6',
        msg: message
      });
    } catch (e) {
      console.log('IPv6 Signal Error: ', e);
    }
  });

  networkCaptor.on('error', function(error) {
    io.sockets.emit('error', error);
  });

  nodeManager.on('newNode', function(nodeData) {
    io.sockets.emit('newNode', nodeData);
  });
};
