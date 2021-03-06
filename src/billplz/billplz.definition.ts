import { LoggerService } from '@nestjs/common';

export const CONFIG_OPTIONS = 'BILLPLZ_CONFIG_OPTIONS';

export enum HttpMethod {
  GET = 'get',
  POST = 'post',
  PUT = 'put',
  PATCH = 'patch',
  DELETE = 'delete',
}

export enum CollectionStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum CallbackState {
  DUE = 'due',
  DELETED = 'deleted',
  PAID = 'paid',
}

export interface BillPlzOptions {
  debugMode?: boolean;
  apiKey: string;
  xSignatureKey: string;
  sandbox: boolean;
  collectionID?: string;
  billID?: string;
  accountNumber?: string;
  payoutCollectionID?: string;
  payoutID?: string;
  cardID?: string;
  cardToken?: string;
  cardProvider?: CardProvider;
  logger?: LoggerService;
}

export enum CardProvider {
  CARD_PROVIDER_SENANGPAY = 'senangpay',
  CARD_PROVIDER_OCBC = 'ocbc',
}

export enum Version {
  V3 = 'v3',
  V4 = 'v4',
}

export interface CreateCollection {
  title: string;
  logo?: string;
  split_payment?: {
    email?: string,
    fixed_cut?: any,
    variable_cut?: any,
    split_header?: boolean,
  };
}

export interface GetCollectionResponse {
  id: string;
  title: string;
  logo:
    {
      thumb_url?: string,
      avatar_url?: string,
    };
  split_payment:
    {
      email?: string,
      fixed_cut?: any,
      variable_cut?: any,
      split_header?: boolean,
    };
  status: CollectionStatus;
}

export interface CreateBill {
  collection_id?: string;
  email: string;
  mobile?: string;
  name: string;
  amount: number;
  callback_url: string;
  description: string;
  due_at?: string;
  redirect_url?: string;
  deliver?: string;
  reference_1_label?: string;
  reference_1?: string;
  reference_2_label?: string;
  reference_2?: string;
}

export interface CreateFpxBankBill {
  collection_id?: string;
  email: string;
  mobile?: string;
  name: string;
  amount: number;
  callback_url: string;
  description: string;
  due_at?: string;
  redirect_url?: string;
  deliver?: string;
  reference_2_label?: string;
  reference_2?: string;
}

export interface CreateBillResponse {
  id: string;
  collection_id: string;
  paid: boolean;
  state: string;
  amount: number;
  paid_amount: number;
  due_at: string;
  email: string;
  mobile: string;
  name: string;
  url: string;
  reference_1_label: string;
  reference_1: string;
  reference_2_label: string;
  reference_2: string;
  redirect_url: string;
  callback_url: string;
  description: string;
}

export interface GetFPXBankListResponse {
  name: string;
  display_bank_name: string;
  active: boolean;
}

export interface PayoutCollection {
  id: string;
  title: string;
  mass_payment_instructions_count: string;
  paid_amount: string;
  status: string;
}

export interface CreatePayout {
  mass_payment_instruction_collection_id: string;
  bank_code: string;
  bank_account_number: string;
  identity_number: string;
  name: string;
  description: string;
  total: number;
  email?: string;
  notification?: boolean;
  recipient_notification?: boolean;
  reference_id?: string;
}

export interface Payout extends CreatePayout {
  id: string;
  status: PayoutStatus;
}

export enum PayoutStatus {
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  REFUNDED = 'refunded',
}

export interface BankAccount {
  name: string;
  id_no: string;
  acc_no: string;
  code: string;
  organization: boolean;
  authorization_date: string;
  status: BankAccountStatus;
  processed_at: string;
  rejected_desc: string;
}

export interface CreateBankAccount {
  name: string;
  id_no: string;
  acc_no: string;
  code: string;
  organization: true;
}

export enum BankAccountStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}
