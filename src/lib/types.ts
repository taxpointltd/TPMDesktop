// A single source of truth for data structures.

export interface UserProfile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

export interface Company {
  id: string;
  name: string;
  userId: string;
}

export interface Vendor {
  id: string;
  companyId: string;
  vendorName: string;
  vendorEmail: string;
  defaultExpenseAccount: string;
  defaultExpenseAccountId: string;
}

export interface Customer {
  id:string;
  companyId: string;
  customerName: string;
  customerEmail: string;
  defaultRevenueAccount: string;
  defaultRevenueAccountId: string;
}

export interface ChartOfAccount {
  id: string;
  companyId: string;
  accountName: string;
  accountNumber: string;
  accountType: string;
  description: string;
  subAccountName: string;
  subAccountNumber: string;
  defaultVendorId: string;
  defaultCustomerId: string;
}

export interface Transaction {
  id: string;
  companyId: string;
  date: string; // ISO 8601 format
  amount: number;
  description: string;
  memo?: string;
  vendorId?: string;
  customerId?: string;
  chartOfAccountId?: string;
  // Fields for UI state during matching
  status: 'unmatched' | 'matched' | 'edited' | 'confirmed';
  matchedEntityName?: string;
  matchedAccountName?: string;
}

export interface RawTransaction {
    'TransactionDate': string;
    'Appears On Your Statement As': string;
    'Name': string;
    'Account': string;
    'Amount': number;
    'Category': string;
    'Payment Account': string;
}
