import "reflect-metadata";
import { buildApp } from "./app";
import { config } from "./config";

function main() {
  const app = buildApp();

  app.listen({ port: config.port ?? 3000, host: "0.0.0.0" }, (err, address) => {
    if (err) {
      app.log.error(err);
      process.exit(1);
    }
    app.log.info(`Server running at ${address}`);
  });
}

main();
