import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransactionAction } from '../common/enums/transaction-action.enum';
import { Transaction } from './entities/transaction.entity';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async processTransaction(
    dto: CreateTransactionDto,
  ): Promise<{ user: User; transaction: Transaction }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const user = await queryRunner.manager.findOne(User, {
        where: { id: dto.userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${dto.userId} not found`);
      }

      if (
        (dto.action === TransactionAction.WITHDRAW ||
          dto.action === TransactionAction.PURCHASE) &&
        user.balance < dto.amount
      ) {
        throw new BadRequestException('Insufficient funds');
      }

      const newBalance = this.calculateNewBalance(
        user.balance,
        dto.amount,
        dto.action,
      );

      await queryRunner.manager.update(User, user.id, {
        balance: newBalance,
        updatedAt: new Date(),
      });

      const transaction = queryRunner.manager.create(Transaction, {
        userId: dto.userId,
        action: dto.action,
        amount: dto.amount,
        description: dto.description,
        metadata: dto.metadata,
      });

      await queryRunner.manager.save(transaction);
      await queryRunner.commitTransaction();

      user.balance = newBalance;

      return { user, transaction };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private calculateNewBalance(
    currentBalance: number,
    amount: number,
    action: TransactionAction,
  ): number {
    switch (action) {
      case TransactionAction.DEPOSIT:
      case TransactionAction.REFUND:
        return Number((currentBalance + amount).toFixed(2));
      case TransactionAction.WITHDRAW:
      case TransactionAction.PURCHASE:
        return Number((currentBalance - amount).toFixed(2));
      default:
        return currentBalance;
    }
  }

  async getUserBalance(
    userId: number,
  ): Promise<{ balance: number; calculatedBalance: number }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const transactions = await this.transactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.userId = :userId', { userId })
      .orderBy('transaction.createdAt', 'ASC')
      .getMany();

    const calculatedBalance = transactions.reduce((balance, transaction) => {
      switch (transaction.action) {
        case TransactionAction.DEPOSIT:
        case TransactionAction.REFUND:
          return balance + transaction.amount;
        case TransactionAction.WITHDRAW:
        case TransactionAction.PURCHASE:
          return balance - transaction.amount;
        default:
          return balance;
      }
    }, 0);

    return {
      balance: user.balance,
      calculatedBalance: Number(calculatedBalance.toFixed(2)),
    };
  }

  async getTransactionHistory(userId: number, page = 1, limit = 10) {
    const [transactions, total] = await this.transactionRepository.findAndCount(
      {
        where: { userId },
        order: { createdAt: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      },
    );

    return {
      transactions,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
