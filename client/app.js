const MARKER_SIZE = 4;
const ERASER_SIZE = 32;

const generateGuid = () => {
  function _p8(s) {
    var p = (Math.random().toString(16) + "000000000").substr(2, 8);
    return s ? "-" + p.substr(0, 4) + "-" + p.substr(4, 4) : p;
  }
  return _p8() + _p8(true) + _p8(true) + _p8();
}

class Point {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }
}


class Path {
  /* 
    Data will be encoded into the following string to minimize data transfer 
    and storage: "color:width:x,y;x,y;x,y"
  */
  constructor(color, width, points) {
    this.color = color;
    this.width = width;
    this.points = points ? points : []
  }

  addPoint(point) {
    this.points.push(point);
  }

  encode() {
    let pointsString = this.points.map(
      point => `${point.x},${point.y}`
    ).join(';')
    return `${this.color}:${this.width}:${pointsString}`
  }

  static decode(encodedPath) {
    let [color, width, encPoints] = encodedPath.split(':')
    console.log(encPoints)
    let points = encPoints.split(';').map(encPoint => {
      let [x, y] = encPoint.split(',')
      return new Point(x, y)
    })
    console.log(points)
    return new this(color, width, points)
  }
}


class Socket {
  constructor(url, roomKey, receivePathMethod, receiveBackfillMethod) {
    this.socket = io.connect(url);
    this.connected = false;
    this.receivePathMethod = receivePathMethod;
    this.receiveBackfillMethod = receiveBackfillMethod;
    this.setupHandlers(roomKey);
  }
  setupHandlers(roomKey) {
    this.socket.on('connect', () => {
      this.connected = true;
      this.socket.emit('login', { room: roomKey })
    });
    this.socket.on('disconnect', () => {
      this.connected = false;
    });
    this.socket.on('display', (encPath) => {
      this.receivePathMethod(Path.decode(encPath));
    });
    this.socket.on('backfill', (data) => {
      let paths = data.paths.map(encPath => Path.decode(encPath));
      this.receiveBackfillMethod(paths);
    });
  }
  sendPath(path, roomKey) {
    this.socket.emit('draw', {
      room: roomKey,
      path: path.encode()
    })
  }
}


class Whiteboard {
  constructor(sendPathMethod) {
    this.whiteboard = document.getElementById("whiteboard");
    this.canvas = document.getElementById("canvas");
    this.context = canvas.getContext("2d");
    this.mousePressed = false;

    this.sendPathMethod = sendPathMethod;

    this.paths = [];
    this.currentPath = null;
    this.prevPoint = null;

    this.toolColor = "black";
    this.toolWidth = MARKER_SIZE;

    this.addEventListeners();
  }

  addEventListeners() {
    this.whiteboard.addEventListener("mousemove", this.handleMouseEvent.bind(this));
    this.whiteboard.addEventListener("mousedown", this.handleMouseEvent.bind(this));
    this.whiteboard.addEventListener("mouseup", this.handleMouseEvent.bind(this));
    this.whiteboard.addEventListener("mouseout", this.handleMouseEvent.bind(this));
  }

  handleMouseEvent(event) {
    if (event.type === "mouseup" || event.type === "mouseout") {
      this.prevPoint = null;
      this.mousePressed = false;
      if (this.currentPath && this.currentPath.points.length > 0) {
        this.sendCoordinates()
      }
    }
    if (event.type === "mousedown") {
      this.mousePressed = true;
      this.currentPath = new Path(this.toolColor, this.toolWidth)
    }
    if (this.mousePressed) {
      this.storeCoordinates(new Point(event.offsetX, event.offsetY));
    }
  }

  drawPath(path) {
    let prevPoint = null;
    this.context.lineJoin = "round";
    this.context.strokeStyle = path.color;
    this.context.lineWidth = path.width;

    path.points.forEach((point, index) => {
      if (index !== 0) {
        this.context.beginPath();
        this.context.moveTo(prevPoint.x, prevPoint.y);
        this.context.lineTo(point.x, point.y);
        this.context.closePath();
        this.context.stroke();
      }
      prevPoint = point;
    });
  }

  setTool(color, width) {
    this.toolColor = color;
    this.toolWidth = width;
  }

  storeCoordinates(point) {
    this.currentPath.addPoint(point);
    if (this.currentPath.points.length > 1) {
      this.drawPath(this.currentPath);
    }
  }

  sendCoordinates() {
    this.paths.push(this.currentPath);
    this.sendPathMethod(this.currentPath);
    this.currentPath = null;
  }

  receivePath(path) {
    this.drawPath(path);
  }

  receiveBackfill(backfill) {
    backfill.forEach(path => {
      this.drawPath(path);
    })
  }
}


class Ledge {
  constructor(setToolMethod) {
    this.setToolMethod = setToolMethod;
    this.addEventListeners();
  }

  addEventListeners() {
    document.querySelectorAll("#ledge input[type='radio']").forEach(el => {
      el.addEventListener("change", this.changeTool.bind(this));
    });
  }

  changeTool(event) {
    if (event.target.value == "eraser") {
      this.setToolMethod("white", ERASER_SIZE)
    } else {
      this.setToolMethod(event.target.value, MARKER_SIZE);
    }
  }
}


class App {
  constructor(url) {
    this.roomKey = location.hash.substring(1) || generateGuid();
    location.hash = this.roomKey;
    this.socket = new Socket(
      url,
      this.roomKey,
      this.receivePath.bind(this),
      this.receiveBackfill.bind(this),
    );
    this.whiteboard = new Whiteboard(this.sendPath.bind(this));
    this.ledge = new Ledge(this.setTool.bind(this));
  }
  sendPath(path) {
    this.socket.sendPath(path, this.roomKey);
  }
  receivePath(path) {
    this.whiteboard.receivePath(path);
  }
  receiveBackfill(backfill) {
    this.whiteboard.receiveBackfill(backfill);
  }
  setTool(color, size) {
    this.whiteboard.setTool(color, size);
  }
}

let app = new App("http://localhost:5000");
