import { create } from 'zustand';
import { Vendor, Customer, ChartOfAccount } from './types';

interface AppState {
  vendors: Vendor[];
  customers: Customer[];
  chartOfAccounts: ChartOfAccount[];
  setVendors: (vendors: Vendor[]) => void;
  setCustomers: (customers: Customer[]) => void;
  setChartOfAccounts: (chartOfAccounts: ChartOfAccount[]) => void;
  updateVendor: (vendor: Vendor) => void;
  updateCustomer: (customer: Customer) => void;
  updateChartOfAccount: (account: ChartOfAccount) => void;
}

export const useStore = create<AppState>((set) => ({
  vendors: [],
  customers: [],
  chartOfAccounts: [],
  setVendors: (vendors) => set({ vendors }),
  setCustomers: (customers) => set({ customers }),
  setChartOfAccounts: (chartOfAccounts) => set({ chartOfAccounts }),
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
}));
