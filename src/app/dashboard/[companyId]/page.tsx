import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CompanyOverviewPage({ params }: { params: { companyId: string } }) {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Company Overview</h1>
      <Card>
        <CardHeader>
          <CardTitle>Welcome</CardTitle>
        </CardHeader>
        <CardContent>
          <p>This is the main dashboard for company ID: <span className="font-mono bg-muted px-2 py-1 rounded">{params.companyId}</span></p>
          <p className="mt-4 text-muted-foreground">More company-specific widgets and stats will be displayed here.</p>
        </CardContent>
      </Card>
    </div>
  );
}
