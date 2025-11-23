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

interface ChartOfAccount {
  id: string;
  accountName: string;
  accountNumber?: string;
  accountType?: string;
  accountDescription?: string;
}

const PAGE_SIZE = 10;

export default function ChartOfAccountsPage() {
  const params = useParams() as { companyId: string };
  const { user } = useUser();
  const firestore = useFirestore();

  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastVisible, setLastVisible] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [firstVisible, setFirstVisible] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [isLastPage, setIsLastPage] = useState(false);
  const [page, setPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof ChartOfAccount;
    direction: 'asc' | 'desc';
  }>({ key: 'accountName', direction: 'asc' });

  const coaCollectionRef = useMemoFirebase(() => {
    if (!user || !firestore) {
      return null;
    }
    const path = `/users/${user.uid}/companies/${params.companyId}/chartOfAccounts`;
    return collection(
      firestore,
      path
    );
  }, [firestore, user, params.companyId]);

  const fetchAccounts = useCallback(
    async (direction: 'next' | 'prev' | 'first' = 'first') => {
      if (!coaCollectionRef) {
        return;
      }
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

        const newAccounts = documentSnapshots.docs.map((doc) => {
          return {
            id: doc.id,
            ...doc.data(),
          } as ChartOfAccount;
        });

        if (!documentSnapshots.empty) {
          setLastVisible(
            documentSnapshots.docs[documentSnapshots.docs.length - 1]
          );
          setFirstVisible(documentSnapshots.docs[0]);
          setAccounts(newAccounts);
          setIsLastPage(documentSnapshots.docs.length < PAGE_SIZE);
        } else if (direction === 'first') {
          setAccounts([]);
          setLastVisible(null);
          setFirstVisible(null);
          setIsLastPage(true);
        } else {
          if (direction === 'next') {
            setIsLastPage(true);
          }
        }
      } catch (error) {
        console.error('ChartOfAccountsPage: Error fetching accounts:', error);
        setAccounts([]);
      } finally {
        setIsLoading(false);
      }
    },
    [coaCollectionRef, lastVisible, firstVisible, sortConfig]
  );

  useEffect(() => {
    if (coaCollectionRef) {
        fetchAccounts('first');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortConfig, coaCollectionRef]);

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

  const handleSort = (key: keyof ChartOfAccount) => {
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

  const getSortIcon = (key: keyof ChartOfAccount) => {
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
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Account
        </Button>
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
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => handleSort('accountName')}
                  >
                    <div className="flex items-center">
                      Account Name {getSortIcon('accountName')}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => handleSort('accountNumber')}
                  >
                    <div className="flex items-center">
                      Account Number {getSortIcon('accountNumber')}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => handleSort('accountType')}
                  >
                    <div className="flex items-center">
                      Account Type {getSortIcon('accountType')}
                    </div>
                  </TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                    </TableCell>
                  </TableRow>
                ) : accounts && accounts.length > 0 ? (
                  accounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-medium">
                        {account.accountName}
                      </TableCell>
                      <TableCell>{account.accountNumber || 'N/A'}</TableCell>                      
                      <TableCell>{account.accountType || 'N/A'}</TableCell>
                      <TableCell>
                        {account.accountDescription || 'N/A'}
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
                      colSpan={5}
                      className="text-center text-muted-foreground"
                    >
                      No accounts found. Import them from the Data Import page.
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
