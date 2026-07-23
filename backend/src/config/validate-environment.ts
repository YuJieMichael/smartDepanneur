const REQUIRED_VARIABLES = ['DATABASE_URL', 'JWT_SECRET'] as const;

export function validateEnvironment(
  values: Record<string, unknown>,
): Record<string, unknown> {
  const missing = REQUIRED_VARIABLES.filter((name) => {
    const value = values[name];
    return typeof value !== 'string' || value.trim().length === 0;
  });

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}`,
    );
  }

  const jwtSecret = String(values.JWT_SECRET);
  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters');
  }

  const port = Number(values.PORT ?? 3101);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  return {
    ...values,
    PORT: String(port),
    FRONTEND_URL: values.FRONTEND_URL ?? 'http://localhost:3100',
    OPENAI_MODEL: values.OPENAI_MODEL ?? 'gpt-4o-mini',
  };
}
