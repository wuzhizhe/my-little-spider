let io = null,
  server = null;
  // spide = require('../spider/index');

function socket(server) {
  io = require('socket.io')(server);
  setIoEvent();
}

function setIoEvent() {
  io.on('connection', (socket) => {
    server = socket;
    // when the user disconnects.. perform this
    socket.on('disconnect', () => {
    });

    socket.on('startquanben', (data) => {
      let spide = require('../spider/index');
      console.log('start');
      spide.getNovelByPhantom(data);
    })
  });
}



function emitMessage(msg) {
  server.emit('message', msg)
}

function emitEndMessage() {
  server.emit('end', 'end')
}

function emitPartMessage(msg) {
  server.emit('finishpart', msg);
}

module.exports = {
  socket,
  emitMessage,
  emitEndMessage,
  emitPartMessage
};