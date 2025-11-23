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
import { PlusCircle, Loader2, ArrowUpDown } from 'lucide-react';
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
    key: keyof Vendor;
    direction: 'asc' | 'desc';
  }>({ key: 'name', direction: 'asc' });

  const vendorsCollectionRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(
      firestore,
      `/users/${user.uid}/companies/${params.companyId}/vendors`
    );
  }, [firestore, user, params.companyId]);

  const fetchVendors = useCallback(
    async (direction: 'next' | 'prev' | 'first' = 'first') => {
      if (!vendorsCollectionRef) return;
      setIsLoading(true);

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
        const newVendors = documentSnapshots.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Vendor[];

        if (!documentSnapshots.empty) {
          setLastVisible(
            documentSnapshots.docs[documentSnapshots.docs.length - 1]
          );
          setFirstVisible(documentSnapshots.docs[0]);
          setVendors(newVendors);
          setIsLastPage(documentSnapshots.docs.length < PAGE_SIZE);
        } else if (direction !== 'first') {
          setIsLastPage(true);
        } else {
          setVendors([]);
          setIsLastPage(true);
        }
      } catch (error) {
        console.error('Error fetching vendors:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [vendorsCollectionRef, lastVisible, firstVisible, sortConfig]
  );

  useEffect(() => {
    fetchVendors();
  }, [sortConfig, vendorsCollectionRef]);

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

  const handleSort = (key: keyof Vendor) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === 'asc' ? 'desc' : 'asc',
        };
      }
      return { key, direction: 'asc' };
    });
  };

  const getSortIcon = (key: keyof Vendor) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />;
    }
    return sortConfig.direction === 'asc' ? (
      <ArrowUpDown className="ml-2 h-4 w-4" />
    ) : (
      <ArrowUpDown className="ml-2 h-4 w-4" />
    );
  };

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
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center">
                      Name {getSortIcon('name')}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => handleSort('contactEmail')}
                  >
                    <div className="flex items-center">
                      Contact Email {getSortIcon('contactEmail')}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => handleSort('defaultExpenseAccount')}
                  >
                    <div className="flex items-center">
                      Default Expense Account{' '}
                      {getSortIcon('defaultExpenseAccount')}
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center">
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
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={3}
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
              disabled={page <= 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={isLastPage}
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
