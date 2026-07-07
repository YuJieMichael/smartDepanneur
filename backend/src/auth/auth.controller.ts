import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

// @Controller('api/auth') → 这个控制器处理所有 /api/auth/... 的请求
// 类比前端：就像 React Router 里的 <Route path="/api/auth/*">
@Controller('api/auth')
export class AuthController {
  // 构造函数注入 AuthService（Nest.js 自动提供，不用手动 new）
  constructor(private readonly authService: AuthService) {}

  // @Post('register') → POST /api/auth/register
  // @Body() 是装饰器，作用是从 HTTP 请求体（request body）中提取数据
  // 前端 fetch 时的 body: JSON.stringify({ email, password })  →  这里的 body
  @Post('register')
  async register(@Body() body: { email: string; password: string; roles?: string[] }) {
    return this.authService.register(body.email, body.password, body.roles ?? []);
  }

  @UseGuards(JwtAuthGuard)
  @Post('createUser')
  async createUser(
    @Body() body: { email: string; password: string; roles?: string[] },
    @Request() req: { user: { id: number; email: string } },
  ) {
    return this.authService.registerWithAudit(
      body.email,
      body.password,
      body.roles ?? [],
      req.user,
    );
  }

  @Post('checkEmailExists')
  async checkEmailExists(@Body() body: { email: string }) {
    return this.authService.checkEmailExists(body.email);
  }

  // @Post('login') → POST /api/auth/login
  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }

  // @UseGuards(JwtAuthGuard) → 这个路由需要 token 才能访问
  // 如果没有 token 或 token 无效/过期 → 自动返回 401
  // token 有效 → JwtStrategy.validate() 的返回值挂到 req.user 上
  @UseGuards(JwtAuthGuard)
  @Get('getCurrentUser')
  async getCurrentUser(@Request() req: { user: { id: number; email: string } }) {
    return this.authService.getCurrentUser(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('refresh')
  async refresh(@Request() req: { user: { id: number; email: string } }) {
    return this.authService.refreshToken(req.user.id, req.user.email);
  }
}
