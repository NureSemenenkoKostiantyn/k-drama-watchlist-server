import { Controller, Get } from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";

import { OPENAPI_DOCUMENT } from "./generated-openapi";

@Controller("openapi.json")
@AllowAnonymous()
export class ContractsController {
  @Get()
  getContract(): typeof OPENAPI_DOCUMENT {
    return OPENAPI_DOCUMENT;
  }
}
