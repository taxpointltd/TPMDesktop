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
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
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

interface Customer {
  id: string;
  name: string;
  contactEmail?: string;
  defaultRevenueAccount?: string;
}

const customerSchema = z.object({
  name: z.string().min(1, 'Customer name is required.'),
  contactEmail: z.string().email('Invalid email address.').optional().or(z.literal('')),
  defaultRevenueAccount: z.string().optional(),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

const PAGE_SIZE = 10;

export default function CustomersPage() {
  const params = useParams() as { companyId: string };
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [firstVisible, setFirstVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [isLastPage, setIsLastPage] = useState(false);
  const [page, setPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  }>({ key: 'name', direction: 'asc' });

  // State for modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: '',
      contactEmail: '',
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

    if (direction === 'next' && lastVisible) {
      q = query(customersCollectionRef, orderBy(key, sortDirection), startAfter(lastVisible), limit(PAGE_SIZE));
    } else if (direction === 'prev' && firstVisible) {
      q = query(customersCollectionRef, orderBy(key, sortDirection), endBefore(firstVisible), limitToLast(PAGE_SIZE));
    } else {
      q = query(customersCollectionRef, orderBy(key, sortDirection), limit(PAGE_SIZE));
      setPage(1);
    }

    try {
      const documentSnapshots = await getDocs(q);
      const newCustomers = documentSnapshots.docs.map((doc: DocumentData) => ({
        id: doc.id,
        name: doc.data()['name'] || 'N/A',
        contactEmail: doc.data()['contactEmail'],
        defaultRevenueAccount: doc.data()['defaultRevenueAccount'],
      }));

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
  }, [customersCollectionRef, sortConfig]);

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
  };
  
  const openAddModal = () => {
    setSelectedCustomer(null);
    form.reset({ name: '', contactEmail: '', defaultRevenueAccount: '' });
    setIsFormOpen(true);
  };

  const openEditModal = (customer: Customer) => {
    setSelectedCustomer(customer);
    form.reset({
      name: customer.name,
      contactEmail: customer.contactEmail || '',
      defaultRevenueAccount: customer.defaultRevenueAccount || '',
    });
    setIsFormOpen(true);
  };

  const openDeleteConfirm = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsDeleteConfirmOpen(true);
  };

  const handleFormSubmit = async (values: CustomerFormValues) => {
    if (!customersCollectionRef) return;

    const dataToSave = {
      'name': values.name,
      'contactEmail': values.contactEmail || null,
      'defaultRevenueAccount': values.defaultRevenueAccount || null,
      'companyId': params.companyId,
    };

    try {
      if (selectedCustomer) {
        const docRef = doc(customersCollectionRef, selectedCustomer.id);
        await setDoc(docRef, dataToSave, { merge: true });
        toast({ title: 'Customer updated', description: `"${values.name}" has been updated.` });
      } else {
        await addDoc(customersCollectionRef, dataToSave);
        toast({ title: 'Customer created', description: `"${values.name}" has been added.` });
      }
      setIsFormOpen(false);
      fetchCustomers('first');
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
      toast({ title: 'Customer deleted', description: `"${selectedCustomer.name}" has been deleted.` });
      setIsDeleteConfirmOpen(false);
      setSelectedCustomer(null);
      fetchCustomers('first');
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
        <Button onClick={openAddModal}><PlusCircle className="mr-2 h-4 w-4" />Add Customer</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer List</CardTitle>
          <CardDescription>A list of all customers associated with your company.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('name')}><div className="flex items-center">Name {getSortIcon('name')}</div></TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('contactEmail')}><div className="flex items-center">Contact Email {getSortIcon('contactEmail')}</div></TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('defaultRevenueAccount')}><div className="flex items-center">Default Revenue Account {getSortIcon('defaultRevenueAccount')}</div></TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={4} className="text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /></TableCell></TableRow>
                ) : customers.length > 0 ? (
                  customers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell>{customer.contactEmail || 'N/A'}</TableCell>
                      <TableCell>{customer.defaultRevenueAccount || 'N/A'}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">Open menu</span><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditModal(customer)}><Edit className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openDeleteConfirm(customer)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No customers found. Import them or add a new one.</TableCell></TableRow>
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
                name="name"
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
                name="contactEmail"
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete the customer "{selectedCustomer?.name}".</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCustomer} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
