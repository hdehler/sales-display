/**
 * PM2 ecosystem file — must be CommonJS (.cjs) so PM2 parses it reliably.
 * (ecosystem.config.js + "type":"module" in package.json breaks PM2 and causes
 * "No script path - aborting".)
 */

module.exports = {
  apps: [
    {
      name: "sales-display",
      cwd: __dirname,
      script: "npm",
      args: "run start",
      env: {
        NODE_ENV: "production",
      },
      restart_delay: 3000,
      max_restarts: 50,
    },
  ],
};
