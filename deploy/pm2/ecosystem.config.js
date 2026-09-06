// pm2 process definitions for parts.lecompany.co.uk.
//
// This box also runs the `lecompany` app. Always act on processes by name —
// never `pm2 restart all`, never `pkill node`.
//
// Secrets live in /home/parts.lecompany.co.uk/server/.env, read by Node's own
// --env-file. There is no dotenv package on production because there is no
// node_modules on production: the API ships as a single bundled file.

const ROOT = '/home/parts.lecompany.co.uk';

module.exports = {
  apps: [
    {
      name: 'parts-web',
      cwd: `${ROOT}/public_html`,
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      merge_logs: true,
      max_memory_restart: '1G',
      out_file: `${ROOT}/logs/web-out.log`,
      error_file: `${ROOT}/logs/web-err.log`,
      env: {
        NODE_ENV: 'production',
        PORT: 3030,
        HOSTNAME: '127.0.0.1',
      },
    },
    {
      name: 'parts-api',
      cwd: `${ROOT}/server`,
      script: 'dist/server.mjs',
      node_args: `--env-file=${ROOT}/server/.env`,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      merge_logs: true,
      max_memory_restart: '1G',
      out_file: `${ROOT}/logs/api-out.log`,
      error_file: `${ROOT}/logs/api-err.log`,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
