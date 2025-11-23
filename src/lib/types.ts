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
  'Name': string; // From import
  'Contact Email'?: string; // From import
  'Default Expense Account'?: string; // From import
  defaultExpenseAccountId?: string; // For linking
}

export interface Customer {
  id:string;
  companyId: string;
  'name': string; // from import
  'contactEmail'?: string; // from import
  'defaultRevenueAccount'?: string; // from import
  defaultRevenueAccountId?: string; // for linking
}

export interface ChartOfAccount {
  id: string;
  companyId: string;
  'accountName': string; // from import
  'accountNumber'?: string; // from import
  'accountType'?: string; // from import
  'accountDescription'?: string; // from import
  subAccountName?: string;
  subAccountNumber?: string;
  description?: string;
  defaultVendorId?: string;
  defaultCustomerId?: string;
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
}
