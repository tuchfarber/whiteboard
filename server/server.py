import os
import socketio
import eventlet
import redis


class RoomManager:
    ROOM_PREFIX = 'room:'
    def __init__(self, hostname, port):
        self.store = redis.Redis(host=hostname, port=port, db=0)

    def add_path_to_room(self, room_name, path):
        self.store.rpush(self.ROOM_PREFIX + str(room_name), path)

    def get_paths_in_room(self, room_name):
        paths = self.store.lrange(self.ROOM_PREFIX + str(room_name), 0, -1)
        return [path.decode("utf-8") for path in paths]


redis_host = os.environ.get('REDIS_HOST', 'localhost')
redis_port = os.environ.get('REIDS_PORT', 6379)
room_manager = RoomManager(redis_host, redis_port)

sio = socketio.Server()
app = socketio.WSGIApp(sio)

@sio.on('connect')
def connect(sid, environ):
    print('connect ', sid)

@sio.on('login')
def login(sid, data):
    room = data['room']
    sio.enter_room(sid, room)
    sio.enter_room(sid, sid)
    paths = room_manager.get_paths_in_room(room)

    print(paths)
    sio.emit('backfill', {'paths': paths}, room=sid)

@sio.on('draw')
def message(sid, data):
    room = data['room']
    path = data['path']
    room_manager.add_path_to_room(room, path)
    sio.emit('display', path, room=room, skip_sid=sid)

@sio.on('disconnect')
def disconnect(sid):
    print('disconnect ', sid)

if __name__ == '__main__':
    eventlet.wsgi.server(eventlet.listen(('', 8715)), app)
