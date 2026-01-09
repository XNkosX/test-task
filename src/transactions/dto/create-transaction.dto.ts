import {
  IsEnum,
  IsNumber,
  IsPositive,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { TransactionAction } from '../../common/enums/transaction-action.enum';

export class CreateTransactionDto {
  @IsNumber()
  @Min(1)
  userId: number;

  @IsEnum(TransactionAction)
  action: TransactionAction;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}
