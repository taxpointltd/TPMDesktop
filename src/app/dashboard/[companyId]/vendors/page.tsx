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
import { Vendor } from '@/lib/types';


const vendorSchema = z.object({
  'Name': z.string().min(1, 'Vendor name is required.'),
  'Contact Email': z.string().email('Invalid email address.').optional().or(z.literal('')),
  'Default Expense Account': z.string().optional(),
});

type VendorFormValues = z.infer<typeof vendorSchema>;

const PAGE_SIZE = 10;

export default function VendorsPage() {
  const params = useParams() as { companyId: string };
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [firstVisible, setFirstVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [isLastPage, setIsLastPage] = useState(false);
  const [page, setPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  }>({ key: 'Name', direction: 'asc' });

  // State for modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);

  const form = useForm<VendorFormValues>({
    resolver: zodResolver(vendorSchema),
    defaultValues: {
      'Name': '',
      'Contact Email': '',
      'Default Expense Account': '',
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

    if (direction === 'next' && lastVisible) {
      q = query(vendorsCollectionRef, orderBy(key, sortDirection), startAfter(lastVisible), limit(PAGE_SIZE));
    } else if (direction === 'prev' && firstVisible) {
      q = query(vendorsCollectionRef, orderBy(key, sortDirection), endBefore(firstVisible), limitToLast(PAGE_SIZE));
    } else {
      q = query(vendorsCollectionRef, orderBy(key, sortDirection), limit(PAGE_SIZE));
      setPage(1);
    }

    try {
      const documentSnapshots = await getDocs(q);
      const newVendors = documentSnapshots.docs.map((doc: DocumentData) => ({
        id: doc.id,
        'Name': doc.data()['Name'] || 'N/A',
        'Contact Email': doc.data()['Contact Email'],
        'Default Expense Account': doc.data()['Default Expense Account'],
        companyId: doc.data()['companyId'],
      }));

      if (documentSnapshots.docs.length > 0) {
        setVendors(newVendors as Vendor[]);
        setLastVisible(documentSnapshots.docs[documentSnapshots.docs.length - 1]);
        setFirstVisible(documentSnapshots.docs[0]);
        setIsLastPage(documentSnapshots.docs.length < PAGE_SIZE);
      } else {
        if (direction === 'first') {
          setVendors([]);
        }
        setIsLastPage(true);
      }
    } catch (error) {
      console.error('VendorsPage: Error fetching vendors:', error);
      setVendors([]);
      toast({
        variant: 'destructive',
        title: 'Error fetching vendors',
        description: 'Could not load vendor data. Please check your connection and permissions.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [vendorsCollectionRef, lastVisible, firstVisible, sortConfig, toast]);

  useEffect(() => {
    if (vendorsCollectionRef) {
      fetchVendors('first');
    }
  }, [vendorsCollectionRef, sortConfig, fetchVendors]);

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
  };

  const openAddModal = () => {
    setSelectedVendor(null);
    form.reset({ 'Name': '', 'Contact Email': '', 'Default Expense Account': '' });
    setIsFormOpen(true);
  };

  const openEditModal = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    form.reset({
      'Name': vendor['Name'],
      'Contact Email': vendor['Contact Email'] || '',
      'Default Expense Account': vendor['Default Expense Account'] || '',
    });
    setIsFormOpen(true);
  };

  const openDeleteConfirm = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setIsDeleteConfirmOpen(true);
  };

  const handleFormSubmit = async (values: VendorFormValues) => {
    if (!vendorsCollectionRef) return;

    const dataToSave = {
      ...values,
      companyId: params.companyId,
    };

    try {
      if (selectedVendor) {
        const docRef = doc(vendorsCollectionRef, selectedVendor.id);
        await setDoc(docRef, dataToSave, { merge: true });
        toast({ title: 'Vendor updated', description: `"${values['Name']}" has been updated.` });
      } else {
        await addDoc(vendorsCollectionRef, dataToSave);
        toast({ title: 'Vendor created', description: `"${values['Name']}" has been added.` });
      }
      setIsFormOpen(false);
      fetchVendors('first'); 
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
      toast({ title: 'Vendor deleted', description: `"${selectedVendor['Name']}" has been deleted.` });
      setIsDeleteConfirmOpen(false);
      setSelectedVendor(null);
      fetchVendors('first'); 
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
        <Button onClick={openAddModal}><PlusCircle className="mr-2 h-4 w-4" />Add Vendor</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vendor List</CardTitle>
          <CardDescription>A list of all vendors associated with your company.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('Name')}><div className="flex items-center">Name {getSortIcon('Name')}</div></TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('Contact Email')}><div className="flex items-center">Contact Email {getSortIcon('Contact Email')}</div></TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('Default Expense Account')}><div className="flex items-center">Default Expense Account {getSortIcon('Default Expense Account')}</div></TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={4} className="text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /></TableCell></TableRow>
                ) : vendors.length > 0 ? (
                  vendors.map((vendor) => (
                    <TableRow key={vendor.id}>
                      <TableCell className="font-medium">{vendor['Name']}</TableCell>
                      <TableCell>{vendor['Contact Email'] || 'N/A'}</TableCell>
                      <TableCell>{vendor['Default Expense Account'] || 'N/A'}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">Open menu</span><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditModal(vendor)}><Edit className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openDeleteConfirm(vendor)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No vendors found. Import them or add a new one.</TableCell></TableRow>
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
                name="Name"
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
                name="Contact Email"
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
                name="Default Expense Account"
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete the vendor "{selectedVendor?.['Name']}".</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteVendor} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
