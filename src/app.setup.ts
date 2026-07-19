import { type INestApplication } from "@nestjs/common";

import { createValidationPipe } from "./common/validation/validation-pipe";

export function configureApplication(app: INestApplication): void {
  app.setGlobalPrefix("api");
  app.useGlobalPipes(createValidationPipe());
}
