import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { FindTransactionHistory } from './dto/find-transaction-history.dto';

@Controller('transactions')
@UseInterceptors(CacheInterceptor)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  async createTransaction(@Body() dto: CreateTransactionDto) {
    return await this.transactionsService.processTransaction(dto);
  }

  @Get('balance/:userId')
  async getBalance(@Param('userId') userId: number) {
    return await this.transactionsService.getUserBalance(userId);
  }

  @Get('history/:userId')
  async getHistory(
    @Param('userId') userId: number,
    @Query() dto: FindTransactionHistory,
  ) {
    return await this.transactionsService.getTransactionHistory(
      userId,
      dto.page,
      dto.limit,
    );
  }
}
