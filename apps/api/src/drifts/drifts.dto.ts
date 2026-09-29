import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

const statuses = ['New', 'Under review', 'Approved', 'Dismissed'] as const;
const tiers = ['HIGH', 'MEDIUM', 'LOW'] as const;
const sources = ['Call', 'Email', 'Ticket comment'] as const;

export class CreateDriftDto {
  @IsString() @IsNotEmpty() @MaxLength(100) id!: string;
  @IsString() @IsNotEmpty() requirementId!: string;
  @IsIn(statuses) status!: (typeof statuses)[number];
  @IsOptional() @IsIn(tiers) impactTier?: (typeof tiers)[number] | null;
  @IsOptional() @IsInt() @Min(0) bufferDays?: number | null;
  @IsIn(sources) sourceType!: (typeof sources)[number];
  @IsString() @IsNotEmpty() sourceDate!: string;
  @IsOptional() @IsString() sourceReference?: string | null;
  @IsString() @IsNotEmpty() quote!: string;
  @IsString() @IsNotEmpty() whyFlagged!: string;
  @IsString() @IsNotEmpty() tierExplanation!: string;
  @IsOptional() @IsString() crText?: string | null;
  @IsOptional() @IsString() approvedAt?: string | null;
}

export class UpdateDriftDto {
  @IsOptional() @IsString() @IsNotEmpty() requirementId?: string;
  @IsOptional() @IsIn(statuses) status?: (typeof statuses)[number];
  @IsOptional() @IsIn(tiers) impactTier?: (typeof tiers)[number] | null;
  @IsOptional() @IsInt() @Min(0) bufferDays?: number | null;
  @IsOptional() @IsIn(sources) sourceType?: (typeof sources)[number];
  @IsOptional() @IsString() @IsNotEmpty() sourceDate?: string;
  @IsOptional() @IsString() sourceReference?: string | null;
  @IsOptional() @IsString() @IsNotEmpty() quote?: string;
  @IsOptional() @IsString() @IsNotEmpty() whyFlagged?: string;
  @IsOptional() @IsString() @IsNotEmpty() tierExplanation?: string;
  @IsOptional() @IsString() crText?: string | null;
  @IsOptional() @IsString() approvedAt?: string | null;
}
