'use client';

import { useFirestore, useUser } from '@/firebase';
import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  QueryDocumentSnapshot,
  DocumentData,
  endBefore,
  limitToLast,
  doc,
  deleteDoc,
  setDoc,
  addDoc,
  where,
  writeBatch,
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
import { useMemoFirebase } from '@/firebase/provider';
import { useParams } from 'next/navigation';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Customer, ChartOfAccount } from '@/lib/types';
import { useStore } from '@/lib/store';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';


const customerSchema = z.object({
  customerName: z.string().min(1, 'Customer name is required.'),
  customerEmail: z.string().email('Invalid email address.').optional().or(z.literal('')),
  defaultRevenueAccount: z.string().optional(),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

const PAGE_SIZE = 10;

// LinkAccountDialog Component
const LinkAccountDialog = ({ open, onOpenChange, customer, onLink, accounts }: { open: boolean, onOpenChange: (open: boolean) => void, customer: Customer, onLink: (accountId: string) => void, accounts: ChartOfAccount[] }) => {
    const [popoverOpen, setPopoverOpen] = useState(false);
    const [selectedAccountId, setSelectedAccountId] = useState('');
  
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
  const { chartOfAccounts } = useStore();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [firstVisible, setFirstVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [isLastPage, setIsLastPage] = useState(false);
  const [page, setPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
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

  const customersCollectionRef = useMemoFirebase(() => {
    if (!user || !firestore || !params.companyId) return null;
    return collection(firestore, `/users/${user.uid}/companies/${params.companyId}/customers`);
  }, [firestore, user, params.companyId]);

  const fetchCustomers = useCallback(async (direction: 'next' | 'prev' | 'first' = 'first') => {
    if (!customersCollectionRef) return;
    setIsLoading(true);

    let q;
    const { key, direction: sortDirection } = sortConfig;
    
    // Resetting to first page
    if (direction === 'first') {
      q = query(customersCollectionRef, orderBy(key, sortDirection), limit(PAGE_SIZE));
      setPage(1);
    } else if (direction === 'next' && lastVisible) {
      q = query(customersCollectionRef, orderBy(key, sortDirection), startAfter(lastVisible), limit(PAGE_SIZE));
    } else if (direction === 'prev' && firstVisible) {
      q = query(customersCollectionRef, orderBy(key, sortDirection), endBefore(firstVisible), limitToLast(PAGE_SIZE));
    } else {
        // Fallback to first page if pagination state is weird
        q = query(customersCollectionRef, orderBy(key, sortDirection), limit(PAGE_SIZE));
        setPage(1);
    }

    try {
      const documentSnapshots = await getDocs(q);
      const newCustomers = documentSnapshots.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Customer[];

      if (documentSnapshots.docs.length > 0) {
        setCustomers(newCustomers);
        setLastVisible(documentSnapshots.docs[documentSnapshots.docs.length - 1]);
        setFirstVisible(documentSnapshots.docs[0]);
        setIsLastPage(documentSnapshots.docs.length < PAGE_SIZE);
      } else {
        if (direction === 'first') {
            setCustomers([]);
        }
        setIsLastPage(true);
      }
    } catch (error) {
      console.error('CustomersPage: Error fetching customers:', error);
      setCustomers([]);
      toast({
        variant: 'destructive',
        title: 'Error fetching customers',
        description: 'Could not load customer data. Please check your connection and permissions.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [customersCollectionRef, lastVisible, firstVisible, sortConfig, toast]);

  useEffect(() => {
    if (customersCollectionRef) {
      fetchCustomers('first');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customersCollectionRef, sortConfig]);

  const filteredCustomers = useMemo(() => {
    if (!searchTerm) return customers;
    return customers.filter(customer =>
        customer.customerName && customer.customerName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [customers, searchTerm]);

  const handleNextPage = () => {
    if (!isLastPage) {
      setPage(page + 1);
      fetchCustomers('next');
    }
  };

  const handlePrevPage = () => {
    if (page > 1) {
      setPage(page - 1);
      fetchCustomers('prev');
    }
  };

  const handleSort = (key: string) => {
    setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
    setLastVisible(null);
    setFirstVisible(null);
    setPage(1);
    setIsLastPage(false);
    setSelectedRows([]);
  };
  
  const openAddModal = () => {
    setSelectedCustomer(null);
    form.reset({ customerName: '', customerEmail: '', defaultRevenueAccount: '' });
    setIsFormOpen(true);
  };

  const openEditModal = (customer: Customer) => {
    setSelectedCustomer(customer);
    form.reset({
      customerName: customer.customerName,
      customerEmail: customer.customerEmail || '',
      defaultRevenueAccount: customer.defaultRevenueAccount || '',
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
  
      toast({ title: 'Link Successful', description: `Customer "${customerToLink.customerName}" linked to account.` });
      fetchCustomers('first'); // Refresh data
    } catch (error) {
      console.error("Error linking account:", error);
      toast({ variant: 'destructive', title: 'Link Failed' });
    }
    setCustomerToLink(null);
  };

  const handleFormSubmit = async (values: CustomerFormValues) => {
    if (!customersCollectionRef || !firestore || !user) return;
  
    let accountId = '';
    if (values.defaultRevenueAccount) {
      const coaRef = collection(firestore, `/users/${user.uid}/companies/${params.companyId}/chartOfAccounts`);
      const q = query(coaRef, where('accountName', '==', values.defaultRevenueAccount));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        accountId = querySnapshot.docs[0].id;
      } else {
        toast({
          variant: 'destructive',
          title: 'Account Not Found',
          description: `The account "${values.defaultRevenueAccount}" does not exist in your Chart of Accounts. Please create it first.`,
        });
        return; 
      }
    }
  
    const dataToSave = {
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
        toast({ title: 'Customer updated', description: `"${values.customerName}" has been updated.` });
      } else {
        await addDoc(customersCollectionRef, dataToSave);
        toast({ title: 'Customer created', description: `"${values.customerName}" has been added.` });
      }
      setIsFormOpen(false);
      fetchCustomers('first');
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
    if (!selectedCustomer || !customersCollectionRef) return;
    try {
      const docRef = doc(customersCollectionRef, selectedCustomer.id);
      await deleteDoc(docRef);
      toast({ title: 'Customer deleted', description: `"${selectedCustomer.customerName}" has been deleted.` });
      setIsDeleteConfirmOpen(false);
      setSelectedCustomer(null);
      fetchCustomers('first');
      setSelectedRows([]);
    } catch (error) {
        console.error('Error deleting customer:', error);
        const permissionError = new FirestorePermissionError({
            path: doc(customersCollectionRef, selectedCustomer.id).path,
            operation: 'delete',
          });
        errorEmitter.emit('permission-error', permissionError);
        toast({ variant: 'destructive', title: 'Delete failed', description: 'Could not delete the customer. Check permissions.' });
    }
  };

  const handleBatchDelete = async () => {
    if (!firestore || !customersCollectionRef || selectedRows.length === 0) return;
    const batch = writeBatch(firestore);
    selectedRows.forEach(customerId => {
      const docRef = doc(customersCollectionRef, customerId);
      batch.delete(docRef);
    });
    try {
      await batch.commit();
      toast({ title: `${selectedRows.length} customers deleted.` });
      setIsBatchDeleteConfirmOpen(false);
      setSelectedRows([]);
      fetchCustomers('first');
    } catch (error) {
      console.error('Error batch deleting customers:', error);
      toast({ variant: 'destructive', title: 'Delete failed', description: 'Could not delete the selected customers. Check permissions.' });
    }
  };
  
  const handleSelectAll = (checked: boolean | string) => {
    if (checked) {
      setSelectedRows(filteredCustomers.map(c => c.id));
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
                      checked={selectedRows.length > 0 && selectedRows.length === filteredCustomers.length && filteredCustomers.length > 0}
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
                ) : filteredCustomers.length > 0 ? (
                  filteredCustomers.map((customer) => (
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
                      <TableCell>{customer.defaultRevenueAccount || 'N/A'}</TableCell>
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
          <div className="flex items-center justify-end space-x-2 py-4">
            <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={page <= 1 || isLoading}>Previous</Button>
            <Button variant="outline" size="sm" onClick={handleNextPage} disabled={isLastPage || isLoading}>Next</Button>
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
