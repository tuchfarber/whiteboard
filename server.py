import socketio
import eventlet

sio = socketio.Server()
app = socketio.WSGIApp(sio)

rooms = {}

@sio.on('connect')
def connect(sid, environ):
    print('connect ', sid)

@sio.on('login')
def login(sid, data):
    room = data['room']
    sio.enter_room(sid, room)
    sio.enter_room(sid, sid)
    print(sid)
    if room not in rooms:
        rooms[room] = []
    sio.emit('backfill', {'paths': rooms[room]}, room=sid)

@sio.on('draw')
def message(sid, data):
    room = data['room']
    path = data['path']

    if room in rooms:
        rooms[room].append(path)
    else:
        rooms[room] = [path]

    sio.emit('display', path, room=room, skip_sid=sid)

@sio.on('disconnect')
def disconnect(sid):
    print('disconnect ', sid)

if __name__ == '__main__':
    eventlet.wsgi.server(eventlet.listen(('', 5000)), app)

