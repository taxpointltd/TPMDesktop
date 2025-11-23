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
import { Vendor, ChartOfAccount, Customer } from '@/lib/types';
import { useStore } from '@/lib/store';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';


const vendorSchema = z.object({
  vendorName: z.string().min(1, 'Vendor name is required.'),
  vendorEmail: z.string().email('Invalid email address.').optional().or(z.literal('')),
  defaultExpenseAccount: z.string().optional(),
});

type VendorFormValues = z.infer<typeof vendorSchema>;

const PAGE_SIZE = 10;

// LinkAccountDialog Component
const LinkAccountDialog = ({ open, onOpenChange, vendor, onLink, accounts }: { open: boolean, onOpenChange: (open: boolean) => void, vendor: Vendor, onLink: (accountId: string) => void, accounts: ChartOfAccount[] }) => {
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
              Select an account from your Chart of Accounts to link to "{vendor.vendorName}".
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


export default function VendorsPage() {
  const params = useParams() as { companyId: string };
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { chartOfAccounts, setVendors, setCustomers, setChartOfAccounts } = useStore();

  const [vendors, setVendorsState] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [firstVisible, setFirstVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [isLastPage, setIsLastPage] = useState(false);
  const [page, setPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  }>({ key: 'vendorName', direction: 'asc' });
  const [searchTerm, setSearchTerm] = useState('');

  // State for modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [isBatchDeleteConfirmOpen, setIsBatchDeleteConfirmOpen] = useState(false);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [vendorToLink, setVendorToLink] = useState<Vendor | null>(null);


  const form = useForm<VendorFormValues>({
    resolver: zodResolver(vendorSchema),
    defaultValues: {
      vendorName: '',
      vendorEmail: '',
      defaultExpenseAccount: '',
    },
  });

  const vendorsCollectionRef = useMemoFirebase(() => {
    if (!user || !firestore || !params.companyId) return null;
    return collection(firestore, `/users/${user.uid}/companies/${params.companyId}/vendors`);
  }, [firestore, user, params.companyId]);

  const fetchVendors = useCallback(async (direction: 'next' | 'prev' | 'first' = 'first') => {
    if (!vendorsCollectionRef) return;
    setIsLoading(true);

    let q;
    const { key, direction: sortDirection } = sortConfig;
    
    // Resetting to first page
    if (direction === 'first') {
      q = query(vendorsCollectionRef, orderBy(key, sortDirection), limit(PAGE_SIZE));
      setPage(1);
    } else if (direction === 'next' && lastVisible) {
      q = query(vendorsCollectionRef, orderBy(key, sortDirection), startAfter(lastVisible), limit(PAGE_SIZE));
    } else if (direction === 'prev' && firstVisible) {
      q = query(vendorsCollectionRef, orderBy(key, sortDirection), endBefore(firstVisible), limitToLast(PAGE_SIZE));
    } else {
        // Fallback to first page if pagination state is weird
        q = query(vendorsCollectionRef, orderBy(key, sortDirection), limit(PAGE_SIZE));
        setPage(1);
    }

    try {
      const documentSnapshots = await getDocs(q);
      const newVendors = documentSnapshots.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Vendor[];
      
      if (documentSnapshots.docs.length > 0) {
        setVendorsState(newVendors);
        setLastVisible(documentSnapshots.docs[documentSnapshots.docs.length - 1]);
        setFirstVisible(documentSnapshots.docs[0]);
        setIsLastPage(documentSnapshots.docs.length < PAGE_SIZE);
      } else {
        if (direction === 'first') {
          setVendorsState([]);
        }
        setIsLastPage(true);
      }
    } catch (error) {
      console.error('VendorsPage: Error fetching vendors:', error);
      setVendorsState([]);
      toast({
        variant: 'destructive',
        title: 'Error fetching vendors',
        description: 'Could not load vendor data. Please check your connection and permissions.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [vendorsCollectionRef, lastVisible, firstVisible, sortConfig, toast]);
  
  // Fetch all data for Zustand store (for AI interlinking)
  useEffect(() => {
    if (!user || !firestore || !params.companyId) return;

    const fetchAllData = async () => {
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
      }
    };
    fetchAllData();
  }, [user, firestore, params.companyId, setVendors, setCustomers, setChartOfAccounts, toast]);

  useEffect(() => {
    if (vendorsCollectionRef) {
      fetchVendors('first');
    }
  }, [vendorsCollectionRef, sortConfig, fetchVendors]);

  const filteredVendors = useMemo(() => {
    if (!searchTerm) return vendors;
    return vendors.filter(vendor =>
      vendor.vendorName && vendor.vendorName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [vendors, searchTerm]);

  const handleNextPage = () => {
    if (!isLastPage) {
      setPage(page + 1);
      fetchVendors('next');
    }
  };

  const handlePrevPage = () => {
    if (page > 1) {
      setPage(page - 1);
      fetchVendors('prev');
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
    setSelectedVendor(null);
    form.reset({ vendorName: '', vendorEmail: '', defaultExpenseAccount: '' });
    setIsFormOpen(true);
  };

  const openEditModal = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    form.reset({
      vendorName: vendor.vendorName,
      vendorEmail: vendor.vendorEmail || '',
      defaultExpenseAccount: vendor.defaultExpenseAccount || '',
    });
    setIsFormOpen(true);
  };

  const openDeleteConfirm = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setIsDeleteConfirmOpen(true);
  };

  const handleLinkAccount = async (accountId: string) => {
    if (!vendorToLink || !user || !firestore) return;
  
    const vendorRef = doc(firestore, `/users/${user.uid}/companies/${params.companyId}/vendors/${vendorToLink.id}`);
    const accountRef = doc(firestore, `/users/${user.uid}/companies/${params.companyId}/chartOfAccounts/${accountId}`);
  
    try {
      const batch = writeBatch(firestore);
      batch.update(vendorRef, { defaultExpenseAccountId: accountId });
      batch.update(accountRef, { defaultVendorId: vendorToLink.id });
      await batch.commit();
  
      toast({ title: 'Link Successful', description: `Vendor "${vendorToLink.vendorName}" linked to account.` });
      fetchVendors('first'); // Refresh data
    } catch (error) {
      console.error("Error linking account:", error);
      toast({ variant: 'destructive', title: 'Link Failed' });
    }
    setVendorToLink(null);
  };

  const handleFormSubmit = async (values: VendorFormValues) => {
    if (!vendorsCollectionRef || !firestore || !user) return;
  
    let accountId = '';
    if (values.defaultExpenseAccount) {
      const coaRef = collection(firestore, `/users/${user.uid}/companies/${params.companyId}/chartOfAccounts`);
      const q = query(coaRef, where('accountName', '==', values.defaultExpenseAccount));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        accountId = querySnapshot.docs[0].id;
      } else {
        toast({
          variant: 'destructive',
          title: 'Account Not Found',
          description: `The account "${values.defaultExpenseAccount}" does not exist in your Chart of Accounts. Please create it first.`,
        });
        return;
      }
    }
  
    const dataToSave = {
      companyId: params.companyId,
      vendorName: values.vendorName,
      vendorEmail: values.vendorEmail || '',
      defaultExpenseAccount: values.defaultExpenseAccount || '',
      defaultExpenseAccountId: accountId,
    };
  
    try {
      if (selectedVendor) {
        const docRef = doc(vendorsCollectionRef, selectedVendor.id);
        await setDoc(docRef, dataToSave, { merge: true });
        toast({ title: 'Vendor updated', description: `"${values.vendorName}" has been updated.` });
      } else {
        await addDoc(vendorsCollectionRef, dataToSave);
        toast({ title: 'Vendor created', description: `"${values.vendorName}" has been added.` });
      }
      setIsFormOpen(false);
      fetchVendors('first'); 
      setSelectedRows([]);
    } catch (error) {
        console.error('Error saving vendor:', error);
        const permissionError = new FirestorePermissionError({
            path: selectedVendor ? doc(vendorsCollectionRef, selectedVendor.id).path : vendorsCollectionRef.path,
            operation: selectedVendor ? 'update' : 'create',
            requestResourceData: dataToSave,
          });
        errorEmitter.emit('permission-error', permissionError);
        toast({ variant: 'destructive', title: 'Save failed', description: 'Could not save the vendor. Check permissions.' });
    }
  };

  const handleDeleteVendor = async () => {
    if (!selectedVendor || !vendorsCollectionRef) return;
    try {
      const docRef = doc(vendorsCollectionRef, selectedVendor.id);
      await deleteDoc(docRef);
      toast({ title: 'Vendor deleted', description: `"${selectedVendor.vendorName}" has been deleted.` });
      setIsDeleteConfirmOpen(false);
      setSelectedVendor(null);
      fetchVendors('first');
      setSelectedRows([]);
    } catch (error) {
        console.error('Error deleting vendor:', error);
        const permissionError = new FirestorePermissionError({
            path: doc(vendorsCollectionRef, selectedVendor.id).path,
            operation: 'delete',
          });
        errorEmitter.emit('permission-error', permissionError);
        toast({ variant: 'destructive', title: 'Delete failed', description: 'Could not delete the vendor. Check permissions.' });
    }
  };

  const handleBatchDelete = async () => {
    if (!firestore || !vendorsCollectionRef || selectedRows.length === 0) return;
    const batch = writeBatch(firestore);
    selectedRows.forEach(vendorId => {
      const docRef = doc(vendorsCollectionRef, vendorId);
      batch.delete(docRef);
    });
    try {
      await batch.commit();
      toast({ title: `${selectedRows.length} vendors deleted.` });
      setIsBatchDeleteConfirmOpen(false);
      setSelectedRows([]);
      fetchVendors('first');
    } catch (error) {
      console.error('Error batch deleting vendors:', error);
      toast({ variant: 'destructive', title: 'Delete failed', description: 'Could not delete the selected vendors. Check permissions.' });
    }
  };

  const handleSelectAll = (checked: boolean | string) => {
    if (checked) {
      setSelectedRows(filteredVendors.map(v => v.id));
    } else {
      setSelectedRows([]);
    }
  };
  
  const handleRowSelect = (vendorId: string, checked: boolean | string) => {
    if (checked) {
      setSelectedRows(prev => [...prev, vendorId]);
    } else {
      setSelectedRows(prev => prev.filter(id => id !== vendorId));
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
          <h1 className="text-3xl font-bold tracking-tight">Vendors</h1>
          <p className="text-muted-foreground">Manage vendors for company <span className="font-mono bg-muted px-2 py-1 rounded">{params.companyId}</span>.</p>
        </div>
        <div className="flex items-center gap-2">
            {selectedRows.length > 0 && (
                <Button variant="destructive" onClick={() => setIsBatchDeleteConfirmOpen(true)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete ({selectedRows.length})
                </Button>
            )}
            <Button onClick={openAddModal}><PlusCircle className="mr-2 h-4 w-4" />Add Vendor</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Vendor List</CardTitle>
              <CardDescription>A list of all vendors associated with your company.</CardDescription>
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
                      checked={selectedRows.length > 0 && selectedRows.length === filteredVendors.length && filteredVendors.length > 0}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('vendorName')}><div className="flex items-center">Name {getSortIcon('vendorName')}</div></TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('vendorEmail')}><div className="flex items-center">Contact Email {getSortIcon('vendorEmail')}</div></TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('defaultExpenseAccount')}><div className="flex items-center">Default Expense Account {getSortIcon('defaultExpenseAccount')}</div></TableHead>
                  <TableHead>Link</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /></TableCell></TableRow>
                ) : filteredVendors.length > 0 ? (
                  filteredVendors.map((vendor) => (
                    <TableRow key={vendor.id} data-state={selectedRows.includes(vendor.id) && "selected"}>
                      <TableCell padding="checkbox" className="px-4">
                        <Checkbox
                            checked={selectedRows.includes(vendor.id)}
                            onCheckedChange={(checked) => handleRowSelect(vendor.id, checked)}
                            aria-label="Select row"
                        />
                      </TableCell>
                      <TableCell className="font-medium">{vendor.vendorName}</TableCell>
                      <TableCell>{vendor.vendorEmail || 'N/A'}</TableCell>
                      <TableCell>{vendor.defaultExpenseAccount || 'N/A'}</TableCell>
                      <TableCell>
                        {vendor.defaultExpenseAccountId && (
                          <LinkIcon className="h-4 w-4 text-accent" />
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">Open menu</span><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setVendorToLink(vendor); setIsLinkDialogOpen(true); }}><LinkIcon className="mr-2 h-4 w-4" />Link Account</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditModal(vendor)}><Edit className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openDeleteConfirm(vendor)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No vendors found. Import them or add a new one.</TableCell></TableRow>
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
      {vendorToLink && (
        <LinkAccountDialog
          open={isLinkDialogOpen}
          onOpenChange={setIsLinkDialogOpen}
          vendor={vendorToLink}
          onLink={handleLinkAccount}
          accounts={chartOfAccounts}
        />
      )}

      {/* Add/Edit Vendor Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{selectedVendor ? 'Edit Vendor' : 'Add New Vendor'}</DialogTitle>
            <DialogDescription>{selectedVendor ? 'Update the details of your vendor.' : 'Fill in the information for the new vendor.'}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-4">
              <FormField
                control={form.control}
                name="vendorName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vendor Name</FormLabel>
                    <FormControl><Input placeholder="e.g., Office Supplies Inc." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="vendorEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Email (Optional)</FormLabel>
                    <FormControl><Input placeholder="contact@example.com" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="defaultExpenseAccount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default Expense Account (Optional)</FormLabel>
                    <FormControl><Input placeholder="e.g., Office Supplies" {...field} /></FormControl>
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
            <AlertDialogDescription>This action cannot be undone. This will permanently delete the vendor "{selectedVendor?.vendorName}".</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteVendor} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch Delete Confirmation Dialog */}
      <AlertDialog open={isBatchDeleteConfirmOpen} onOpenChange={setIsBatchDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete the {selectedRows.length} selected vendors.</AlertDialogDescription>
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
