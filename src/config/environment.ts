import { plainToInstance, Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateIf,
  type ValidationError,
  validateSync,
} from "class-validator";

export enum NodeEnvironment {
  Development = "development",
  Production = "production",
  Test = "test",
}

const logLevels = [
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
  "silent",
] as const;

export class EnvironmentVariables {
  @IsEnum(NodeEnvironment)
  NODE_ENV: NodeEnvironment = NodeEnvironment.Development;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65_535)
  PORT = 8080;

  @IsString()
  @Matches(/^mongodb(?:\+srv)?:\/\//, {
    message: "MONGODB_URI must use the mongodb:// or mongodb+srv:// scheme",
  })
  MONGODB_URI!: string;

  @IsString()
  @MinLength(1)
  MONGODB_DB_NAME = "drama_watch";

  @IsString()
  @MinLength(32)
  BETTER_AUTH_SECRET!: string;

  @IsUrl({
    protocols: ["http", "https"],
    require_protocol: true,
    require_tld: false,
  })
  BETTER_AUTH_URL = "http://localhost:8080";

  @IsUrl({
    protocols: ["http", "https"],
    require_protocol: true,
    require_tld: false,
  })
  FRONTEND_URL = "http://localhost:4200";

  @IsString()
  @MinLength(1)
  TMDB_ACCESS_TOKEN!: string;

  @IsString()
  @MinLength(1)
  RESEND_API_KEY!: string;

  @IsString()
  @MinLength(3)
  EMAIL_FROM!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  RATE_LIMIT_TTL_MS = 60_000;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  RATE_LIMIT_MAX = 120;

  @IsIn(logLevels)
  LOG_LEVEL: (typeof logLevels)[number] = "info";

  @Transform(({ value }: { value: unknown }) =>
    value === true || value === "true",
  )
  @IsBoolean()
  TELEGRAM_ENABLED = false;

  @ValidateIf((environment: EnvironmentVariables) =>
    environment.TELEGRAM_ENABLED,
  )
  @IsString()
  @Matches(/^\d+:[A-Za-z0-9_-]+$/, {
    message: "TELEGRAM_BOT_TOKEN must be a Telegram bot token",
  })
  TELEGRAM_BOT_TOKEN = "";

  @ValidateIf((environment: EnvironmentVariables) =>
    environment.TELEGRAM_ENABLED,
  )
  @IsString()
  @Matches(/^[A-Za-z][A-Za-z0-9_]{3,30}bot$/i, {
    message: "TELEGRAM_BOT_USERNAME must be a valid bot username ending in bot",
  })
  TELEGRAM_BOT_USERNAME = "";

  @ValidateIf((environment: EnvironmentVariables) =>
    environment.TELEGRAM_ENABLED,
  )
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{32,256}$/, {
    message: "TELEGRAM_WEBHOOK_SECRET must contain 32 to 256 safe characters",
  })
  TELEGRAM_WEBHOOK_SECRET = "";

  @ValidateIf((environment: EnvironmentVariables) =>
    environment.TELEGRAM_ENABLED,
  )
  @IsUrl({
    protocols: ["http", "https"],
    require_protocol: true,
    require_tld: false,
  })
  TELEGRAM_MINI_APP_URL = "http://localhost:4200/telegram";

  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(60)
  TELEGRAM_LINK_TTL_MINUTES = 10;

  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(3_600)
  TELEGRAM_INIT_DATA_MAX_AGE_SECONDS = 3_600;
}

export type Environment = EnvironmentVariables;

const environmentKeys = [
  "NODE_ENV",
  "PORT",
  "MONGODB_URI",
  "MONGODB_DB_NAME",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "FRONTEND_URL",
  "TMDB_ACCESS_TOKEN",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "RATE_LIMIT_TTL_MS",
  "RATE_LIMIT_MAX",
  "LOG_LEVEL",
  "TELEGRAM_ENABLED",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_BOT_USERNAME",
  "TELEGRAM_WEBHOOK_SECRET",
  "TELEGRAM_MINI_APP_URL",
  "TELEGRAM_LINK_TTL_MINUTES",
  "TELEGRAM_INIT_DATA_MAX_AGE_SECONDS",
] as const;

export function validateEnvironment(
  input: Record<string, unknown>,
): Environment {
  const knownInput = environmentKeys.reduce<Record<string, unknown>>(
    (result, key) => {
      if (input[key] !== undefined) {
        result[key] = input[key];
      }

      return result;
    },
    {},
  );
  const validatedEnvironment = plainToInstance(
    EnvironmentVariables,
    knownInput,
    { enableImplicitConversion: false },
  );

  const errors = validateSync(validatedEnvironment, {
    forbidUnknownValues: true,
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(
      `Environment validation failed: ${formatValidationErrors(errors).join("; ")}`,
    );
  }

  return validatedEnvironment;
}

function formatValidationErrors(errors: ValidationError[]): string[] {
  return errors.flatMap((error) => {
    const messages = Object.values(error.constraints ?? {}).map(
      (message) => `${error.property}: ${message}`,
    );
    const children = formatValidationErrors(error.children ?? []).map(
      (message) => `${error.property}.${message}`,
    );

    return [...messages, ...children];
  });
}
