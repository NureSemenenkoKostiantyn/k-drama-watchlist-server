import { All, Controller, Post, Req, Res } from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { AuthService } from "@thallesp/nestjs-better-auth";
import { toNodeHandler } from "better-auth/node";
import { type Request, type Response } from "express";

import { type DramaWatchAuth } from "../../auth/auth.factory";
import { McpService } from "./mcp.service";

@Controller("mcp")
export class McpController {
  constructor(private readonly mcpService: McpService) {}

  @Post()
  @AllowAnonymous()
  handle(@Req() request: Request, @Res() response: Response): Promise<void> {
    return this.mcpService.handle(request, response);
  }
}

@Controller(".well-known")
export class McpWellKnownController {
  private readonly authHandler: ReturnType<typeof toNodeHandler>;

  constructor(authService: AuthService<DramaWatchAuth>) {
    this.authHandler = toNodeHandler(authService.instance);
  }

  @All("{*path}")
  @AllowAnonymous()
  handle(@Req() request: Request, @Res() response: Response): Promise<void> {
    return this.authHandler(request, response);
  }
}
