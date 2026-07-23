import { validateEnvironment } from './validate-environment';

describe('validateEnvironment', () => {
  it('applies safe local defaults', () => {
    const result = validateEnvironment({
      DATABASE_URL: 'postgresql://localhost/depanneur',
      JWT_SECRET: 'a-secure-secret-that-is-longer-than-32-characters',
    });

    expect(result).toMatchObject({
      PORT: '3101',
      FRONTEND_URL: 'http://localhost:3100',
      OPENAI_MODEL: 'gpt-4o-mini',
    });
  });

  it('rejects a missing database URL', () => {
    expect(() =>
      validateEnvironment({
        JWT_SECRET: 'a-secure-secret-that-is-longer-than-32-characters',
      }),
    ).toThrow('DATABASE_URL');
  });

  it('rejects a weak JWT secret', () => {
    expect(() =>
      validateEnvironment({
        DATABASE_URL: 'postgresql://localhost/depanneur',
        JWT_SECRET: 'too-short',
      }),
    ).toThrow('at least 32 characters');
  });
});
