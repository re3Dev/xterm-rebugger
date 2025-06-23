// server.js – Express + Socket.io + node-pty with whitelist aliases and full shell access
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

// Whitelisted command aliases
const COMMAND_ALIASES = {
  get_log_info:     'sudo python log_info.py',
  restart_mycool:   'sudo systemctl restart mycool.service',
  // add more aliases here
};

io.on('connection', socket => {
  // Spawn persistent interactive shell as 'pi'
  // Requires server to run as root to use su without password prompt
  const shell = pty.spawn('su', ['-l', 'pi'], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: '/home/pi',
    env: { ...process.env, HOME: '/home/pi', USER: 'pi', TERM: 'xterm-256color' }
  });

  // Stream data back to client
  shell.on('data', data => socket.emit('stdout', data));

  // Handle incoming commands
  socket.on('command', input => {
    // If no input, send just Enter
    if (!input) return shell.write('\r');

    // Map alias or run raw input
    const cmd = COMMAND_ALIASES[input] || input;
    shell.write(cmd + '\r');
  });

  // Handle terminal resize
  socket.on('resize', ({cols, rows}) => shell.resize(cols, rows));

  // Cleanup on disconnect
  socket.on('disconnect', () => shell.kill());
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Web terminal listening on port ${PORT}`));
