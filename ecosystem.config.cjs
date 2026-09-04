const path = require("path");

const root = __dirname;
const apiPort = process.env.FUEL_API_PORT || "5000";
const frontendPort = process.env.FUEL_FRONTEND_PORT || "3020";

// Names must stay distinct from the existing admin-dashboard processes:
// fuel-backend-api / fuel-backend-worker on /var/www/fuel-staging (port 4000).
module.exports = {
  apps: [
    {
      name: "fuel-optimizer-api",
      cwd: path.join(root, "backend"),
      script: "dist/server.js",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        APP_ENV: "prod",
        PORT: apiPort,
        SYNC_SCHEDULER_ENABLED: "false",
      },
    },
    {
      name: "fuel-optimizer-worker",
      cwd: path.join(root, "backend"),
      script: "dist/worker.js",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        APP_ENV: "prod",
        SYNC_SCHEDULER_ENABLED: "true",
      },
    },
    {
      name: "fuel-optimizer-web",
      cwd: path.join(root, "frontend"),
      script: "node_modules/next/dist/bin/next",
      args: `start -p ${frontendPort}`,
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: frontendPort,
      },
    },
  ],
};
