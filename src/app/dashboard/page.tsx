import { Building } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

// Mock data, will be replaced with Firestore data
const userCompanies = [
  { id: 'comp_1', name: 'Innovate Inc.', role: 'Admin' },
  { id: 'comp_2', name: 'Solutions LLC', role: 'Member' },
];

const allCompanies = [
    { id: 'comp_1', name: 'Innovate Inc.'},
    { id: 'comp_2', name: 'Solutions LLC'},
    { id: 'comp_3', name: 'Synergy Corp'},
]

export default function CompanySelectionPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome Back!</h1>
        <p className="text-muted-foreground">Select a company to get started or create a new one.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Companies</CardTitle>
          <CardDescription>Select a company you are already a member of.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {userCompanies.map(company => (
            <Link key={company.id} href={`/dashboard/${company.id}`}>
              <Card className="hover:bg-muted/50 transition-colors h-full flex flex-col">
                <CardHeader className="flex flex-row items-center gap-4">
                  <div className="grid gap-1">
                    <p className="text-lg font-medium">{company.name}</p>
                    <p className="text-sm text-muted-foreground">{company.role}</p>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
           <Card className="border-dashed flex items-center justify-center flex-col gap-2 p-6">
             <h3 className="text-lg font-semibold">New Company</h3>
             <p className="text-sm text-muted-foreground text-center">Set up a new workspace for your team.</p>
             <Button>Create Company</Button>
            </Card>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Join a Company</CardTitle>
          <CardDescription>Find and affiliate with an existing company.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* A search input would go here */}
          <div className="space-y-2">
            {allCompanies.map(company => (
                <div key={company.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                        <Building className="h-5 w-5 text-muted-foreground" />
                        <span className="font-medium">{company.name}</span>
                    </div>
                    <Button variant="outline" size="sm">Request to Join</Button>
                </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
