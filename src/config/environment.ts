import { plainToInstance, Type } from "class-transformer";
import {
  IsEnum,
  IsIn,
  IsInt,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
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

  @IsIn(logLevels)
  LOG_LEVEL: (typeof logLevels)[number] = "info";
}

export type Environment = EnvironmentVariables;

const environmentKeys = [
  "NODE_ENV",
  "PORT",
  "MONGODB_URI",
  "MONGODB_DB_NAME",
  "LOG_LEVEL",
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
