module.exports = {
  apps: [
    {
      name: 'galxai-relay',
      script: './node_modules/.bin/tsx',
      args: 'src/relay/relay-server.ts',
      cwd: '/Users/bozoegg/Desktop/LUMI-NEW',
      node_args: '--max-old-space-size=512',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        HOST: '127.0.0.1'
      },
      autorestart: true,
      min_uptime: '10s',
      max_restarts: 20,
      restart_delay: 2000,
      kill_timeout: 5000,
      listen_timeout: 10000,
      watch: false,
      max_memory_restart: '800M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/Users/bozoegg/.lumi/logs/relay.err',
      out_file: '/Users/bozoegg/.lumi/logs/relay.log',
      merge_logs: true
    }
  ]
};
