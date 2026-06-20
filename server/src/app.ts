import Fastify from "fastify";
import routes from "./routes";

export function buildApp() {
  const app = Fastify({
    trustProxy: true,
    logger: {
      transport: {
        target: "pino-pretty",
        options: {
          translateTime: "SYS:yyyy-mm-dd HH:MM:ss",
          ignore: "pid,hostname",
        },
      },
    },
  });

  app.register(routes);

  return app;
}
