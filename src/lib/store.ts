import { create } from 'zustand';
import { Vendor, Customer, ChartOfAccount } from './types';

interface AppState {
  vendors: Vendor[];
  customers: Customer[];
  chartOfAccounts: ChartOfAccount[];
  setVendors: (vendors: Vendor[]) => void;
  setCustomers: (customers: Customer[]) => void;
  setChartOfAccounts: (chartOfAccounts: ChartOfAccount[]) => void;
  addVendor: (vendor: Vendor) => void;
  addCustomer: (customer: Customer) => void;
  addChartOfAccount: (account: ChartOfAccount) => void;
  updateVendor: (vendor: Vendor) => void;
  updateCustomer: (customer: Customer) => void;
  updateChartOfAccount: (account: ChartOfAccount) => void;
  removeVendor: (vendorId: string) => void;
  removeCustomer: (customerId: string) => void;
  removeChartOfAccount: (accountId: string) => void;
  removeVendors: (vendorIds: string[]) => void;
  removeCustomers: (customerIds: string[]) => void;
  removeChartOfAccounts: (accountIds: string[]) => void;
}

export const useStore = create<AppState>((set) => ({
  vendors: [],
  customers: [],
  chartOfAccounts: [],
  setVendors: (vendors) => set({ vendors }),
  setCustomers: (customers) => set({ customers }),
  setChartOfAccounts: (chartOfAccounts) => set({ chartOfAccounts }),
  addVendor: (vendor) => set((state) => ({ vendors: [...state.vendors, vendor] })),
  addCustomer: (customer) => set((state) => ({ customers: [...state.customers, customer] })),
  addChartOfAccount: (account) => set((state) => ({ chartOfAccounts: [...state.chartOfAccounts, account] })),
  updateVendor: (updatedVendor) =>
    set((state) => ({
      vendors: state.vendors.map((vendor) =>
        vendor.id === updatedVendor.id ? updatedVendor : vendor
      ),
    })),
  updateCustomer: (updatedCustomer) =>
    set((state) => ({
      customers: state.customers.map((customer) =>
        customer.id === updatedCustomer.id ? updatedCustomer : customer
      ),
    })),
  updateChartOfAccount: (updatedAccount) =>
    set((state) => ({
      chartOfAccounts: state.chartOfAccounts.map((account) =>
        account.id === updatedAccount.id ? updatedAccount : account
      ),
    })),
  removeVendor: (vendorId) => set((state) => ({ vendors: state.vendors.filter(v => v.id !== vendorId) })),
  removeCustomer: (customerId) => set((state) => ({ customers: state.customers.filter(c => c.id !== customerId) })),
  removeChartOfAccount: (accountId) => set((state) => ({ chartOfAccounts: state.chartOfAccounts.filter(a => a.id !== accountId) })),
  removeVendors: (vendorIds) => set((state) => ({ vendors: state.vendors.filter(v => !vendorIds.includes(v.id)) })),
  removeCustomers: (customerIds) => set((state) => ({ customers: state.customers.filter(c => !customerIds.includes(c.id)) })),
  removeChartOfAccounts: (accountIds) => set((state) => ({ chartOfAccounts: state.chartOfAccounts.filter(a => !accountIds.includes(a.id)) })),
}));
