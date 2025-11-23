'use client';

import { Building, Loader2, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import Link from 'next/link';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection } from 'firebase/firestore';
import { useMemoFirebase } from '@/firebase/provider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

interface Company {
  id: string;
  name: string;
}

function CreateCompanyDialog({
  userId,
  onCompanyCreated,
}: {
  userId: string;
  onCompanyCreated: (companyId: string) => void;
}) {
  const [companyName, setCompanyName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();

  const handleCreateCompany = async () => {
    if (!companyName.trim()) {
      toast({
        variant: 'destructive',
        title: 'Company name is required',
      });
      return;
    }
    setIsCreating(true);
    try {
      const companiesRef = collection(
        firestore,
        `users/${userId}/companies`
      );
      const docRef = await addDoc(companiesRef, {
        name: companyName,
        userId: userId,
      });
      toast({
        title: 'Company created',
        description: `"${companyName}" has been created successfully.`,
      });
      onCompanyCreated(docRef.id);
    } catch (error) {
      console.error('Error creating company:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to create company',
        description:
          'An error occurred while creating the company. Please try again.',
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog onOpenChange={(open) => !open && setCompanyName('')}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2" />
          Create Company
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create a New Company</DialogTitle>
          <DialogDescription>
            Set up a new workspace to manage transactions.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Company Name
            </Label>
            <Input
              id="name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="col-span-3"
              placeholder="e.g., Innovate Inc."
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="submit"
            onClick={handleCreateCompany}
            disabled={isCreating}
          >
            {isCreating && <Loader2 className="mr-2 animate-spin" />}
            Create Company
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function CompanySelectionPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const companiesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return collection(firestore, `users/${user.uid}/companies`);
  }, [firestore, user]);

  const { data: companies, isLoading: companiesLoading } =
    useCollection<Company>(companiesQuery);

  const handleCompanyCreated = (companyId: string) => {
    router.push(`/dashboard/${companyId}`);
  };

  if (companiesLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome Back!</h1>
        <p className="text-muted-foreground">
          Select a company to get started or create a new one.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Companies</CardTitle>
          <CardDescription>
            Select a company you have access to.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {companies && companies.length > 0 ? (
            companies.map((company) => (
              <Link key={company.id} href={`/dashboard/${company.id}`}>
                <Card className="hover:bg-muted/50 transition-colors h-full flex flex-col justify-center">
                  <CardHeader className="flex flex-row items-center gap-4">
                    <Building className="h-8 w-8 text-primary" />
                    <div className="grid gap-1">
                      <p className="text-lg font-medium">{company.name}</p>
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            ))
          ) : (
            <p className="text-muted-foreground col-span-full">
              You are not part of any companies yet.
            </p>
          )}

          <Card className="border-dashed flex items-center justify-center flex-col gap-2 p-6">
            <h3 className="text-lg font-semibold">New Company</h3>
            <p className="text-sm text-muted-foreground text-center">
              Set up a new workspace for your team.
            </p>
            {user && (
              <CreateCompanyDialog
                userId={user.uid}
                onCompanyCreated={handleCompanyCreated}
              />
            )}
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}
