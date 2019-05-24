const TOOL_COLORS = {
  white: '#ffffff',
  red: '#ff0000',
  green: '#00ff00',
  blue: '#0000ff',
  black: '#000000',
}
const TOOL_WIDTHS = {
  small: 2,
  medium: 4,
  large: 8,
};

const NOT_IMPLEMENTED_ERROR = {
  name: "NotImplentedError",
  message: "Method not implemented"
}

const generateGuid = () => {
  function _p8(s) {
    var p = (Math.random().toString(16) + "000000000").substr(2, 8);
    return s ? "-" + p.substr(0, 4) + "-" + p.substr(4, 4) : p;
  }
  return _p8() + _p8(true) + _p8(true) + _p8();
}

function eventPromiseGenerator(element, eventtype) {
  return new Promise((resolve, reject) => {
    element.addEventListener(eventtype, (event) => {
        resolve(event.target.value);
    }, {once: true});
  });
}

async function waitForEventByQuery(query, eventtype) {
  let elements = Array.from(document.querySelectorAll(query))
  let promises = elements.map(el => eventPromiseGenerator(el, eventtype));
  return await Promise.race(promises);
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
    let points = encPoints.split(';').map(encPoint => {
      let [x, y] = encPoint.split(',')
      return new Point(x, y)
    })
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
    this.whiteboardInput = new Ledge();
    this.mousePressed = false;

    this.sendPathMethod = sendPathMethod;

    this.paths = [];
    this.currentPath = null;
    this.prevPoint = null;

    this.toolColor = TOOL_COLORS.black;
    this.toolWidth = TOOL_WIDTHS.small;
    this.blankCanvas()
    this.addWatchers();
  }

  blankCanvas(){
    this.context.fillStyle = "white";
    this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  addWatchers() {
    this.whiteboard.addEventListener("mousemove", this.handleMouseEvent.bind(this));
    this.whiteboard.addEventListener("mousedown", this.handleMouseEvent.bind(this));
    this.whiteboard.addEventListener("mouseup", this.handleMouseEvent.bind(this));
    this.whiteboard.addEventListener("mouseout", this.handleMouseEvent.bind(this));
    this.toolWatcher()
    this.downloadWatcher()
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
    if (path.color == '#ffffff') {
      this.context.lineWidth = path.width * 2;
    } else {
      this.context.lineWidth = path.width;
    }

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

  drawPoint(path) {
    let point = path.points[0]
    this.context.fillStyle = path.color;
    this.context.beginPath();
    this.context.arc(point.x, point.y, path.width, 0, 2 * Math.PI, true);
    this.context.fill();
  }

  async toolWatcher(){
    var value = null;
    while(true){
      value = await this.whiteboardInput.waitForToolChange()
      if (Object.keys(TOOL_COLORS).includes(value)){
        this.toolColor = TOOL_COLORS[value];
      } else if (Object.keys(TOOL_WIDTHS).includes(value)){
        this.toolWidth = TOOL_WIDTHS[value];
      }
    }
  }

  async downloadWatcher(){
    let filename = '';
    let downloadLink = '';
    let timestamp = '';
    while(true){
      await this.whiteboardInput.waitForDownload()
      downloadLink = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
      timestamp = Math.floor((new Date).getTime()/1000);
      filename = `whiteboard-${timestamp}.png`
      this.whiteboardInput.setDownloadLink(downloadLink, filename)
      // Save image
    }
  }

  storeCoordinates(point) {
    this.currentPath.addPoint(point);
    if (this.currentPath.points.length > 1) {
      this.drawPath(this.currentPath);
    }
  }

  sendCoordinates() {
    this.paths.push(this.currentPath);
    if (this.currentPath.points.length == 1) {
      this.drawPoint(this.currentPath)
    }
    this.sendPathMethod(this.currentPath);
    this.currentPath = null;
  }

  receivePath(path) {
    if (path.points.length == 1) {
      this.drawPoint(path);
    } else {
      this.drawPath(path);
    }
  }

  receiveBackfill(backfill) {
    backfill.forEach(path => {
      if (path.points.length == 1) {
        this.drawPoint(path);
      } else {
        this.drawPath(path);
      }
    })
  }
}

class WhiteboardMenu {
  waitForToolChange(){throw NOT_IMPLEMENTED_ERROR}
  waitForDownload(){throw NOT_IMPLEMENTED_ERROR}
  setDownloadLink(){throw NOT_IMPLEMENTED_ERROR}
}

class Ledge extends WhiteboardMenu {
  constructor() {
    super()
  }

  async waitForToolChange(){
    return waitForEventByQuery('#ledge input[type="radio"]', 'change');
  }

  async waitForDownload(){
    return waitForEventByQuery('#ledge button[value="download"]', 'click');
  }

  setDownloadLink(link, filename){
    let downloadLink = document.getElementById('download-link');
    downloadLink.href = link;
    downloadLink.download = filename;
    downloadLink.innerText = filename;
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
}

let app = new App("http://localhost:8710");