export default {
  apps: [
    {
      name: "sales-display",
      script: "npx",
      args: "tsx src/server/index.ts",
      cwd: "/home/pi/sales-display",
      env: {
        NODE_ENV: "production",
      },
      restart_delay: 3000,
      max_restarts: 50,
    },
  ],
};
