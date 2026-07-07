import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

// JwtStrategy 告诉 Passport "如何验证 JWT token"
// 当 JwtAuthGuard 拦截到请求时，会调用这个策略来验证
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      // 从请求头的 Authorization: Bearer <token> 中提取 token
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // 不忽略过期：token 过期就拒绝
      ignoreExpiration: false,
      // 用同一个密钥验签（必须和签名时用的一样）
      secretOrKey: config.get<string>('JWT_SECRET', 'fallback-secret'),
    });
  }

  // validate 方法：token 验签通过后被调用
  // payload 就是登录时 jwt.sign() 传入的数据：{ sub, email, role, permissions }
  // 返回值会被挂到 request.user 上
  async validate(payload: {
    sub: number;
    email: string;
  }) {
    return {
      id: payload.sub,
      email: payload.email,
    };
  }
}
