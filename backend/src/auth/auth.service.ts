import {
    BadRequestException,
    Injectable,
    ConflictException,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditTrailService } from '../audit-trail/audit-trail.service';

const PUBLIC_REGISTRATION_ROLES = new Set(['Store Owner', 'Cashier']);

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwt: JwtService,
        private readonly auditTrailService: AuditTrailService,
    ) { }

    async checkEmailExists(email: string): Promise<{ exists: boolean }> {
        const user = await this.prisma.user.findUnique({ where: { email } });
        return { exists: !!user };
    }

    async refreshToken(userId: number, email: string) {
        const payload = { sub: userId, email };
        return { access_token: await this.jwt.signAsync(payload) };
    }

    private normalizeRoles(rolesInput: string[] | string | undefined): string[] {
        if (Array.isArray(rolesInput)) {
            return rolesInput.filter((r) => typeof r === 'string' && r.trim().length > 0);
        }

        if (typeof rolesInput === 'string' && rolesInput.trim().length > 0) {
            return [rolesInput.trim()];
        }

        return [];
    }

    async register(email: string, password: string, rolesInput: string[] | string | undefined = []) {
        const roles = this.normalizeRoles(rolesInput);

        if (roles.length !== 1 || !PUBLIC_REGISTRATION_ROLES.has(roles[0])) {
            throw new BadRequestException(
                'Public registration requires exactly one role: Store Owner or Cashier',
            );
        }

        return this.createAccount(email, password, roles);
    }

    private async createAccount(email: string, password: string, roles: string[]) {
        const existing = await this.prisma.user.findUnique({
            where: { email },
        });

        if (existing) {
            throw new ConflictException('Email already registered');
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await this.prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                roles: {
                    connect: roles.map((name) => ({ name })),
                },
            },
        });

        return {
            id: user.id,
            email: user.email,
            message: 'Registered successfully',
        };
    }

    async registerWithAudit(
        email: string,
        password: string,
        rolesInput: string[] | string | undefined = [],
        operator: { id: number; email: string },
    ) {
        const roles = this.normalizeRoles(rolesInput);
        const result = await this.createAccount(email, password, roles);

        await this.auditTrailService.create({
            table: 'users',
            recordId: result.id,
            field: '[created]',
            oldValue: null,
            newValue: `${result.email} (roles: ${roles.join(', ') || 'none'})`,
            userId: operator.id,
            userEmail: operator.email,
        });

        return result;
    }

    async login(email: string, password: string) {
        const user = await this.prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            throw new UnauthorizedException('Invalid email or password');
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid email or password');
        }

        const payload = {
            sub: user.id,
            email: user.email,
        };

        return {
            access_token: await this.jwt.signAsync(payload),
        };
    }

    async getCurrentUser(userId: number) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                createdAt: true,
                updatedAt: true,
                roles: {
                    select: {
                        id: true,
                        name: true,
                        permissions: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
            },
        });

        if (!user) {
            throw new UnauthorizedException('No user exists');
        }

        return user;
    }
}
