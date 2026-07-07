import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { AuditTrailModule } from '../audit-trail/audit-trail.module';

// @Module 告诉 Nest.js：
// - 这个模块包含哪些 Controller（处理路由）
// - 这个模块包含哪些 Service（业务逻辑）
// - 这个模块依赖哪些其他模块
@Module({
  imports: [
    AuditTrailModule,
    // JwtModule.registerAsync → 异步注册 JWT 模块
    // 为什么是 async？因为需要等 ConfigService 读取到环境变量后才能配置
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // JWT 签名密钥：从环境变量读取
        // 这个密钥用于加签和验签 token，必须保密
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          // token 过期时间：7天后失效，用户需要重新登录
          expiresIn: '7d',
        },
      }),
    }),
  ],
  controllers: [AuthController], // 注册路由控制器
  providers: [AuthService, JwtStrategy], // 注册服务 + JWT 验证策略
})
export class AuthModule {}
