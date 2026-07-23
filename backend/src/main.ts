import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3100',
    credentials: true,
  });
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3101;
  await app.listen(port);
}

void bootstrap();
