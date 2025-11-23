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
import { Input } from '@/components/ui/input';
import { PlusCircle, Loader2, MoreHorizontal, Edit, Trash2, ArrowUpDown } from 'lucide-react';
import { useMemoFirebase } from '@/firebase/provider';
import { useParams } from 'next/navigation';
import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ChartOfAccount } from '@/lib/types';


const accountSchema = z.object({
    accountName: z.string().min(1, 'Account name is required.'),
    accountNumber: z.string().optional(),
    accountType: z.string().optional(),
    description: z.string().optional(),
    subAccountName: z.string().optional(),
    subAccountNumber: z.string().optional(),
  });

type AccountFormValues = z.infer<typeof accountSchema>;

const PAGE_SIZE = 10;

export default function ChartOfAccountsPage() {
  const params = useParams() as { companyId: string };
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [firstVisible, setFirstVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [isLastPage, setIsLastPage] = useState(false);
  const [page, setPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  }>({ key: 'accountName', direction: 'asc' });

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


  const coaCollectionRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(
      firestore,
      `/users/${user.uid}/companies/${params.companyId}/chartOfAccounts`
    );
  }, [firestore, user, params.companyId]);

  const fetchAccounts = useCallback(
    async (direction: 'next' | 'prev' | 'first' = 'first') => {
      if (!coaCollectionRef) return;
      setIsLoading(true);

      let q;
      const { key, direction: sortDirection } = sortConfig;

      if (direction === 'next' && lastVisible) {
        q = query(
          coaCollectionRef,
          orderBy(key, sortDirection),
          startAfter(lastVisible),
          limit(PAGE_SIZE)
        );
      } else if (direction === 'prev' && firstVisible) {
        q = query(
          coaCollectionRef,
          orderBy(key, sortDirection),
          endBefore(firstVisible),
          limitToLast(PAGE_SIZE)
        );
      } else {
        q = query(
          coaCollectionRef,
          orderBy(key, sortDirection),
          limit(PAGE_SIZE)
        );
        setPage(1);
      }

      try {
        const documentSnapshots = await getDocs(q);
        const newAccounts = documentSnapshots.docs.map((doc) => ({
          accountId: doc.id,
          ...doc.data(),
        })) as ChartOfAccount[];
        
        if (!documentSnapshots.empty) {
          setAccounts(newAccounts);
          setLastVisible(
            documentSnapshots.docs[documentSnapshots.docs.length - 1]
          );
          setFirstVisible(documentSnapshots.docs[0]);
          setIsLastPage(documentSnapshots.docs.length < PAGE_SIZE);
        } else {
            if (direction === 'first') {
                setAccounts([]);
            }
          setIsLastPage(true);
        }
      } catch (error) {
        console.error('Error fetching accounts:', error);
        setAccounts([]);
        toast({
            variant: 'destructive',
            title: 'Error fetching accounts',
            description: 'Could not load chart of accounts data. Please check your connection and permissions.',
          });
      } finally {
        setIsLoading(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [coaCollectionRef, lastVisible, firstVisible, sortConfig, toast]
  );

  useEffect(() => {
    if (coaCollectionRef) {
      fetchAccounts('first');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coaCollectionRef, sortConfig]);


  const handleNextPage = () => {
    if (!isLastPage) {
      setPage(page + 1);
      fetchAccounts('next');
    }
  };

  const handlePrevPage = () => {
    if (page > 1) {
      setPage(page - 1);
      fetchAccounts('prev');
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
    if (!coaCollectionRef) return;

    const dataToSave: Omit<ChartOfAccount, 'accountId'> = {
      companyId: params.companyId,
      accountName: values.accountName,
      accountNumber: values.accountNumber || '',
      accountType: values.accountType || '',
      description: values.description || '',
      subAccountName: values.subAccountName || '',
      subAccountNumber: values.subAccountNumber || '',
      defaultVendorId: selectedAccount?.defaultVendorId || '',
      defaultCustomerId: selectedAccount?.defaultCustomerId || '',
      transactions: selectedAccount?.transactions || [],
    };

    try {
      if (selectedAccount) {
        const docRef = doc(coaCollectionRef, selectedAccount.accountId);
        await setDoc(docRef, dataToSave, { merge: true });
        toast({ title: 'Account updated', description: `"${values.accountName}" has been updated.` });
      } else {
        await addDoc(coaCollectionRef, dataToSave);
        toast({ title: 'Account created', description: `"${values.accountName}" has been added.` });
      }
      setIsFormOpen(false);
      fetchAccounts('first');
      setSelectedRows([]);
    } catch (error) {
        console.error('Error saving account:', error);
        const permissionError = new FirestorePermissionError({
            path: selectedAccount ? doc(coaCollectionRef, selectedAccount.accountId).path : coaCollectionRef.path,
            operation: selectedAccount ? 'update' : 'create',
            requestResourceData: dataToSave,
          });
        errorEmitter.emit('permission-error', permissionError);
        toast({ variant: 'destructive', title: 'Save failed', description: 'Could not save the account. Check permissions.' });
    }
  };

  const handleDeleteAccount = async () => {
    if (!selectedAccount || !coaCollectionRef) return;
    try {
      const docRef = doc(coaCollectionRef, selectedAccount.accountId);
      await deleteDoc(docRef);
      toast({ title: 'Account deleted', description: `"${selectedAccount.accountName}" has been deleted.` });
      setIsDeleteConfirmOpen(false);
      setSelectedAccount(null);
      fetchAccounts('first');
      setSelectedRows([]);
    } catch (error) {
        console.error('Error deleting account:', error);
        const permissionError = new FirestorePermissionError({
            path: doc(coaCollectionRef, selectedAccount.accountId).path,
            operation: 'delete',
          });
        errorEmitter.emit('permission-error', permissionError);
        toast({ variant: 'destructive', title: 'Delete failed', description: 'Could not delete the account. Check permissions.' });
    }
  };

  const handleBatchDelete = async () => {
    if (!firestore || !coaCollectionRef || selectedRows.length === 0) return;
    const batch = writeBatch(firestore);
    selectedRows.forEach(accountId => {
      const docRef = doc(coaCollectionRef, accountId);
      batch.delete(docRef);
    });
    try {
      await batch.commit();
      toast({ title: `${selectedRows.length} accounts deleted.` });
      setIsBatchDeleteConfirmOpen(false);
      setSelectedRows([]);
      fetchAccounts('first');
    } catch (error) {
      console.error('Error batch deleting accounts:', error);
      toast({ variant: 'destructive', title: 'Delete failed', description: 'Could not delete the selected accounts. Check permissions.' });
    }
  };

  const handleSelectAll = (checked: boolean | string) => {
    if (checked) {
      setSelectedRows(accounts.map(a => a.accountId));
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
            <Button onClick={openAddModal}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Account
            </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Accounts List</CardTitle>
          <CardDescription>
            A list of all accounts associated with your company.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead padding="checkbox" className="w-[50px] px-4">
                    <Checkbox
                      checked={selectedRows.length > 0 && selectedRows.length === accounts.length}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('accountName')}>
                    <div className="flex items-center">Account Name {getSortIcon('accountName')}</div>
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('accountNumber')}>
                    <div className="flex items-center">Account Number {getSortIcon('accountNumber')}</div>
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('accountType')}>
                    <div className="flex items-center">Account Type {getSortIcon('accountType')}</div>
                  </TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
                      <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                    </TableCell>
                  </TableRow>
                ) : accounts && accounts.length > 0 ? (
                  accounts.map((account) => (
                    <TableRow key={account.accountId} data-state={selectedRows.includes(account.accountId) && "selected"}>
                      <TableCell padding="checkbox" className="px-4">
                        <Checkbox
                          checked={selectedRows.includes(account.accountId)}
                          onCheckedChange={(checked) => handleRowSelect(account.accountId, checked)}
                          aria-label="Select row"
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {account.accountName}
                      </TableCell>
                      <TableCell>{account.accountNumber || 'N/A'}</TableCell>
                      <TableCell>{account.accountType || 'N/A'}</TableCell>
                      <TableCell>
                        {account.description || 'N/A'}
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
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
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
              onClick={handlePrevPage}
              disabled={page <= 1 || isLoading}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={isLastPage || isLoading}
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
