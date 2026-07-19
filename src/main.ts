import { Logger as NestLogger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { Logger as PinoLogger } from "nestjs-pino";

import { AppModule } from "./app.module";
import { configureApplication } from "./app.setup";
import { type Environment } from "./config/environment";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    bufferLogs: true,
  });

  app.useLogger(app.get(PinoLogger));
  app.flushLogs();
  configureApplication(app);
  app.enableShutdownHooks();

  const configService = app.get(ConfigService<Environment, true>);
  const port = configService.getOrThrow<number>("PORT");

  await app.listen(port, "0.0.0.0");
}

bootstrap().catch((error: unknown) => {
  const logger = new NestLogger("Bootstrap");
  const stack = error instanceof Error ? error.stack : undefined;
  logger.error("Application startup failed", stack);
  process.exitCode = 1;
});
