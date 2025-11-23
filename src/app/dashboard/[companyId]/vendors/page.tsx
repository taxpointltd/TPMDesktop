'use client';

import { useFirestore, useUser } from '@/firebase';
import {
  collection,
  query,
  getDocs,
  DocumentData,
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
import { PlusCircle, Loader2, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { useMemoFirebase } from '@/firebase/provider';
import { useParams } from 'next/navigation';
import React, { useState, useEffect, useCallback } from 'react';

interface Vendor {
  id: string;
  name: string;
  contactEmail?: string;
  defaultExpenseAccount?: string;
}

export default function VendorsPage() {
  const params = useParams() as { companyId: string };
  const { user } = useUser();
  const firestore = useFirestore();

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const vendorsCollectionRef = useMemoFirebase(() => {
    if (!user || !firestore || !params.companyId) {
      console.log('VendorsPage: Skipping collection ref creation, missing user, firestore or companyId');
      return null;
    }
    const path = `/users/${user.uid}/companies/${params.companyId}/vendors`;
    console.log('VendorsPage: Creating collection reference for path:', path);
    return collection(firestore, path);
  }, [firestore, user, params.companyId]);

  const fetchVendors = useCallback(async () => {
    if (!vendorsCollectionRef) {
      console.log('VendorsPage: fetchVendors called but collection ref is not ready.');
      return;
    }
    setIsLoading(true);
    console.log('VendorsPage: Starting fetchVendors...');

    try {
      const q = query(vendorsCollectionRef);
      const documentSnapshots = await getDocs(q);
      console.log(`VendorsPage: getDocs returned ${documentSnapshots.docs.length} documents.`);

      if (documentSnapshots.empty) {
        console.log('VendorsPage: No vendors found in the collection.');
        setVendors([]);
      } else {
        const newVendors = documentSnapshots.docs.map((doc: DocumentData) => {
          const data = doc.data();
          console.log('VendorsPage: Raw data from Firestore doc:', data);
          return {
            id: doc.id,
            name: data['Name'] || 'N/A', // Corrected mapping
            contactEmail: data['Contact Email'], // Corrected mapping
            defaultExpenseAccount: data['Default Expense Account'], // Corrected mapping
          } as Vendor;
        });
        console.log('VendorsPage: Mapped vendors data:', newVendors);
        setVendors(newVendors);
      }
    } catch (error) {
      console.error('VendorsPage: Error fetching vendors:', error);
      setVendors([]);
    } finally {
      setIsLoading(false);
      console.log('VendorsPage: fetchVendors finished.');
    }
  }, [vendorsCollectionRef]);

  useEffect(() => {
    console.log('VendorsPage: useEffect triggered. vendorsCollectionRef is:', vendorsCollectionRef ? 'ready' : 'not ready');
    if (vendorsCollectionRef) {
      fetchVendors();
    } else {
      // If the collection ref isn't ready, we might be waiting for user/firestore, set loading to false
      setIsLoading(false);
    }
  }, [vendorsCollectionRef, fetchVendors]);
  
  console.log(`VendorsPage: Rendering component. Current vendors state count: ${vendors.length} isLoading: ${isLoading}`);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vendors</h1>
          <p className="text-muted-foreground">
            Manage vendors for company{' '}
            <span className="font-mono bg-muted px-2 py-1 rounded">
              {params.companyId}
            </span>
            .
          </p>
        </div>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Vendor
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vendor List</CardTitle>
          <CardDescription>
            A list of all vendors associated with your company.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact Email</TableHead>
                  <TableHead>Default Expense Account</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center">
                      <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                    </TableCell>
                  </TableRow>
                ) : vendors && vendors.length > 0 ? (
                  vendors.map((vendor) => (
                    <TableRow key={vendor.id}>
                      <TableCell className="font-medium">
                        {vendor.name}
                      </TableCell>
                      <TableCell>{vendor.contactEmail || 'N/A'}</TableCell>
                      <TableCell>
                        {vendor.defaultExpenseAccount || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-muted-foreground"
                    >
                      No vendors found. Import them from the Data Import page.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
