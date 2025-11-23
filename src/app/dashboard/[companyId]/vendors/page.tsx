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
import { PlusCircle, Loader2, MoreHorizontal, Edit, Trash2, ArrowUpDown } from 'lucide-react';
import { useMemoFirebase } from '@/firebase/provider';
import { useParams } from 'next/navigation';
import React, { useState, useEffect, useCallback } from 'react';

interface Vendor {
  id: string;
  name: string;
  contactEmail?: string;
  defaultExpenseAccount?: string;
}

const PAGE_SIZE = 10;

export default function VendorsPage() {
  const params = useParams() as { companyId: string };
  const { user } = useUser();
  const firestore = useFirestore();

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastVisible, setLastVisible] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [firstVisible, setFirstVisible] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [isLastPage, setIsLastPage] = useState(false);
  const [page, setPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  }>({ key: 'Name', direction: 'asc' });

  const vendorsCollectionRef = useMemoFirebase(() => {
    if (!user || !firestore || !params.companyId) {
      console.log('VendorsPage: Skipping collection ref creation, missing user, firestore or companyId');
      return null;
    }
    const path = `/users/${user.uid}/companies/${params.companyId}/vendors`;
    console.log('VendorsPage: Creating collection reference for path:', path);
    return collection(firestore, path);
  }, [firestore, user, params.companyId]);

  const fetchVendors = useCallback(
    async (direction: 'next' | 'prev' | 'first' = 'first') => {
      if (!vendorsCollectionRef) {
        console.log('VendorsPage: fetchVendors called but collection ref is not ready.');
        return;
      }
      setIsLoading(true);
      console.log(`VendorsPage: Starting fetchVendors... Direction: ${direction}, Page: ${page}`);

      let q;
      const { key, direction: sortDirection } = sortConfig;

      if (direction === 'next' && lastVisible) {
        q = query(
          vendorsCollectionRef,
          orderBy(key, sortDirection),
          startAfter(lastVisible),
          limit(PAGE_SIZE)
        );
      } else if (direction === 'prev' && firstVisible) {
        q = query(
          vendorsCollectionRef,
          orderBy(key, sortDirection),
          endBefore(firstVisible),
          limitToLast(PAGE_SIZE)
        );
      } else {
        q = query(
          vendorsCollectionRef,
          orderBy(key, sortDirection),
          limit(PAGE_SIZE)
        );
        setPage(1);
      }

      try {
        const documentSnapshots = await getDocs(q);
        console.log(`VendorsPage: getDocs returned ${documentSnapshots.docs.length} documents.`);

        if (documentSnapshots.empty) {
            if (direction === 'first') {
                console.log('VendorsPage: No vendors found on first fetch.');
                setVendors([]);
                setLastVisible(null);
                setFirstVisible(null);
                setIsLastPage(true);
            } else if (direction === 'next') {
                setIsLastPage(true);
            }
        } else {
            const newVendors = documentSnapshots.docs.map((doc: DocumentData) => {
              const data = doc.data();
              console.log('VendorsPage: Raw data from Firestore doc:', data);
              return {
                id: doc.id,
                name: data['Name'] || 'N/A', 
                contactEmail: data['Contact Email'],
                defaultExpenseAccount: data['Default Expense Account'],
              } as Vendor;
            });
            console.log('VendorsPage: Mapped vendors data:', newVendors);
            setVendors(newVendors);
            setLastVisible(documentSnapshots.docs[documentSnapshots.docs.length - 1]);
            setFirstVisible(documentSnapshots.docs[0]);
            setIsLastPage(documentSnapshots.docs.length < PAGE_SIZE);
        }
      } catch (error) {
        console.error('VendorsPage: Error fetching vendors:', error);
        setVendors([]);
      } finally {
        setIsLoading(false);
        console.log('VendorsPage: fetchVendors finished.');
      }
    },
    [vendorsCollectionRef, lastVisible, firstVisible, sortConfig, page]
  );

  useEffect(() => {
    console.log('VendorsPage: useEffect for fetch triggered. vendorsCollectionRef is:', vendorsCollectionRef ? 'ready' : 'not ready');
    if (vendorsCollectionRef) {
      fetchVendors('first');
    } else {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorsCollectionRef, sortConfig]);

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
    setSortConfig((prev) => {
      const newDirection =
        prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc';
      return { key, direction: newDirection };
    });
    // Reset pagination state when sorting changes
    setLastVisible(null);
    setFirstVisible(null);
    setPage(1);
    setIsLastPage(false);
  };

  const getSortIcon = (key: string) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />;
    }
    return sortConfig.direction === 'asc' ? (
      <ArrowUpDown className="ml-2 h-4 w-4" /> // Replace with ArrowUp icon if you want specific direction
    ) : (
      <ArrowUpDown className="ml-2 h-4 w-4" /> // Replace with ArrowDown icon
    );
  };
  
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
                  <TableHead className="cursor-pointer" onClick={() => handleSort('Name')}>
                    <div className="flex items-center">
                      Name {getSortIcon('Name')}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('Contact Email')}>
                    <div className="flex items-center">
                      Contact Email {getSortIcon('Contact Email')}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('Default Expense Account')}>
                    <div className="flex items-center">
                      Default Expense Account {getSortIcon('Default Expense Account')}
                    </div>
                  </TableHead>
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
    </div>
  );
}
