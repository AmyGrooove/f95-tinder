import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app/app.module';
import { ConfigService } from './infrastructure/config/config.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );
  const configService = app.get(ConfigService);

  app.setGlobalPrefix(configService.apiPrefix);
  app.enableCors({
    origin: configService.corsOrigins.includes('*')
      ? true
      : configService.corsOrigins,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );
  app.enableShutdownHooks();

  if (configService.nodeEnv === 'development') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('F95 Tinder API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);

    SwaggerModule.setup(`${configService.apiPrefix}/docs`, app, document);
  }

  await app.listen(configService.port, '0.0.0.0');
}

void bootstrap();
