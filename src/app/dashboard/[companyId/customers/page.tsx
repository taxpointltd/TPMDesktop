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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from '@/components/ui/input';
import { PlusCircle, Loader2, MoreHorizontal, Edit, Trash2, ArrowUpDown, Search, Link as LinkIcon, ChevronsUpDown } from 'lucide-react';
import { useParams } from 'next/navigation';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Customer, ChartOfAccount, Vendor } from '@/lib/types';
import { useStore } from '@/lib/store';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';


const customerSchema = z.object({
  customerName: z.string().min(1, 'Customer name is required.'),
  customerEmail: z.string().email('Invalid email address.').optional().or(z.literal('')),
  defaultRevenueAccount: z.string().optional(),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

// LinkAccountDialog Component
const LinkAccountDialog = ({ open, onOpenChange, customer, onLink, accounts }: { open: boolean, onOpenChange: (open: boolean) => void, customer: Customer, onLink: (accountId: string) => void, accounts: ChartOfAccount[] }) => {
    const [popoverOpen, setPopoverOpen] = useState(false);
    const [selectedAccountId, setSelectedAccountId] = useState(customer.defaultRevenueAccountId || '');
  
    const handleLink = () => {
      onLink(selectedAccountId);
      onOpenChange(false);
    };
  
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link to Chart of Accounts</DialogTitle>
            <DialogDescription>
              Select an account from your Chart of Accounts to link to "{customer.customerName}".
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={popoverOpen} className="w-full justify-between">
                  {selectedAccountId ? accounts.find(a => a.id === selectedAccountId)?.accountName : "Select account..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                  <CommandInput placeholder="Search account..." />
                  <CommandList>
                    <CommandEmpty>No account found.</CommandEmpty>
                    <CommandGroup>
                      {accounts.map((account) => (
                        <CommandItem
                          key={account.id}
                          value={account.accountName}
                          onSelect={() => {
                            setSelectedAccountId(account.id);
                            setPopoverOpen(false);
                          }}
                        >
                          <LinkIcon className={cn("mr-2 h-4 w-4", selectedAccountId === account.id ? "opacity-100" : "opacity-0")} />
                          {account.accountNumber ? `${account.accountNumber} - ` : ''}{account.accountName}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleLink} disabled={!selectedAccountId}>Link Account</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };


export default function CustomersPage() {
  const params = useParams() as { companyId: string };
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { vendors, customers, chartOfAccounts, setVendors, setCustomers, setChartOfAccounts, updateCustomer } = useStore();

  const [isLoading, setIsLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Customer;
    direction: 'asc' | 'desc';
  }>({ key: 'customerName', direction: 'asc' });
  const [searchTerm, setSearchTerm] = useState('');

  // State for modals and selection
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [isBatchDeleteConfirmOpen, setIsBatchDeleteConfirmOpen] = useState(false);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [customerToLink, setCustomerToLink] = useState<Customer | null>(null);

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      customerName: '',
      customerEmail: '',
      defaultRevenueAccount: '',
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

  const sortedAndFilteredCustomers = useMemo(() => {
    let filtered = [...customers];

    if (searchTerm) {
      filtered = filtered.filter(customer =>
          customer.customerName && customer.customerName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    filtered.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
    });

    return filtered;
  }, [customers, searchTerm, sortConfig]);

  const handleSort = (key: keyof Customer) => {
    setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
  };
  
  const openAddModal = () => {
    setSelectedCustomer(null);
    form.reset({ customerName: '', customerEmail: '', defaultRevenueAccount: '' });
    setIsFormOpen(true);
  };

  const openEditModal = (customer: Customer) => {
    setSelectedCustomer(customer);
    const account = chartOfAccounts.find(a => a.id === customer.defaultRevenueAccountId);
    form.reset({
      customerName: customer.customerName,
      customerEmail: customer.customerEmail || '',
      defaultRevenueAccount: account?.accountName || customer.defaultRevenueAccount || '',
    });
    setIsFormOpen(true);
  };

  const openDeleteConfirm = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsDeleteConfirmOpen(true);
  };

  const handleLinkAccount = async (accountId: string) => {
    if (!customerToLink || !user || !firestore) return;
  
    const customerRef = doc(firestore, `/users/${user.uid}/companies/${params.companyId}/customers/${customerToLink.id}`);
    const accountRef = doc(firestore, `/users/${user.uid}/companies/${params.companyId}/chartOfAccounts/${accountId}`);
  
    try {
      const batch = writeBatch(firestore);
      batch.update(customerRef, { defaultRevenueAccountId: accountId });
      batch.update(accountRef, { defaultCustomerId: customerToLink.id });
      await batch.commit();
      
      const updatedCustomer = { ...customerToLink, defaultRevenueAccountId: accountId };
      updateCustomer(updatedCustomer);
      const account = chartOfAccounts.find(a => a.id === accountId);
      if (account) {
        useStore.getState().updateChartOfAccount({ ...account, defaultCustomerId: customerToLink.id });
      }
  
      toast({ title: 'Link Successful', description: `Customer "${customerToLink.customerName}" linked to account.` });
    } catch (error) {
      console.error("Error linking account:", error);
      toast({ variant: 'destructive', title: 'Link Failed' });
    } finally {
        setCustomerToLink(null);
    }
  };

  const handleFormSubmit = async (values: CustomerFormValues) => {
    if (!firestore || !user) return;
    
    const customersCollectionRef = collection(firestore, `/users/${user.uid}/companies/${params.companyId}/customers`);
    let accountId = '';
    
    if (values.defaultRevenueAccount) {
      const account = chartOfAccounts.find(a => a.accountName === values.defaultRevenueAccount);
      if (account) {
        accountId = account.id;
      } else {
        toast({
          variant: 'destructive',
          title: 'Account Not Found',
          description: `The account "${values.defaultRevenueAccount}" does not exist. Please create it first.`,
        });
        return; 
      }
    }
  
    const dataToSave: Omit<Customer, 'id'> = {
      companyId: params.companyId,
      customerName: values.customerName,
      customerEmail: values.customerEmail || '',
      defaultRevenueAccount: values.defaultRevenueAccount || '',
      defaultRevenueAccountId: accountId,
    };
  
    try {
      if (selectedCustomer) {
        const docRef = doc(customersCollectionRef, selectedCustomer.id);
        await setDoc(docRef, dataToSave, { merge: true });
        updateCustomer({ ...dataToSave, id: selectedCustomer.id });
        toast({ title: 'Customer updated', description: `"${values.customerName}" has been updated.` });
      } else {
        const newDoc = await addDoc(customersCollectionRef, dataToSave);
        setCustomers([...customers, { ...dataToSave, id: newDoc.id }]);
        toast({ title: 'Customer created', description: `"${values.customerName}" has been created.` });
      }
      setIsFormOpen(false);
      setSelectedRows([]);
    } catch (error) {
        console.error('Error saving customer:', error);
        const permissionError = new FirestorePermissionError({
            path: selectedCustomer ? doc(customersCollectionRef, selectedCustomer.id).path : customersCollectionRef.path,
            operation: selectedCustomer ? 'update' : 'create',
            requestResourceData: dataToSave,
          });
        errorEmitter.emit('permission-error', permissionError);
        toast({ variant: 'destructive', title: 'Save failed', description: 'Could not save the customer. Check permissions.' });
    }
  };

  const handleDeleteCustomer = async () => {
    if (!selectedCustomer || !user || !firestore) return;
    const docRef = doc(firestore, `/users/${user.uid}/companies/${params.companyId}/customers/${selectedCustomer.id}`);
    try {
      await deleteDoc(docRef);
      setCustomers(customers.filter(c => c.id !== selectedCustomer.id));
      toast({ title: 'Customer deleted', description: `"${selectedCustomer.customerName}" has been deleted.` });
      setIsDeleteConfirmOpen(false);
      setSelectedCustomer(null);
      setSelectedRows([]);
    } catch (error) {
        console.error('Error deleting customer:', error);
        const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'delete',
          });
        errorEmitter.emit('permission-error', permissionError);
        toast({ variant: 'destructive', title: 'Delete failed', description: 'Could not delete the customer. Check permissions.' });
    }
  };

  const handleBatchDelete = async () => {
    if (!firestore || !user || selectedRows.length === 0) return;
    const batch = writeBatch(firestore);
    selectedRows.forEach(customerId => {
      const docRef = doc(firestore, `/users/${user.uid}/companies/${params.companyId}/customers/${customerId}`);
      batch.delete(docRef);
    });
    try {
      await batch.commit();
      setCustomers(customers.filter(c => !selectedRows.includes(c.id)));
      toast({ title: `${selectedRows.length} customers deleted.` });
      setIsBatchDeleteConfirmOpen(false);
      setSelectedRows([]);
    } catch (error) {
      console.error('Error batch deleting customers:', error);
      toast({ variant: 'destructive', title: 'Delete failed', description: 'Could not delete the selected customers. Check permissions.' });
    }
  };
  
  const handleSelectAll = (checked: boolean | string) => {
    if (checked) {
      setSelectedRows(sortedAndFilteredCustomers.map(c => c.id));
    } else {
      setSelectedRows([]);
    }
  };
  
  const handleRowSelect = (customerId: string, checked: boolean | string) => {
    if (checked) {
      setSelectedRows(prev => [...prev, customerId]);
    } else {
      setSelectedRows(prev => prev.filter(id => id !== customerId));
    }
  };

  const getSortIcon = (key: string) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="ml-2 h-4 w-4" />;
    return <ArrowUpDown className="ml-2 h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground">Manage customers for company <span className="font-mono bg-muted px-2 py-1 rounded">{params.companyId}</span>.</p>
        </div>
        <div className="flex items-center gap-2">
            {selectedRows.length > 0 && (
                <Button variant="destructive" onClick={() => setIsBatchDeleteConfirmOpen(true)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete ({selectedRows.length})
                </Button>
            )}
            <Button onClick={openAddModal}><PlusCircle className="mr-2 h-4 w-4" />Add Customer</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Customer List</CardTitle>
              <CardDescription>A list of all customers associated with your company.</CardDescription>
            </div>
            <div className="relative w-full max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    type="search"
                    placeholder="Search by name..."
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
                      checked={selectedRows.length > 0 && selectedRows.length === sortedAndFilteredCustomers.length && sortedAndFilteredCustomers.length > 0}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('customerName')}><div className="flex items-center">Name {getSortIcon('customerName')}</div></TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('customerEmail')}><div className="flex items-center">Contact Email {getSortIcon('customerEmail')}</div></TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('defaultRevenueAccount')}><div className="flex items-center">Default Revenue Account {getSortIcon('defaultRevenueAccount')}</div></TableHead>
                  <TableHead>Link</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /></TableCell></TableRow>
                ) : sortedAndFilteredCustomers.length > 0 ? (
                  sortedAndFilteredCustomers.map((customer) => (
                    <TableRow key={customer.id} data-state={selectedRows.includes(customer.id) && "selected"}>
                      <TableCell padding="checkbox" className="px-4">
                        <Checkbox
                            checked={selectedRows.includes(customer.id)}
                            onCheckedChange={(checked) => handleRowSelect(customer.id, checked)}
                            aria-label="Select row"
                        />
                      </TableCell>
                      <TableCell className="font-medium">{customer.customerName}</TableCell>
                      <TableCell>{customer.customerEmail || 'N/A'}</TableCell>
                      <TableCell>{(chartOfAccounts.find(a => a.id === customer.defaultRevenueAccountId))?.accountName || customer.defaultRevenueAccount || 'N/A'}</TableCell>
                       <TableCell>
                        {customer.defaultRevenueAccountId && (
                          <LinkIcon className="h-4 w-4 text-accent" />
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">Open menu</span><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setCustomerToLink(customer); setIsLinkDialogOpen(true); }}><LinkIcon className="mr-2 h-4 w-4" />Link Account</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditModal(customer)}><Edit className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openDeleteConfirm(customer)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No customers found. Import them or add a new one.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {customerToLink && (
        <LinkAccountDialog
          open={isLinkDialogOpen}
          onOpenChange={setIsLinkDialogOpen}
          customer={customerToLink}
          onLink={handleLinkAccount}
          accounts={chartOfAccounts}
        />
      )}

      {/* Add/Edit Customer Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{selectedCustomer ? 'Edit Customer' : 'Add New Customer'}</DialogTitle>
            <DialogDescription>{selectedCustomer ? 'Update the details of your customer.' : 'Fill in the information for the new customer.'}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-4">
              <FormField
                control={form.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Name</FormLabel>
                    <FormControl><Input placeholder="e.g., John Doe" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="customerEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Email (Optional)</FormLabel>
                    <FormControl><Input placeholder="john.doe@example.com" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="defaultRevenueAccount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default Revenue Account (Optional)</FormLabel>
                    <FormControl><Input placeholder="e.g., Sales Revenue" {...field} /></FormControl>
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
            <AlertDialogDescription>This action cannot be undone. This will permanently delete the customer "{selectedCustomer?.customerName}".</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCustomer} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch Delete Confirmation Dialog */}
      <AlertDialog open={isBatchDeleteConfirmOpen} onOpenChange={setIsBatchDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete the {selectedRows.length} selected customers.</AlertDialogDescription>
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
