import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { Resend } from "resend";

import { type Environment } from "../../config/environment";
import { RESEND_CLIENT } from "./email.constants";
import { ResendEmailService } from "./resend-email.service";
import { TransactionalEmailService } from "./transactional-email.service";

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: RESEND_CLIENT,
      inject: [ConfigService],
      useFactory: (
        configService: ConfigService<Environment, true>,
      ): Resend =>
        new Resend(configService.getOrThrow<string>("RESEND_API_KEY")),
    },
    {
      provide: TransactionalEmailService,
      useClass: ResendEmailService,
    },
  ],
  exports: [TransactionalEmailService],
})
export class EmailModule {}
