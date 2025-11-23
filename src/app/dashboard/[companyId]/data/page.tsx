import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FileUp, Building, Users, List, Download } from "lucide-react";
import Link from "next/link";

const ImportCard = ({ title, description, icon: Icon, sampleUrl }: { title: string, description: string, icon: React.ElementType, sampleUrl: string }) => (
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
                <Input type="file" className="cursor-pointer" />
                <Button>
                    <FileUp className="mr-2 h-4 w-4" /> Import
                </Button>
            </div>
            <Link href={sampleUrl} download className="text-sm text-center text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-2">
                <Download className="h-4 w-4"/>
                Download sample file
            </Link>
        </CardContent>
    </Card>
)

export default function DataImportPage() {
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
        />
        <ImportCard 
            title="Import Customers"
            description="Upload your list of customers."
            icon={Users}
            sampleUrl="/samples/customers.csv"
        />
        <ImportCard 
            title="Import Chart of Accounts"
            description="Upload your chart of accounts."
            icon={List}
            sampleUrl="/samples/chart-of-accounts.csv"
        />
      </div>
    </div>
  );
}
