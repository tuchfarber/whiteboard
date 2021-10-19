# Whiteboard - A simple collaborative drawing board

This was built when I first went remote as a proof of concept before we found a good mutliuser whiteboarding app. It's functional but still a work in progress.

## How to use it

1. Run `docker-compose up -d --build`
2. Open `http://localhost:8710` in your browser.
3. Draw
4. Download your drawing by clicking "Download" and then clicking the generated link.

To test collaboration, just open the same URL (complete with hash) in the navigation bar in a new tab or window.

## How it works
The backend creates rooms that clients connect to via websockets (socketio). The drawings are done in JS via the `canvas` feature. The drawing paths are all tracked, encoded, and sent to the server to propogate outward to the other clients. This is a hub and spoke model, with no peer to peer.

## Screenshot

![Screenshot](/screenshot.png)
