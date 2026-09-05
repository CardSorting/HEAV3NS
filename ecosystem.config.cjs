module.exports = {
  apps: [
    {
      name: 'galxai-relay',
      script: './node_modules/.bin/tsx',
      args: 'src/relay/relay-server.ts',
      cwd: '/Users/bozoegg/Desktop/LUMI-NEW',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        HOST: '0.0.0.0'
      },
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/Users/bozoegg/.lumi/logs/relay.err',
      out_file: '/Users/bozoegg/.lumi/logs/relay.log',
      merge_logs: true
    }
  ]
};
