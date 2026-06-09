const path = require('path');

module.exports = {
  apps: [
    {
      name: 'cloud-pos-saas',
      script: 'Backend/src/server.js',
      cwd: path.resolve(__dirname, '..'),
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
};
