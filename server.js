// server.js – Express + Socket.io + node-pty allowing both whitelisted and arbitrary commands
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

// Define aliases for whitelisted commands
const COMMAND_ALIASES = {
  get_log_info: 'sudo python log_info.py',
  restart_mycool: 'sudo systemctl restart mycool.service',
  // Add more aliases here
};

io.on('connection', socket => {
  socket.emit('prompt');

  socket.on('command', input => {
    if (!input) return socket.emit('prompt');

    // Determine command to run: alias or raw input
    const cmdToRun = COMMAND_ALIASES[input] || input;

    // Spawn bash -c "cmdToRun"
    const shell = pty.spawn('bash', ['-c', cmdToRun], {
      name: 'xterm-color',
      cwd: process.env.HOME,
      env: process.env,
    });

    // Stream output back
    shell.on('data', data => socket.emit('stdout', data));
    shell.on('exit', code => {
      socket.emit('stdout', `\r\n[Process exited with code ${code}]\r\n`);
      socket.emit('prompt');
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Web terminal listening on port ${PORT}`));
