import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { RolesModule } from './roles/roles.module';
import { UsersModule } from './users/users.module';
import { DictionaryModule } from './dictionary/dictionary.module';
import { AuditTrailModule } from './audit-trail/audit-trail.module';
import { PermissionsModule } from './permissions/permissions.module';
import { JobPostTemplateModule } from './job-post-template/job-post-template.module';
import { JobPostModule } from './job-post/job-post.module';
import { ApplicantInfoModule } from './applicant-info/applicant-info.module';
import { UploadModule } from './upload/upload.module';
import { ApplicationModule } from './application/application.module';
import { NotificationModule } from './notification/notification.module';
import { ProductsModule } from './products/products.module';
import { CategoriesModule } from './categories/categories.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { InventoryModule } from './inventory/inventory.module';
import { SalesModule } from './sales/sales.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { InsightsModule } from './insights/insights.module';
import { validateEnvironment } from './config/validate-environment';
import { AccessControlModule } from './access-control/access-control.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    PrismaModule,
    AccessControlModule,
    AuthModule,
    RolesModule,
    UsersModule,
    DictionaryModule,
    AuditTrailModule,
    PermissionsModule,
    JobPostTemplateModule,
    JobPostModule,
    ApplicantInfoModule,
    UploadModule,
    ApplicationModule,
    NotificationModule,
    ProductsModule,
    CategoriesModule,
    SuppliersModule,
    InventoryModule,
    SalesModule,
    DashboardModule,
    InsightsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
