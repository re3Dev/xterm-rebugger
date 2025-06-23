// server.js
const express = require('express');
const http    = require('http');
const socketio= require('socket.io');
const pty     = require('node-pty');

const app    = express();
const server = http.createServer(app);
const io     = socketio(server);

app.use(express.static('public'));

// Whitelisted commands
const COMMANDS = {
  get_log_info: { cmd: 'sudo', args: ['python', 'log_info.py'] },
  restart_mycool: { cmd: 'sudo', args: ['systemctl', 'restart', 'mycool.service'] },
  network: { cmd: 'ifconfig', args: [] },
  // add as many as you like...
};

io.on('connection', socket => {
  // whenever frontend asks to run a command
  socket.on('command', name => {
    if (!COMMANDS[name]) {
      socket.emit('stderr', `Unknown command: ${name}\r\n`);
      return socket.emit('prompt');
    }

    const { cmd, args } = COMMANDS[name];
    // spawn a fresh pty for just this command
    const proc = pty.spawn(cmd, args, {
      name: 'xterm-color',
      cwd: process.env.HOME,
      env: process.env
    });

    // wire output back to client
    proc.on('data', data => socket.emit('stdout', data));

    proc.on('exit', () => socket.emit('prompt'));
  });

  // send a prompt when they first connect
  socket.emit('prompt');
});

server.listen(3000, () => console.log('http://localhost:3000'));
