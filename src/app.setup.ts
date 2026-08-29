import { type INestApplication, RequestMethod } from "@nestjs/common";

import { createValidationPipe } from "./common/validation/validation-pipe";

export function configureApplication(app: INestApplication): void {
  app.setGlobalPrefix("api", {
    exclude: [
      { path: ".well-known", method: RequestMethod.ALL },
      { path: ".well-known/{*path}", method: RequestMethod.ALL },
    ],
  });
  app.useGlobalPipes(createValidationPipe());
}
