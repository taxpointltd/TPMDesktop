import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileUp, Sparkles, FileDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function TransactionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Transaction Matching</h1>
        <p className="text-muted-foreground">
          Upload, match, review, and export your transactions.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Upload Transactions</CardTitle>
          <CardDescription>Upload an Excel file with your transaction data.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button>
            <FileUp className="mr-2 h-4 w-4" />
            Upload File
          </Button>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>2. Review & Match</CardTitle>
            <CardDescription>Review AI-powered matches and make edits as needed.</CardDescription>
          </div>
          <Button variant="outline">
            <Sparkles className="mr-2 h-4 w-4" />
            Run AI Matching
          </Button>
        </CardHeader>
        <CardContent>
            <div className="border rounded-md">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Matched Entity</TableHead>
                        <TableHead>Matched Account</TableHead>
                        <TableHead>Status</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    <TableRow>
                        <TableCell>2024-05-15</TableCell>
                        <TableCell>STARBUCKS COFFEE</TableCell>
                        <TableCell className="text-right">-$5.75</TableCell>
                        <TableCell>Starbucks</TableCell>
                        <TableCell>Meals & Entertainment</TableCell>
                        <TableCell><Badge variant="secondary">Needs Review</Badge></TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell>2024-05-14</TableCell>
                        <TableCell>GOOGLE *ADS</TableCell>
                        <TableCell className="text-right">-$150.00</TableCell>
                        <TableCell>Google LLC</TableCell>
                        <TableCell>Advertising</TableCell>
                        <TableCell><Badge>Matched</Badge></TableCell>
                    </TableRow>
                     <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                            Upload a file to see your transactions.
                        </TableCell>
                    </TableRow>
                </TableBody>
            </Table>
            </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle>3. Export</CardTitle>
            <CardDescription>Export the reviewed transactions to an Excel file.</CardDescription>
        </CardHeader>
        <CardContent>
            <Button>
                <FileDown className="mr-2 h-4 w-4" />
                Export to Excel
            </Button>
        </CardContent>
      </Card>
    </div>
  );
}
