var stage = new createjs.Stage("trafficCanvas");

function getAnimatorSelfInstance(currentThis) {
  var self = undefined;

  if (currentThis.animator != undefined) {
    self = currentThis.animator; // currentThis references Window object
  } else {
    self = currentThis; // currentThis is the animator instance as needed
  }

  return self;
}

function Animator() {
  var self = getAnimatorSelfInstance(this);
  self._setupCanvas();
  stage.addEventListener("stagemousedown", self._mouseDownHandler);

  self.NODE_RADIUS = 25;
  self.TOPOLOGY_RADIUS =
    Math.min(self._canvas.width, self._canvas.height)/2 - self.NODE_RADIUS*2;
  self.REDRAW_FREQUENCY = 1000;
  self.TOPOLOGY_CENTER_X = self._canvas.width/2;
  self.TOPOLOGY_CENTER_Y = self._canvas.height/2;
  self.TOPOLOGY_WIDTH = self._canvas.width;
  self.TOPOLOGY_HEIGHT = self._canvas.height;

  self._protocolColors = {
    'arp': 'blue',
    'ipv4': 'red',
    'ipv6': 'green'
  };

  self._nodes = {};
  self._networkFilterV4 = ipaddr.parseCIDR("0.0.0.0/0");
  self._showIPv4 = true;
  self._networkFilterV6 = ipaddr.parseCIDR("0::0/0");
  self._showIPv6 = true;
  self._redrawInterval = 0;
  self._canvasZoom = 0;

  createjs.Ticker.setFPS(60);
  createjs.Ticker.addEventListener("tick", stage);

  self._drawRouter();

  if( self._redrawInterval > 0 ) clearInterval(self._redrawInterval);
  self._redrawInterval = setInterval(self._redrawNodes, self.REDRAW_FREQUENCY);
}

Animator.prototype.addNode = function(ip) {
  var self = getAnimatorSelfInstance(this);
  var ipObj = ipaddr.parse(ip);
  var filter = self._networkFilterV4;
  var showNode = ipObj.kind() === 'ipv6' ? self._showIPv6 : self._showIPv4;

  if (ipObj.kind() === 'ipv6') {
    filter = self._networkFilterV6;
  }

  if (!(ip in self._nodes) && ipaddr.parse(ip).match(filter) && showNode) {
    self._nodes[ip] = {
      graphic : self._createNodeGraphic(ip),
      x : 0,
      y : 0
    };
    stage.addChild(self._nodes[ip].graphic);
    self._redrawNodes();
  }
};

Animator.prototype.removeAllNodes = function() {
  var self = getAnimatorSelfInstance(this);

  for (var ip in self._nodes) {
    stage.removeChild(self._nodes[ip].graphic);
    delete self._nodes[ip];
  }
};

Animator.prototype.setNetworkFilterV4 = function(newFilter) {
  var self = getAnimatorSelfInstance(this);

  if (newFilter) {
    self._networkFilterV4 = newFilter;
  } else {
    self._networkFilterV4 = ipaddr.parseCIDR("0.0.0.0/0");
  }

  self._resetNodeView();
};

Animator.prototype.resetNetworkFilterV4 = function() {
  var self = getAnimatorSelfInstance(this);

  self._networkFilterV4 = ipaddr.parseCIDR("0.0.0.0/0");

  self._resetNodeView();
};

Animator.prototype.setIPv4Visibility = function(bool) {
  var self = getAnimatorSelfInstance(this);
  self._showIPv4 = bool;
  self._resetNodeView();
};

Animator.prototype.setNetworkFilterV6 = function(newFilter) {
  var self = getAnimatorSelfInstance(this);

  if (newFilter) {
    self._networkFilterV6 = newFilter;
  } else {
    self._networkFilterV6 = ipaddr.parseCIDR("0::0/0");
  }

  self._resetNodeView();
};

Animator.prototype.resetNetworkFilterV6 = function() {
  var self = getAnimatorSelfInstance(this);

  self._networkFilterV6 = ipaddr.parseCIDR("0::0/0");

  self._resetNodeView();
};

Animator.prototype.setIPv6Visibility = function(bool) {
  var self = getAnimatorSelfInstance(this);
  self._showIPv6 = bool;
  self._resetNodeView();
};

Animator.prototype.addTraffic = function(sourceAddr, destAddr, type) {
  var self = getAnimatorSelfInstance(this);
  var result = false;
  var destIP = ipaddr.parse(destAddr);

  try {
    var cidrRange = self._isMulticast(destAddr);
    if (cidrRange == -1 || (type != 'ipv4' && type != 'ipv6')) {
      self.displayTraffic(sourceAddr, destAddr, type);
    } else {
      if (type == 'ipv4') {
        if (cidrRange == 0) { // default broadcast to "this" network
          var addressList = currentInterface.getAddressData();
          for (var i=0; i < addressList.length; i++) {
            if (ipaddr.IPv4.isIPv4(addressList[i][1])) {
              destIP = ipaddr.parse(addressList[i][0]);
              cidrRange = self._subnetMaskToCIDR(addressList[i][1]);
            }
          }
        }
      }
      for (var ip in self._nodes) {
        var checkedIP = ipaddr.parse(ip);
        if (checkedIP.kind() == destIP.kind()) {
          if (checkedIP.match(destIP, cidrRange)) {
            self.displayTraffic(sourceAddr, ip, type);
          }
        }
      }
    }

    result = true;
  } catch (e) {
    console.log('Error adding traffic: ', e);
  } finally {
    return result;
  }
};

Animator.prototype.displayTraffic = function(sourceAddr, destAddr, type) {
  var self = getAnimatorSelfInstance(this);
  var originX = 0, originY = 0;
  var destX = 0, destY = 0;
  var result = false;

  try {
    var sourceNode = self._nodes[sourceAddr];
    var destNode = self._nodes[destAddr];

    /* Calculate origin and destination x,y coordinates */
    if (sourceNode && sourceNode.graphic) {
      originX = sourceNode.x;
      originY = sourceNode.y;
    } else {
      originX = self.TOPOLOGY_CENTER_X;
      originY = self.TOPOLOGY_CENTER_Y;
    }

    if (destNode && destNode.graphic) {
      destX = destNode.x;
      destY = destNode.y;
    } else {
      destX = self.TOPOLOGY_CENTER_X;
      destY = self.TOPOLOGY_CENTER_Y;
    }

    var rotation = self._getTrafficRotation(originX, destX, originY, destY);
    var beamHeight = 3;

    /* Draw laser */
    var beam = new createjs.Shape();
    beam.graphics.beginFill(self._protocolColors[type]);
    beam.graphics.moveTo(0, 1.5) // beamHeight / 2
      .lineTo(70, 0).lineTo(70, beamHeight).closePath();
    beam.x = originX;
    beam.y = originY;
    beam.regX = 0;
    beam.regY = 1.5; // beamHeight / 2
    beam.rotation = rotation;

    /* Draw mask */
    var height = 10;
    var width =
      self._calculateDistanceBetweenPoints(originX, originY, destX, destY);
    var graphics = new createjs.Graphics().drawRect(0, 0, width, height);
    var mask = new createjs.Shape(graphics);
    mask.x = originX;
    mask.y = originY;
    mask.regX = 0;
    mask.regY = 5; // height / 2
    mask.rotation = rotation;
    beam.mask = mask;

    stage.addChildAt(beam, 0);

    createjs.Tween.get(beam, {loop: false, onChange: self._beamUpdate})
      .to({x: destX, y: destY, alpha: 1}, 1500, createjs.Ease.linear)
      .call(self._beamComplete);

    result = true;
  } catch (e) {
    console.log('Error displaying traffic: ', e);
  } finally {
    return result;
  }
};

Animator.prototype._beamUpdate = function(e) {
  /* Stub for future use */
};

Animator.prototype._beamComplete = function(e) {
  var self = getAnimatorSelfInstance(this);
  var beam = e.target;
  stage.removeChild(beam.mask);
  stage.removeChild(beam);
  createjs.Tween.removeTweens(e);
};

Animator.prototype._createNodeGraphic = function(ip) {
  var self = getAnimatorSelfInstance(this);
  var circle = new createjs.Shape();
  circle.graphics.beginFill("DeepSkyBlue").drawCircle(0, 0, self.NODE_RADIUS);

  var text = new createjs.Text(ip, "10px Times New Roman", "#000");
  text.x = 0;
  text.y = self.NODE_RADIUS + 5; // radius of circle plus 5px white space
  text.textAlign = "center";

  var container = new createjs.Container();
  container.addChild(circle);
  container.addChild(text);

  return container;
};

Animator.prototype._findSlope = function(x1, x2, y1, y2) {
  if (x1 == x2) {
    return 0;
  } else {
    return (y2 - y1) / (x2 - x1);
  }
};

Animator.prototype._slopeToDegrees = function(slope) {
  // slope to angle to degrees
  return Math.atan(slope) * (180/Math.PI);
};

Animator.prototype._calculateDistanceBetweenPoints = function(x1, y1, x2, y2) {
  return Math.sqrt(Math.pow(x2-x1, 2) + Math.pow(y2-y1, 2));
}

Animator.prototype._redrawNodes = function() {
  var self = getAnimatorSelfInstance(this);
  var totalNodes = Object.keys(self._nodes).length;
  var current = 0;
  var step = (Math.PI * 2) / totalNodes;

  for (var ip in self._nodes) {
    var newX = self.TOPOLOGY_CENTER_X + self.TOPOLOGY_RADIUS * Math.cos(current);
    var newY = self.TOPOLOGY_CENTER_Y + self.TOPOLOGY_RADIUS * Math.sin(current);
    createjs.Tween.get(self._nodes[ip].graphic, {loop: false})
      .to({x: newX, y: newY}, 500, createjs.Ease.linear);

    self._nodes[ip].x = newX;
    self._nodes[ip].y = newY;
    current += step;
  }
};

Animator.prototype._drawRouter = function() {
  var self = getAnimatorSelfInstance(this);
  var router = new createjs.Shape();
  router.graphics.beginFill("Black")
    .drawCircle(self.TOPOLOGY_CENTER_X, self.TOPOLOGY_CENTER_Y, 12);
  stage.addChild(router);
};

Animator.prototype._getTrafficRotation = function(originX, destX, originY, destY) {
  var self = getAnimatorSelfInstance(this);
  var rotation = self._slopeToDegrees(
    self._findSlope(originX, destX, originY, destY)
  );

  if (destX < originX) {
    rotation += 180;
  } else if (destX == originX) {
    if (destY < originY) {
      rotation -= 90;
    } else {
      rotation += 90;
    }
  }

  return rotation;
};

Animator.prototype._resetNodeView = function() {
  socket.emit("nodeListRequest");
};

Animator.prototype._setupCanvas = function() {
  var self = getAnimatorSelfInstance(this);

  self._canvas = document.getElementById("trafficCanvas");

  var navbarDimensions =
    document.getElementsByClassName("navbar")[0].getBoundingClientRect();
  var footerDimensions =
    document.getElementsByTagName("footer")[0].getBoundingClientRect();

  self._canvas.width = document.body.clientWidth;
  self._canvas.height = document.body.clientHeight
                        - footerDimensions.height
                        - navbarDimensions.height;

  self._canvas.addEventListener("mousewheel", self._mouseWheelHandler, false);
  self._canvas.addEventListener("DOMMouseScroll", self._mouseWheelHandler, false);
};

Animator.prototype._mouseWheelHandler = function(e) {
  var self = getAnimatorSelfInstance(this);

  if(Math.max(-1, Math.min(1, (e.wheelDelta || -e.detail)))>0)
    self._zoom=1.1;
  else
    self._zoom=1/1.1;
        var local = stage.globalToLocal(stage.mouseX, stage.mouseY);
    stage.regX=local.x;
    stage.regY=local.y;
  stage.x=stage.mouseX;
  stage.y=stage.mouseY;
  stage.scaleX=stage.scaleY*=self._zoom;

  stage.update();
};

Animator.prototype._mouseDownHandler = function(e) {
  var offset={x:stage.x-e.stageX,y:stage.y-e.stageY};
  stage.addEventListener("stagemousemove",function(ev) {
    stage.x = ev.stageX+offset.x;
    stage.y = ev.stageY+offset.y;
    stage.update();
  });
  stage.addEventListener("stagemouseup", function(){
    stage.removeAllEventListeners("stagemousemove");
  });
};

Animator.prototype._isMulticast = function(address) {
  var ip = ipaddr.parse(address);
  var lastOctetWasBroadcast = false;
  var result = 0;

  try {
    if (ip.kind() == 'ipv6') {
      // TODO, more accurate multicast simulation.
      // http://ipv6friday.org/blog/2011/12/ipv6-multicast/
      result = ip.range() == 'multicast' ? 16 : -1;
    } else {
      var octets = ip.octets;
      for (i=0; i<octets.length; i++) {
        if (octets[i] == 255) {
          if (!lastOctetWasBroadcast) {
            result = 8 * i;
          }
          lastOctetWasBroadcast = true;
        } else {
          result = -1
          lastOctetWasBroadcast = false;
        }
      }
    }
  } catch (e) {
    console.log(e);
  } finally {
    return result;
  }
};

Animator.prototype._subnetMaskToCIDR = function(address) {
  switch (address) {
    case '255.255.255.255':
      return 32;
      break;

    case '255.255.255.254':
      return 31;
      break;

    case '255.255.255.252':
      return 30;
      break;

    case '255.255.255.248':
      return 29;
      break;

    case '255.255.255.240':
      return 28;
      break;

    case '255.255.255.224':
      return 27;
      break;

    case '255.255.255.192':
      return 26;
      break;

    case '255.255.255.128':
      return 25;
      break;

    case '255.255.255.0':
      return 24;
      break;

    case '255.255.254.0':
      return 23;
      break;

    case '255.255.252.0':
      return 22;
      break;

    case '255.255.248.0':
      return 21;
      break;

    case '255.255.240.0':
      return 20;
      break;

    case '255.255.224.0':
      return 19;
      break;

    case '255.255.192.0':
      return 18;
      break;

    case '255.255.128.0':
      return 17;
      break;

    case '255.255.0.0':
      return 16;
      break;

    case '255.254.0.0':
      return 15;
      break;

    case '255.252.0.0':
      return 14;
      break;

    case '255.248.0.0':
      return 13;
      break;

    case '255.240.0.0':
      return 12;
      break;

    case '255.224.0.0':
      return 11;
      break;

    case '255.192.0.0':
      return 10;
      break;

    case '255.128.0.0':
      return 9;
      break;

    case '255.0.0.0':
      return 8;
      break;

    case '254.0.0.0':
      return 7;
      break;

    case '252.0.0.0':
      return 6;
      break;

    case '248.0.0.0':
      return 5;
      break;

    case '240.0.0.0':
      return 4;
      break;

    case '224.0.0.0':
      return 3;
      break;

    case '192.0.0.0':
      return 2;
      break;

    case '128.0.0.0':
      return 1;
      break;

    case '0.0.0.0':
      return 0;
      break;

    default:
      return 0;
      break;
  }
};
