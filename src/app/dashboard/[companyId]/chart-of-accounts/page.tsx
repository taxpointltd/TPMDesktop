'use client';

import { useMemo } from 'react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Loader2 } from 'lucide-react';
import { useMemoFirebase } from '@/firebase/provider';

interface ChartOfAccount {
  id: string;
  accountName: string;
  accountNumber?: string;
  accountType?: string;
  accountDescription?: string;
}

export default function ChartOfAccountsPage({ params }: { params: { companyId: string } }) {
  const { user } = useUser();
  const firestore = useFirestore();

  const coaQuery = useMemoFirebase(() => {
    if (!user) return null;
    return collection(firestore, `/users/${user.uid}/companies/${params.companyId}/chartOfAccounts`);
  }, [firestore, user, params.companyId]);

  const { data: accounts, isLoading } = useCollection<ChartOfAccount>(coaQuery);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Chart of Accounts</h1>
          <p className="text-muted-foreground">
            Manage your chart of accounts for company <span className="font-mono bg-muted px-2 py-1 rounded">{params.companyId}</span>.
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
          <CardDescription>A list of all accounts associated with your company.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account Name</TableHead>
                  <TableHead>Account Number</TableHead>
                  <TableHead>Account Type</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center">
                      <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                    </TableCell>
                  </TableRow>
                ) : accounts && accounts.length > 0 ? (
                  accounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-medium">{account.accountName}</TableCell>
                      <TableCell>{account.accountNumber || 'N/A'}</TableCell>
                      <TableCell>{account.accountType || 'N/A'}</TableCell>
                      <TableCell>{account.accountDescription || 'N/A'}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No accounts found. Import them from the Data Import page.
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
