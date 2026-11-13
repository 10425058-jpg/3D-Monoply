import './env'; // must be first: loads .env before the config is read
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/http-exception.filter';
import { EnvelopeInterceptor } from './common/envelope.interceptor';
import { assertConfig, config } from './config';

async function bootstrap(): Promise<void> {
  assertConfig();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // req.ip is used by auth rate limiting. Trust precisely the Render edge hop,
  // not arbitrary user-supplied X-Forwarded-For chain entries.
  app.set('trust proxy', config.trustProxyHops);

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

  // Optional production deployment: serve the built React app from this same
  // HTTPS origin. REST and Socket.IO remain handled by Nest; the frontend uses
  // hash routes, so it does not need an SPA wildcard route.
  if (process.env.SERVE_FRONTEND === 'true') {
    const frontendDir = resolve(process.cwd(), process.env.FRONTEND_DIST_DIR ?? '../dist');
    if (!existsSync(join(frontendDir, 'index.html'))) {
      throw new Error('SERVE_FRONTEND=true requires the built frontend: ' + frontendDir);
    }
    app.useStaticAssets(frontendDir, {
      index: 'index.html',
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-store');
        else if (filePath.includes('/assets/')) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      },
    });
    Logger.log('Frontend: serving static assets from ' + frontendDir, 'Bootstrap');
  }

  await app.listen(config.port, '0.0.0.0');
  Logger.log(`API:     http://localhost:${config.port}/api/v1`, 'Bootstrap');
  Logger.log(`Sockets: http://localhost:${config.port}/game`, 'Bootstrap');
}

void bootstrap();
