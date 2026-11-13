import './env'; // must be first: loads .env before the config is read
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/http-exception.filter';
import { EnvelopeInterceptor } from './common/envelope.interceptor';
import { assertConfig, config } from './config';

async function bootstrap(): Promise<void> {
  assertConfig();
  const app = await NestFactory.create(AppModule);

  // All REST routes live under /api/v1 (docs/API-CONTRACT.md §1).
  app.setGlobalPrefix('api/v1');

  // Only the listed frontend origins may call the API; credentials allow the refresh cookie.
  app.enableCors({
    origin: config.corsOrigins,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
  });

  app.useGlobalFilters(new AllExceptionsFilter()); // { error: { code, message, details } }
  app.useGlobalInterceptors(new EnvelopeInterceptor()); // { data, meta }
  app.enableShutdownHooks();

  await app.listen(config.port);
  Logger.log(`API:     http://localhost:${config.port}/api/v1`, 'Bootstrap');
  Logger.log(`Sockets: http://localhost:${config.port}/game`, 'Bootstrap');
}

void bootstrap();
