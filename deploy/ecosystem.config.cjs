module.exports = {
  apps: [
    {
      name: "sentinel-web",
      cwd: "/opt/sentinel-flash/current",
      script: ".output/server/index.mjs",
      interpreter: "/opt/node22/bin/node",
      env: {
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: "3000",
      },
      max_memory_restart: "750M",
      time: true,
    },
    {
      name: "sentinel-api",
      cwd: "/opt/sentinel-flash/current",
      script: "node_modules/tsx/dist/cli.mjs",
      args: "backend/src/server.ts",
      interpreter: "/opt/node22/bin/node",
      env: {
        NODE_ENV: "production",
        BACKEND_PORT: "8787",
        SENTINEL_DB_PATH: "/opt/sentinel-flash/data/sentinel.db",
      },
      max_memory_restart: "750M",
      time: true,
    },
  ],
};
