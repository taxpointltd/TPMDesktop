'use client';

import { useFirestore, useUser } from '@/firebase';
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';
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
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
  } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { FileUp, Sparkles, FileDown, Loader2, MoreHorizontal, Check, ChevronsUpDown, Link as LinkIcon, Trash2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Vendor, Customer, ChartOfAccount, Transaction, RawTransaction } from '@/lib/types';
import { useStore } from '@/lib/store';
import { matchTransactions } from '@/ai/flows/match-transactions-with-ai';
import * as XLSX from 'xlsx';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';


const ITEMS_PER_PAGE = 10;


const formatAccountName = (account: ChartOfAccount): string => {
    let name = '';
    if (account.accountNumber) name += `${account.accountNumber} `;
    name += account.accountName;
    if (account.subAccountName) {
      name += `: ${account.subAccountNumber ? `${account.subAccountNumber} ` : ''}${account.subAccountName}`;
    }
    return name;
};

export default function TransactionsPage() {
    const params = useParams() as { companyId: string };
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    
    // Global state
    const { vendors, customers, chartOfAccounts, setVendors, setCustomers, setChartOfAccounts } = useStore();
    
    // Local state
    const [rawTransactions, setRawTransactions] = useState<RawTransaction[]>([]);
    const [reviewedTransactions, setReviewedTransactions] = useState<Transaction[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isMatching, setIsMatching] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedRows, setSelectedRows] = useState<string[]>([]);
  
    // Fetch base data for matching
    const fetchAllData = useCallback(async () => {
      if (!user || !firestore || !params.companyId) return;
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
        console.error("Failed to fetch data:", error);
        toast({ variant: "destructive", title: "Data Sync Error" });
      }
    }, [user, firestore, params.companyId, setVendors, setCustomers, setChartOfAccounts, toast]);
  
    useEffect(() => {
      fetchAllData();
    }, [fetchAllData]);

    const allEntities = useMemo(() => [
        ...vendors.map(v => ({ id: v.id, name: v.vendorName, type: 'vendor' })),
        ...customers.map(c => ({ id: c.id, name: c.customerName, type: 'customer' })),
      ], [vendors, customers]);

    const paginatedTransactions = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return reviewedTransactions.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [reviewedTransactions, currentPage]);

    const totalPages = Math.ceil(reviewedTransactions.length / ITEMS_PER_PAGE);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || event.target.files.length === 0) return;
        
        setIsUploading(true);
        toast({ title: 'Uploading and parsing file...' });
        
        const file = event.target.files[0];
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json: RawTransaction[] = XLSX.utils.sheet_to_json(worksheet);

                setRawTransactions(json);
                setReviewedTransactions([]); // Clear previous results
                toast({ title: 'Upload Successful', description: `${json.length} transactions loaded.` });
            } catch (error) {
                console.error("File parsing error:", error);
                toast({ variant: 'destructive', title: 'File Error', description: 'Could not parse the uploaded file.' });
            } finally {
                setIsUploading(false);
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleRunMatching = async () => {
        if (rawTransactions.length === 0) {
            toast({ variant: 'destructive', title: 'No Transactions', description: 'Please upload a transaction file first.' });
            return;
        }
        setIsMatching(true);
        toast({ title: 'AI Matching in Progress...', description: 'Please wait while Gemini analyzes your transactions.' });

        try {
            const result = await matchTransactions({
                transactions: JSON.stringify(rawTransactions.map(t => t['Appears On Your Statement As'])),
                vendors: JSON.stringify(vendors.map(v => ({ id: v.id, vendorName: v.vendorName, defaultExpenseAccountId: v.defaultExpenseAccountId }))),
                customers: JSON.stringify(customers.map(c => ({ id: c.id, customerName: c.customerName, defaultRevenueAccountId: c.defaultRevenueAccountId }))),
                chartOfAccounts: JSON.stringify(chartOfAccounts),
            });

            const newReviewedTransactions: Transaction[] = rawTransactions.map((raw, index) => {
                const match = result.matchedTransactions.find(m => m.rawTransactionIndex === index);
                
                const vendor = vendors.find(v => v.id === match?.vendorId);
                const customer = customers.find(c => c.id === match?.customerId);
                const account = chartOfAccounts.find(a => a.id === match?.chartOfAccountId);

                return {
                    id: `temp-${index}`,
                    companyId: params.companyId,
                    date: raw.TransactionDate,
                    amount: raw.Amount,
                    description: raw['Appears On Your Statement As'],
                    status: match ? 'matched' : 'unmatched',
                    vendorId: vendor?.id,
                    customerId: customer?.id,
                    chartOfAccountId: account?.id,
                    matchedEntityName: vendor?.vendorName || customer?.customerName || 'N/A',
                    matchedAccountName: account ? formatAccountName(account) : 'N/A',
                };
            });
            
            setReviewedTransactions(newReviewedTransactions);
            toast({ title: 'AI Matching Complete', description: 'Review the matches below.' });
        } catch (error) {
            console.error("AI Matching error:", error);
            toast({ variant: 'destructive', title: 'AI Error', description: 'The matching process failed.' });
        } finally {
            setIsMatching(false);
        }
    };
    
    const handleUpdateTransaction = (index: number, updates: Partial<Transaction>) => {
        setReviewedTransactions(prev => {
            const newTransactions = [...prev];
            const originalIndex = ((currentPage - 1) * ITEMS_PER_PAGE) + index;
            if (newTransactions[originalIndex]) {
                newTransactions[originalIndex] = { ...newTransactions[originalIndex], ...updates, status: 'edited' };
            }
            return newTransactions;
        });
    };

    const handleSelectAll = (checked: boolean | string) => {
        if (checked) {
          setSelectedRows(paginatedTransactions.map(t => t.id));
        } else {
          setSelectedRows([]);
        }
      };
    
      const handleRowSelect = (transactionId: string, checked: boolean | string) => {
        if (checked) {
          setSelectedRows(prev => [...prev, transactionId]);
        } else {
          setSelectedRows(prev => prev.filter(id => id !== transactionId));
        }
      };
      
    const handleConfirmSelected = async () => {
        if (selectedRows.length === 0 || !firestore || !user) return;
        
        const transactionsToConfirm = reviewedTransactions.filter(t => selectedRows.includes(t.id));
        const batch = writeBatch(firestore);

        transactionsToConfirm.forEach(t => {
            if (t.status !== 'confirmed') {
                const docRef = doc(collection(firestore, `/users/${user.uid}/companies/${params.companyId}/transactions`));
                const { id, status, matchedEntityName, matchedAccountName, ...dataToSave } = t;
                batch.set(docRef, dataToSave);
            }
        });

        try {
            await batch.commit();
            setReviewedTransactions(prev => prev.map(t => selectedRows.includes(t.id) ? { ...t, status: 'confirmed' } : t));
            setSelectedRows([]);
            toast({ title: `${selectedRows.length} transactions confirmed and saved.` });
        } catch (error) {
            console.error("Confirmation error:", error);
            toast({ variant: 'destructive', title: 'Confirmation Failed' });
        }
    };

    const handleExport = () => {
        const confirmedTransactions = reviewedTransactions.filter(t => t.status === 'confirmed');
        if (confirmedTransactions.length === 0) {
            toast({ variant: 'destructive', title: 'No Confirmed Transactions', description: 'Please confirm some transactions before exporting.' });
            return;
        }

        setIsExporting(true);
        const dataToExport = confirmedTransactions.map(t => ({
            'Date': t.date,
            'Description': t.description,
            'Amount': t.amount,
            'Entity': t.matchedEntityName,
            'Account': t.matchedAccountName,
            'Memo': t.memo || '',
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');
        XLSX.writeFile(workbook, 'TransactWise_Export.xlsx');
        setIsExporting(false);
    };

    const getStatusBadge = (status: Transaction['status']) => {
        switch (status) {
            case 'matched': return <Badge variant="secondary">Matched</Badge>;
            case 'edited': return <Badge variant="outline">Edited</Badge>;
            case 'confirmed': return <Badge variant="default">Confirmed</Badge>;
            default: return <Badge variant="destructive">Unmatched</Badge>;
        }
    };

    const EntitySelector = ({ transaction, index }: { transaction: Transaction, index: number }) => {
        const [open, setOpen] = useState(false);
        const currentEntity = allEntities.find(e => e.id === (transaction.vendorId || transaction.customerId));
        
        return (
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-[200px] justify-between">
                        {currentEntity?.name || "Select entity..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0">
                    <Command>
                        <CommandInput placeholder="Search entity..." />
                        <CommandList>
                        <CommandEmpty>No entity found.</CommandEmpty>
                        <CommandGroup>
                            {allEntities.map((entity) => (
                                <CommandItem key={entity.id} value={entity.name} onSelect={() => {
                                    const account = chartOfAccounts.find(a => a.id === (entity.type === 'vendor' ? vendors.find(v => v.id === entity.id)?.defaultExpenseAccountId : customers.find(c => c.id === entity.id)?.defaultRevenueAccountId));
                                    handleUpdateTransaction(index, { 
                                        vendorId: entity.type === 'vendor' ? entity.id : undefined,
                                        customerId: entity.type === 'customer' ? entity.id : undefined,
                                        matchedEntityName: entity.name,
                                        chartOfAccountId: account?.id,
                                        matchedAccountName: account ? formatAccountName(account) : 'N/A',
                                    });
                                    setOpen(false);
                                }}>
                                    <Check className={cn("mr-2 h-4 w-4", currentEntity?.id === entity.id ? "opacity-100" : "opacity-0")} />
                                    {entity.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        );
    };

    const AccountSelector = ({ transaction, index }: { transaction: Transaction, index: number }) => {
        const [open, setOpen] = useState(false);
        const currentAccount = chartOfAccounts.find(a => a.id === transaction.chartOfAccountId);

        return (
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-[250px] justify-between truncate">
                        {currentAccount ? formatAccountName(currentAccount) : "Select account..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[350px] p-0">
                    <Command>
                        <CommandInput placeholder="Search account..." />
                        <CommandList>
                        <CommandEmpty>No account found.</CommandEmpty>
                        <CommandGroup>
                            {chartOfAccounts.map((account) => (
                                <CommandItem key={account.id} value={formatAccountName(account)} onSelect={() => {
                                    handleUpdateTransaction(index, {
                                        chartOfAccountId: account.id,
                                        matchedAccountName: formatAccountName(account)
                                    });
                                    setOpen(false);
                                }}>
                                    <Check className={cn("mr-2 h-4 w-4", currentAccount?.id === account.id ? "opacity-100" : "opacity-0")} />
                                    {formatAccountName(account)}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        );
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Transaction Matching</h1>
                <p className="text-muted-foreground">Upload, match, review, and export your transactions.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>1. Upload Transactions</CardTitle>
                    <CardDescription>Upload a CSV or Excel file. <a href="/samples/transactions.csv" download className="text-primary hover:underline">Download sample file.</a></CardDescription>
                </CardHeader>
                <CardContent>
                    <Input type="file" onChange={handleFileUpload} disabled={isUploading || isMatching} accept=".csv, .xlsx" className="max-w-xs" />
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex-row items-center justify-between">
                    <div>
                        <CardTitle>2. Review & Match</CardTitle>
                        <CardDescription>Review AI-powered matches and make edits as needed.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                         {selectedRows.length > 0 && (
                           <Button onClick={handleConfirmSelected} variant="default">
                                <Check className="mr-2 h-4 w-4" />
                                Confirm ({selectedRows.length})
                           </Button>
                        )}
                        <Button onClick={handleRunMatching} disabled={isMatching || rawTransactions.length === 0} variant="outline">
                            {isMatching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                            Run AI Matching
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="px-4 w-[50px]">
                                        <Checkbox
                                            checked={selectedRows.length > 0 && selectedRows.length === paginatedTransactions.length && paginatedTransactions.length > 0}
                                            onCheckedChange={handleSelectAll}
                                            aria-label="Select all"
                                        />
                                    </TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead>Matched Entity</TableHead>
                                    <TableHead>Matched Account</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isMatching ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center">
                                            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                                            <p className="mt-2">AI is matching transactions...</p>
                                        </TableCell>
                                    </TableRow>
                                ) : paginatedTransactions.length > 0 ? (
                                    paginatedTransactions.map((transaction, index) => (
                                        <TableRow key={transaction.id}>
                                            <TableCell className="px-4">
                                                <Checkbox
                                                    checked={selectedRows.includes(transaction.id)}
                                                    onCheckedChange={(checked) => handleRowSelect(transaction.id, checked)}
                                                    aria-label="Select row"
                                                    disabled={transaction.status === 'confirmed'}
                                                />
                                            </TableCell>
                                            <TableCell>{transaction.date}</TableCell>
                                            <TableCell className="max-w-xs truncate">{transaction.description}</TableCell>
                                            <TableCell className="text-right">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(transaction.amount)}</TableCell>
                                            <TableCell>
                                                <EntitySelector transaction={transaction} index={index} />
                                            </TableCell>
                                            <TableCell>
                                                <AccountSelector transaction={transaction} index={index} />
                                            </TableCell>
                                            <TableCell>{getStatusBadge(transaction.status)}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center text-muted-foreground h-24">
                                            {rawTransactions.length > 0 ? 'Click "Run AI Matching" to start.' : 'Upload a file to see your transactions.'}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    {totalPages > 1 && (
                         <div className="flex items-center justify-end space-x-2 py-4">
                            <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            >
                            Previous
                            </Button>
                            <span className="text-sm text-muted-foreground">
                            Page {currentPage} of {totalPages}
                            </span>
                            <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            >
                            Next
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>3. Finish & Export</CardTitle>
                    <CardDescription>Export the confirmed transactions to an Excel file.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={handleExport} disabled={isExporting || reviewedTransactions.filter(t => t.status === 'confirmed').length === 0}>
                        {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                        Export to Excel
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
