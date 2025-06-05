module.exports = {
    apps: [{
      name: 'core-services-standalone',
      script: 'dist/app.js',
      args: ['core-dev', '--standalone'],
      cwd: 'C:\\CORE\\GitHub\\core-services',
      env: {
        NODE_ENV: 'production',
        CLIENT_ID: 'core-dev'
      },
      // Windows Service specific
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      restart_delay: 5000,
      max_restarts: 10,
      // Logs
      log_file: 'logs/core-services.log',
      out_file: 'logs/core-services-out.log',
      error_file: 'logs/core-services-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }]
  };