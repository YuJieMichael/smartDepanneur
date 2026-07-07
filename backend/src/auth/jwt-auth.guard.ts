import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// AuthGuard('jwt') 是 Passport 提供的守卫
// 它会自动检查请求头中的 Authorization: Bearer <token>
// 如果 token 有效 → 放行，并把用户信息挂到 request.user 上
// 如果 token 无效/过期/不存在 → 返回 401 Unauthorized
//
// 使用方式：在 Controller 的方法上加 @UseGuards(JwtAuthGuard)
// 例如：
//   @UseGuards(JwtAuthGuard)
//   @Get('profile')
//   getProfile(@Request() req) { return req.user; }
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
