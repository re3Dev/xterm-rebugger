// server.js – Express + Socket.io + node-pty with persistent interactive login shell
const express = require('express');
const http    = require('http');
const socketIo= require('socket.io');
const pty     = require('node-pty');
const path    = require('path');

const app    = express();
const server = http.createServer(app);
const io     = socketIo(server);

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', socket => {
  // Determine the user's shell (default to bash)
  const shellPath = process.env.SHELL || '/bin/bash';
  // Spawn a single persistent interactive login shell
  const shell = pty.spawn(shellPath, ['-li'], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: process.env.HOME,
    env: { ...process.env, TERM: 'xterm-256color' }
  });

  // Forward shell output to client
  shell.on('data', data => socket.emit('stdout', data));

  // Handle incoming commands by writing to the existing terminal
  socket.on('command', input => {
    if (!input) {
      shell.write('\r');
    } else {
      shell.write(input + '\r');
    }
  });

  // Resize handling
  socket.on('resize', ({cols, rows}) => {
    shell.resize(cols, rows);
  });

  // Clean up on disconnect
  socket.on('disconnect', () => {
    shell.kill();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Web terminal listening on port ${PORT}`));
