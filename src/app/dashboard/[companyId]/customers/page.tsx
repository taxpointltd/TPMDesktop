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
import { PlusCircle, Loader2, ArrowUpDown, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { useMemoFirebase } from '@/firebase/provider';
import { useParams } from 'next/navigation';
import React, { useState, useEffect, useCallback } from 'react';

interface Customer {
  id: string;
  name: string;
  contactEmail?: string;
  defaultRevenueAccount?: string;
}

const PAGE_SIZE = 10;

export default function CustomersPage() {
  const params = useParams() as { companyId: string };
  const { user } = useUser();
  const firestore = useFirestore();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastVisible, setLastVisible] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [firstVisible, setFirstVisible] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [isLastPage, setIsLastPage] = useState(false);
  const [page, setPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Customer;
    direction: 'asc' | 'desc';
  }>({ key: 'name', direction: 'asc' });

  const customersCollectionRef = useMemoFirebase(() => {
    if (!user || !firestore) {
      console.log('CustomersPage: User or Firestore not available.');
      return null;
    }
    const path = `/users/${user.uid}/companies/${params.companyId}/customers`;
    console.log('CustomersPage: Creating collection reference for path:', path);
    return collection(firestore, path);
  }, [firestore, user, params.companyId]);

  const fetchCustomers = useCallback(
    async (direction: 'next' | 'prev' | 'first' = 'first') => {
      if (!customersCollectionRef) {
        console.log('CustomersPage: fetchCustomers called but collection ref is not ready.');
        return;
      }
      console.log(`CustomersPage: Starting fetchCustomers with direction: ${direction}`);
      setIsLoading(true);

      let q;
      const { key, direction: sortDirection } = sortConfig;

      if (direction === 'next' && lastVisible) {
        console.log('CustomersPage: Fetching NEXT page.');
        q = query(
          customersCollectionRef,
          orderBy(key, sortDirection),
          startAfter(lastVisible),
          limit(PAGE_SIZE)
        );
      } else if (direction === 'prev' && firstVisible) {
        console.log('CustomersPage: Fetching PREVIOUS page.');
        q = query(
          customersCollectionRef,
          orderBy(key, sortDirection),
          endBefore(firstVisible),
          limitToLast(PAGE_SIZE)
        );
      } else {
        console.log('CustomersPage: Fetching FIRST page.');
        q = query(
          customersCollectionRef,
          orderBy(key, sortDirection),
          limit(PAGE_SIZE)
        );
        setPage(1);
      }

      try {
        console.log('CustomersPage: Executing getDocs query.');
        const documentSnapshots = await getDocs(q);
        console.log(`CustomersPage: getDocs returned ${documentSnapshots.docs.length} documents.`);
        
        const newCustomers = documentSnapshots.docs.map((doc) => {
          const data = {
            id: doc.id,
            ...doc.data(),
          } as Customer;
          console.log('CustomersPage: Mapping doc:', data);
          return data;
        });

        if (!documentSnapshots.empty) {
          setLastVisible(documentSnapshots.docs[documentSnapshots.docs.length - 1]);
          setFirstVisible(documentSnapshots.docs[0]);
          setCustomers(newCustomers);
          setIsLastPage(documentSnapshots.docs.length < PAGE_SIZE);
          console.log('CustomersPage: State updated with new customers. Count:', newCustomers.length);
        } else if (direction === 'first') {
          console.log('CustomersPage: No customers found on first fetch.');
          setCustomers([]);
          setLastVisible(null);
          setFirstVisible(null);
          setIsLastPage(true);
        } else {
          console.log('CustomersPage: Empty snapshot on pagination.');
          if (direction === 'next') {
            setIsLastPage(true);
          }
        }
      } catch (error) {
        console.error('CustomersPage: Error fetching customers:', error);
        setCustomers([]);
      } finally {
        setIsLoading(false);
        console.log('CustomersPage: fetchCustomers finished.');
      }
    },
    [customersCollectionRef, lastVisible, firstVisible, sortConfig]
  );

  useEffect(() => {
    console.log('CustomersPage: useEffect triggered. Ref available:', !!customersCollectionRef);
    if (customersCollectionRef) {
      fetchCustomers('first');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortConfig, customersCollectionRef]);

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

  const handleSort = (key: keyof Customer) => {
    setSortConfig((prev) => {
      const newDirection =
        prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc';
      return { key, direction: newDirection };
    });
    setLastVisible(null);
    setFirstVisible(null);
    setPage(1);
    setIsLastPage(false);
  };

  const getSortIcon = (key: keyof Customer) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />;
    }
    return sortConfig.direction === 'asc' ? (
      <ArrowUpDown className="ml-2 h-4 w-4" />
    ) : (
      <ArrowUpDown className="ml-2 h-4 w-4" />
    );
  };
  
  console.log('CustomersPage: Rendering component. Current customers state count:', customers.length, 'isLoading:', isLoading);
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground">
            Manage customers for company{' '}
            <span className="font-mono bg-muted px-2 py-1 rounded">
              {params.companyId}
            </span>
            .
          </p>
        </div>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Customer
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer List</CardTitle>
          <CardDescription>
            A list of all customers associated with your company.
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
                    onClick={() => handleSort('defaultRevenueAccount')}
                  >
                    <div className="flex items-center">
                      Default Revenue Account{' '}
                      {getSortIcon('defaultRevenueAccount')}
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
                ) : customers && customers.length > 0 ? (
                  customers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">
                        {customer.name}
                      </TableCell>
                      <TableCell>{customer.contactEmail || 'N/A'}</TableCell>
                      <TableCell>
                        {customer.defaultRevenueAccount || 'N/A'}
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
                      No customers found. Import them from the Data Import
                      page.
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
