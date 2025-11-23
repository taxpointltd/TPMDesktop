'use client';

import { useFirestore, useUser } from '@/firebase';
import {
  collection,
  doc,
  deleteDoc,
  setDoc,
  addDoc,
  writeBatch,
  getDocs,
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PlusCircle, Loader2, MoreHorizontal, Edit, Trash2, ArrowUpDown, Search, Link as LinkIcon, Sparkles } from 'lucide-react';
import { useParams } from 'next/navigation';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ChartOfAccount, Vendor, Customer } from '@/lib/types';
import { useStore } from '@/lib/store';
import { interlinkAccounts } from '@/ai/flows/interlink-accounts-flow';

const accountSchema = z.object({
  accountName: z.string().min(1, 'Account name is required.'),
  accountNumber: z.string().optional(),
  accountType: z.string().optional(),
  description: z.string().optional(),
  subAccountName: z.string().optional(),
  subAccountNumber: z.string().optional(),
});

type AccountFormValues = z.infer<typeof accountSchema>;

const ITEMS_PER_PAGE = 10;

export default function ChartOfAccountsPage() {
  const params = useParams() as { companyId: string };
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const { vendors, customers, chartOfAccounts, setVendors, setCustomers, setChartOfAccounts, updateVendor, updateCustomer, updateChartOfAccount, removeChartOfAccount, removeChartOfAccounts } = useStore();

  const [isLoading, setIsLoading] = useState(true);
  const [isLinking, setIsLinking] = useState(false);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof ChartOfAccount;
    direction: 'asc' | 'desc';
  }>({ key: 'accountName', direction: 'asc' });
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // State for modals and selection
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<ChartOfAccount | null>(null);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [isBatchDeleteConfirmOpen, setIsBatchDeleteConfirmOpen] = useState(false);

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      accountName: '',
      accountNumber: '',
      accountType: '',
      description: '',
      subAccountName: '',
      subAccountNumber: '',
    },
  });

  const fetchAllData = useCallback(async () => {
    if (!user || !firestore || !params.companyId) return;
    setIsLoading(true);
    try {
      const vendorsRef = collection(firestore, `/users/${user.uid}/companies/${params.companyId}/vendors`);
      const customersRef = collection(firestore, `/users/${user.uid}/companies/${params.companyId}/customers`);
      const coaRef = collection(firestore, `/users/${user.uid}/companies/${params.companyId}/chartOfAccounts`);

      const [vendorsSnap, customersSnap, coaSnap] = await Promise.all([
        getDocs(vendorsRef),
        getDocs(customersRef),
        getDocs(coaRef),
      ]);

      setVendors(vendorsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vendor)));
      setCustomers(customersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
      setChartOfAccounts(coaSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChartOfAccount)));
    } catch (error) {
      console.error("Failed to fetch data for global store:", error);
      toast({
        variant: "destructive",
        title: "Data Sync Error",
        description: "Could not sync all data for AI operations."
      });
    } finally {
        setIsLoading(false);
    }
  }, [user, firestore, params.companyId, setVendors, setCustomers, setChartOfAccounts, toast]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const sortedAndFilteredAccounts = useMemo(() => {
    let accounts = [...chartOfAccounts];
    
    // Filtering
    if (searchTerm) {
        accounts = accounts.filter(account => 
            (account.accountName && account.accountName.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (account.accountNumber && account.accountNumber.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    // Sorting
    accounts.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (!aValue) return 1;
        if (!bValue) return -1;
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });

    return accounts;
  }, [chartOfAccounts, searchTerm, sortConfig]);

  const paginatedAccounts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedAndFilteredAccounts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [sortedAndFilteredAccounts, currentPage]);

  const totalPages = Math.ceil(sortedAndFilteredAccounts.length / ITEMS_PER_PAGE);

  const handleRunInterlink = async () => {
    if (!firestore || !user || !chartOfAccounts.length || (!vendors.length && !customers.length)) {
      toast({
        title: 'Not Ready',
        description: 'Ensure chart of accounts and either vendors or customers are loaded before running AI interlink.',
        variant: 'destructive',
      });
      return;
    }
    setIsLinking(true);
    toast({ title: 'AI Interlinking in Progress...', description: 'Please wait while Gemini establishes connections.' });

    try {
      const result = await interlinkAccounts({
        vendors: JSON.stringify(vendors.map(({ id, vendorName, defaultExpenseAccount }) => ({ id, vendorName, defaultExpenseAccount }))),
        customers: JSON.stringify(customers.map(({ id, customerName, defaultRevenueAccount }) => ({ id, customerName, defaultRevenueAccount }))),
        chartOfAccounts: JSON.stringify(chartOfAccounts.map(({ id, accountName, accountNumber, subAccountName, subAccountNumber }) => ({ id, accountName, accountNumber, subAccountName, subAccountNumber }))),
      });

      const batch = writeBatch(firestore);

      result.vendorLinks.forEach(link => {
        const vendorRef = doc(firestore, `/users/${user.uid}/companies/${params.companyId}/vendors/${link.vendorId}`);
        batch.set(vendorRef, { defaultExpenseAccountId: link.chartOfAccountId }, { merge: true });
        const coaRef = doc(firestore, `/users/${user.uid}/companies/${params.companyId}/chartOfAccounts/${link.chartOfAccountId}`);
        batch.set(coaRef, { defaultVendorId: link.vendorId }, { merge: true });
        
        // Update global state
        const vendor = vendors.find(v => v.id === link.vendorId);
        if(vendor) updateVendor({...vendor, defaultExpenseAccountId: link.chartOfAccountId});
        const account = chartOfAccounts.find(a => a.id === link.chartOfAccountId);
        if(account) updateChartOfAccount({...account, defaultVendorId: link.vendorId});
      });

      result.customerLinks.forEach(link => {
        const customerRef = doc(firestore, `/users/${user.uid}/companies/${params.companyId}/customers/${link.customerId}`);
        batch.set(customerRef, { defaultRevenueAccountId: link.chartOfAccountId }, { merge: true });
         const coaRef = doc(firestore, `/users/${user.uid}/companies/${params.companyId}/chartOfAccounts/${link.chartOfAccountId}`);
         batch.set(coaRef, { defaultCustomerId: link.customerId }, { merge: true });

         // Update global state
         const customer = customers.find(c => c.id === link.customerId);
         if(customer) updateCustomer({...customer, defaultRevenueAccountId: link.chartOfAccountId});
         const account = chartOfAccounts.find(a => a.id === link.chartOfAccountId);
         if(account) updateChartOfAccount({...account, defaultCustomerId: link.customerId});
      });

      await batch.commit();

      toast({
        title: 'Interlinking Complete!',
        description: `${result.vendorLinks.length} vendor(s) and ${result.customerLinks.length} customer(s) have been linked.`,
      });

    } catch (error) {
      console.error('AI Interlinking failed:', error);
      toast({
        variant: 'destructive',
        title: 'AI Interlinking Failed',
        description: 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setIsLinking(false);
    }
  };

  const handleSort = (key: keyof ChartOfAccount) => {
    setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
  };
  
  const openAddModal = () => {
    setSelectedAccount(null);
    form.reset({ accountName: '', accountNumber: '', accountType: '', description: '', subAccountName: '', subAccountNumber: '' });
    setIsFormOpen(true);
  };

  const openEditModal = (account: ChartOfAccount) => {
    setSelectedAccount(account);
    form.reset({
        accountName: account.accountName,
        accountNumber: account.accountNumber || '',
        accountType: account.accountType || '',
        description: account.description || '',
        subAccountName: account.subAccountName || '',
        subAccountNumber: account.subAccountNumber || '',
    });
    setIsFormOpen(true);
  };

  const openDeleteConfirm = (account: ChartOfAccount) => {
    setSelectedAccount(account);
    setIsDeleteConfirmOpen(true);
  };

  const handleFormSubmit = async (values: AccountFormValues) => {
    if (!user || !firestore) return;
    const coaCollectionRef = collection(firestore, `/users/${user.uid}/companies/${params.companyId}/chartOfAccounts`);

    const dataToSave: Omit<ChartOfAccount, 'id'> = {
        companyId: params.companyId,
        accountName: values.accountName,
        accountNumber: values.accountNumber || '',
        accountType: values.accountType || '',
        description: values.description || '',
        subAccountName: values.subAccountName || '',
        subAccountNumber: values.subAccountNumber || '',
        defaultVendorId: selectedAccount?.defaultVendorId || '',
        defaultCustomerId: selectedAccount?.defaultCustomerId || '',
      };

    try {
      if (selectedAccount) {
        const docRef = doc(coaCollectionRef, selectedAccount.id);
        await setDoc(docRef, dataToSave, { merge: true });
        updateChartOfAccount({ ...dataToSave, id: selectedAccount.id });
        toast({ title: 'Account updated', description: `"${values.accountName}" has been updated.` });
      } else {
        const newDoc = await addDoc(coaCollectionRef, dataToSave);
        useStore.getState().addChartOfAccount({ ...dataToSave, id: newDoc.id });
        toast({ title: 'Account created', description: `"${values.accountName}" has been added.` });
      }
      setIsFormOpen(false);
      setSelectedRows([]);
    } catch (error) {
        console.error('Error saving account:', error);
        const permissionError = new FirestorePermissionError({
            path: selectedAccount ? doc(coaCollectionRef, selectedAccount.id).path : coaCollectionRef.path,
            operation: selectedAccount ? 'update' : 'create',
            requestResourceData: dataToSave,
          });
        errorEmitter.emit('permission-error', permissionError);
        toast({ variant: 'destructive', title: 'Save failed', description: 'Could not save the account. Check permissions.' });
    }
  };

  const handleDeleteAccount = async () => {
    if (!selectedAccount || !user || !firestore) return;
    const docRef = doc(firestore, `/users/${user.uid}/companies/${params.companyId}/chartOfAccounts/${selectedAccount.id}`);
    try {
      await deleteDoc(docRef);
      removeChartOfAccount(selectedAccount.id);
      toast({ title: 'Account deleted', description: `"${selectedAccount.accountName}" has been deleted.` });
      setIsDeleteConfirmOpen(false);
      setSelectedAccount(null);
      setSelectedRows([]);
    } catch (error) {
        console.error('Error deleting account:', error);
        const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'delete',
          });
        errorEmitter.emit('permission-error', permissionError);
        toast({ variant: 'destructive', title: 'Delete failed', description: 'Could not delete the account. Check permissions.' });
    }
  };

  const handleBatchDelete = async () => {
    if (!firestore || !user || selectedRows.length === 0) return;
    const batch = writeBatch(firestore);
    selectedRows.forEach(accountId => {
      const docRef = doc(firestore, `/users/${user.uid}/companies/${params.companyId}/chartOfAccounts/${accountId}`);
      batch.delete(docRef);
    });
    try {
      await batch.commit();
      removeChartOfAccounts(selectedRows);
      toast({ title: `${selectedRows.length} accounts deleted.` });
      setIsBatchDeleteConfirmOpen(false);
      setSelectedRows([]);
    } catch (error) {
      console.error('Error batch deleting accounts:', error);
      toast({ variant: 'destructive', title: 'Delete failed', description: 'Could not delete the selected accounts. Check permissions.' });
    }
  };

  const handleSelectAll = (checked: boolean | string) => {
    if (checked) {
      setSelectedRows(paginatedAccounts.map(a => a.id));
    } else {
      setSelectedRows([]);
    }
  };

  const handleRowSelect = (accountId: string, checked: boolean | string) => {
    if (checked) {
      setSelectedRows(prev => [...prev, accountId]);
    } else {
      setSelectedRows(prev => prev.filter(id => id !== accountId));
    }
  };

  const getSortIcon = (key: string) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />;
    }
    return <ArrowUpDown className="ml-2 h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Chart of Accounts
          </h1>
          <p className="text-muted-foreground">
            Manage your chart of accounts for company{' '}
            <span className="font-mono bg-muted px-2 py-1 rounded">
              {params.companyId}
            </span>
            .
          </p>
        </div>
        <div className="flex items-center gap-2">
            {selectedRows.length > 0 && (
                <Button variant="destructive" onClick={() => setIsBatchDeleteConfirmOpen(true)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete ({selectedRows.length})
                </Button>
            )}
             <Button onClick={handleRunInterlink} disabled={isLinking} variant="outline">
                {isLinking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Run Interlink with AI
            </Button>
            <Button onClick={openAddModal}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Account
            </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
            <div className="flex items-center justify-between">
                <div>
                    <CardTitle>Accounts List</CardTitle>
                    <CardDescription>
                        A list of all accounts associated with your company.
                    </CardDescription>
                </div>
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search by name or number..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead padding="checkbox" className="w-[50px] px-4">
                    <Checkbox
                      checked={selectedRows.length > 0 && selectedRows.length === paginatedAccounts.length && paginatedAccounts.length > 0}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('accountName')}>
                    <div className="flex items-center">Account {getSortIcon('accountName')}</div>
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('subAccountName')}>
                    <div className="flex items-center">Sub-Account {getSortIcon('subAccountName')}</div>
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('accountType')}>
                    <div className="flex items-center">Account Type {getSortIcon('accountType')}</div>
                  </TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Links</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">
                      <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                    </TableCell>
                  </TableRow>
                ) : paginatedAccounts.length > 0 ? (
                  paginatedAccounts.map((account) => (
                    <TableRow key={account.id} data-state={selectedRows.includes(account.id) && "selected"}>
                      <TableCell padding="checkbox" className="px-4">
                        <Checkbox
                          checked={selectedRows.includes(account.id)}
                          onCheckedChange={(checked) => handleRowSelect(account.id, checked)}
                          aria-label="Select row"
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {account.accountNumber ? `${account.accountNumber} ` : ''}{account.accountName}
                      </TableCell>
                      <TableCell>
                        {account.subAccountNumber || account.subAccountName ? 
                        `${account.subAccountNumber ? `${account.subAccountNumber} ` : ''}${account.subAccountName || ''}` 
                        : 'N/A'}
                      </TableCell>
                      <TableCell>{account.accountType || 'N/A'}</TableCell>
                      <TableCell>
                        {account.description || 'N/A'}
                      </TableCell>
                       <TableCell>
                        {(account.defaultVendorId || account.defaultCustomerId) && (
                          <LinkIcon className="h-4 w-4 text-accent" />
                        )}
                      </TableCell>
                      <TableCell>
                      <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">Open menu</span><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditModal(account)}><Edit className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openDeleteConfirm(account)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No accounts found. Import them or add a new one.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-end space-x-2 py-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Add/Edit Account Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{selectedAccount ? 'Edit Account' : 'Add New Account'}</DialogTitle>
            <DialogDescription>{selectedAccount ? 'Update the details of your account.' : 'Fill in the information for the new account.'}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-4">
              <FormField
                control={form.control}
                name="accountName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Name</FormLabel>
                    <FormControl><Input placeholder="e.g., Office Supplies" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="accountNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Number (Optional)</FormLabel>
                    <FormControl><Input placeholder="e.g., 60210" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="accountType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Type (Optional)</FormLabel>
                    <FormControl><Input placeholder="e.g., Expense" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Description (Optional)</FormLabel>
                    <FormControl><Input placeholder="e.g., For office supply purchases" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
                <FormField
                control={form.control}
                name="subAccountName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sub Account Name (Optional)</FormLabel>
                    <FormControl><Input placeholder="e.g., Pens" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="subAccountNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sub Account Number (Optional)</FormLabel>
                    <FormControl><Input placeholder="e.g., 60210.1" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Single Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete the account "{selectedAccount?.accountName}".</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch Delete Confirmation Dialog */}
      <AlertDialog open={isBatchDeleteConfirmOpen} onOpenChange={setIsBatchDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete the {selectedRows.length} selected accounts.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBatchDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
