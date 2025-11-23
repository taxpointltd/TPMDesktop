'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useUser, useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, doc, writeBatch } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { FileUp, Building, Users, List, Download, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Vendor, Customer, ChartOfAccount } from '@/lib/types';

interface ImportCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  sampleUrl: string;
  onImport: (file: File) => Promise<void>;
  companyId: string;
}

const ImportCard = ({ title, description, icon: Icon, sampleUrl, onImport }: ImportCardProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setIsImporting(true);
    setProgress(0);
    // Simulate progress for user feedback
    const interval = setInterval(() => {
      setProgress(prev => (prev < 90 ? prev + 10 : prev));
    }, 200);
    try {
      await onImport(file);
      setProgress(100);
    } finally {
      clearInterval(interval);
      setIsImporting(false);
      setFile(null);
      setTimeout(() => setProgress(0), 3000);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-4">
          <Icon className="h-8 w-8 text-muted-foreground" />
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex items-center gap-2">
          <Input type="file" className="cursor-pointer" onChange={handleFileChange} accept=".csv, .xlsx" disabled={isImporting} />
          <Button onClick={handleImport} disabled={!file || isImporting}>
            {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
            Import
          </Button>
        </div>
        {(isImporting || progress > 0) && <Progress value={progress} className="w-full" />}
        <Link href={sampleUrl} download className="text-sm text-center text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-2">
          <Download className="h-4 w-4" />
          Download sample file
        </Link>
      </CardContent>
    </Card>
  );
};

const mapAndValidateRow = (row: any, companyId: string, type: 'vendors' | 'customers' | 'chartOfAccounts'): Partial<Vendor | Customer | ChartOfAccount> | null => {
    const sanitized: { [key: string]: any } = {};
    for (const key in row) {
      if (Object.prototype.hasOwnProperty.call(row, key)) {
        const trimmedKey = key.trim();
        const value = row[key];
        sanitized[trimmedKey] = typeof value === 'string' ? value.trim() : value;
      }
    }
  
    let mappedData: any = { companyId };
  
    switch (type) {
      case 'vendors':
        if (!sanitized['Vendor Name']) return null; // Required field
        mappedData.vendorName = sanitized['Vendor Name'];
        mappedData.vendorEmail = sanitized['Contact Email'];
        mappedData.defaultExpenseAccount = sanitized['Default Expense Account'];
        return mappedData as Partial<Vendor>;
      case 'customers':
        if (!sanitized['Customer Name']) return null; // Required field
        mappedData.customerName = sanitized['Customer Name'];
        mappedData.customerEmail = sanitized['Contact Email'];
        mappedData.defaultRevenueAccount = sanitized['Default Revenue Account'];
        return mappedData as Partial<Customer>;
      case 'chartOfAccounts':
        if (!sanitized['Account Name']) return null; // Required field
        mappedData.accountName = sanitized['Account Name'];
        mappedData.accountNumber = sanitized['Account Number'];
        mappedData.accountType = sanitized['Account Type'];
        mappedData.description = sanitized['Description'];
        mappedData.subAccountName = sanitized['Sub Account Name'];
        mappedData.subAccountNumber = sanitized['Sub Account Number'];
        return mappedData as Partial<ChartOfAccount>;
      default:
        return null;
    }
  };
  
export default function DataImportPage() {
  const { companyId } = useParams() as { companyId: string };
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const handleDataImport = async (file: File, type: 'vendors' | 'customers' | 'chartOfAccounts') => {
    if (!user || !firestore || !companyId) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'User not authenticated or company not found.'
        });
        return;
    }

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json: any[] = XLSX.utils.sheet_to_json(worksheet);

      if (json.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Import Failed',
          description: 'The file is empty or in an incorrect format.',
        });
        return;
      }
      
      const validatedData = json.map(row => mapAndValidateRow(row, companyId, type)).filter(Boolean);

      if (validatedData.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Import Failed',
          description: 'No valid records found in the file. Please check the column headers and required fields.',
        });
        return;
      }

      const collectionPath = `/users/${user.uid}/companies/${companyId}/${type}`;
      const collectionRef = collection(firestore, collectionPath);
      
      const BATCH_SIZE = 499; // Firestore batch limit is 500
      for (let i = 0; i < validatedData.length; i += BATCH_SIZE) {
        const batch = writeBatch(firestore);
        const chunk = validatedData.slice(i, i + BATCH_SIZE);
        chunk.forEach((dataItem) => {
          if(dataItem) {
            const docRef = doc(collectionRef);
            batch.set(docRef, dataItem);
          }
        });
        await batch.commit();
      }

      toast({
        title: 'Import Successful',
        description: `${validatedData.length} of ${json.length} records have been imported.`,
      });
    } catch (error) {
      console.error('Error importing data:', error);
      toast({
        variant: 'destructive',
        title: 'Import Failed',
        description: 'An error occurred during import. Please check the file format and console for details.',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Data Import</h1>
        <p className="text-muted-foreground">
          Import your vendors, customers, and chart of accounts from Excel or CSV files.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <ImportCard
          title="Import Vendors"
          description="Upload your list of vendors."
          icon={Building}
          sampleUrl="/samples/vendors.csv"
          onImport={(file) => handleDataImport(file, 'vendors')}
          companyId={companyId}
        />
        <ImportCard
          title="Import Customers"
          description="Upload your list of customers."
          icon={Users}
          sampleUrl="/samples/customers.csv"
          onImport={(file) => handleDataImport(file, 'customers')}
          companyId={companyId}
        />
        <ImportCard
          title="Import Chart of Accounts"
          description="Upload your chart of accounts."
          icon={List}
          sampleUrl="/samples/chart-of-accounts.csv"
          onImport={(file) => handleDataImport(file, 'chartOfAccounts')}
          companyId={companyId}
        />
      </div>
    </div>
  );
}
