// server.js – Express + Socket.io + node-pty with PAM-based login and persistent shell sessions
const express = require('express');
const http    = require('http');
const socketIo= require('socket.io');
const pty     = require('node-pty');
const PAM     = require('authenticate-pam');
const path    = require('path');

const app    = express();
const server = http.createServer(app);
const io     = socketIo(server);

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// Optional command aliases (whitelist) – can expand over time
const COMMAND_ALIASES = {
  get_log_info: 'sudo python log_info.py',
  restart_mycool: 'sudo systemctl restart mycool.service',
  // add more here
};

io.on('connection', socket => {
  let shell;
  let authenticated = false;

  // Ask client to authenticate immediately
  socket.emit('requestAuth');

  // Handle authentication
  socket.on('auth', ({ username, password }) => {
    PAM.authenticate(username, password, err => {
      if (err) {
        socket.emit('authError', 'Authentication failed');
        return;
      }
      authenticated = true;
      socket.emit('authSuccess');

      // Spawn a login shell as the authenticated user
      // Running server as root required to su without password
      shell = pty.spawn('su', ['-l', username], {
        name: 'xterm-256color',
        cwd: `/home/${username}`,
        env: { ...process.env, HOME: `/home/${username}`, USER: username }
      });

      // Forward shell output to client
      shell.on('data', data => socket.emit('stdout', data));
      shell.on('exit', code => {
        socket.emit('stdout', `\r\n[Session ended with code ${code}]\r\n`);
        authenticated = false;
      });
    });
  });

  // Handle user commands
  socket.on('command', input => {
    if (!authenticated) {
      socket.emit('stderr', 'Not authenticated.\r\n');
      return;
    }
    if (!shell) return;

    // Map aliases or allow raw input
    const cmd = COMMAND_ALIASES[input] || input;
    shell.write(cmd + '\r');
  });

  // Clean up on disconnect
  socket.on('disconnect', () => {
    if (shell) shell.kill();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Terminal service listening on port ${PORT}`));
