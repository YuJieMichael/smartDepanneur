import { Module } from '@nestjs/common';
import { StoreOperationsController } from './store-operations.controller';
import { StoreOperationsService } from './store-operations.service';
import { ProductImportService } from './product-import.service';
@Module({
  controllers: [StoreOperationsController],
  providers: [StoreOperationsService, ProductImportService],
})
export class StoreOperationsModule {}
