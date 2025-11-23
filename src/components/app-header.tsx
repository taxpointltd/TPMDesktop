"use client";

import { signOut } from "firebase/auth";
import { Briefcase, Check, ChevronsUpDown, LogOut, User as UserIcon } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useAuth, useCollection, useMemoFirebase, useUser } from "@/firebase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
  } from "@/components/ui/popover"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
  } from "@/components/ui/command"
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { collection } from "firebase/firestore";
import { useFirestore } from "@/firebase";


interface Company {
    id: string;
    name: string;
}

export function AppHeader() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.companyId as string | undefined;

  const auth = useAuth();
  const { user } = useUser();
  const firestore = useFirestore();

  const [open, setOpen] = useState(false)
  
  const companiesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return collection(firestore, `users/${user.uid}/companies`);
  }, [firestore, user]);

  const { data: companies, isLoading: companiesLoading } = useCollection<Company>(companiesQuery);

  const currentCompany = companies?.find(c => c.id === companyId);
  const otherCompanies = companies?.filter(c => c.id !== companyId);


  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  const getInitials = (email?: string | null) => {
    if (!email) return <UserIcon />;
    return email.substring(0, 2).toUpperCase();
  };

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4 lg:h-[60px] lg:px-6">
      <SidebarTrigger className="md:hidden" />
      
      {companyId && (
         <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-[200px] justify-between"
                >
                <Briefcase className="mr-2 h-4 w-4 shrink-0" />
                {currentCompany ? currentCompany.name : "Select company..."}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0">
                <Command>
                    <CommandInput placeholder="Search company..." />
                    <CommandEmpty>No company found.</CommandEmpty>
                    <CommandList>
                        <CommandGroup heading="Current Company">
                            {currentCompany && (
                                <CommandItem
                                    value={currentCompany.name}
                                    onSelect={() => {
                                        router.push(`/dashboard/${currentCompany.id}`);
                                        setOpen(false);
                                    }}
                                >
                                    <Check className={cn("mr-2 h-4 w-4", "opacity-100")} />
                                    {currentCompany.name}
                                </CommandItem>
                            )}
                        </CommandGroup>
                        <CommandGroup heading="Other Companies">
                            {otherCompanies?.map((company) => (
                                <CommandItem
                                    key={company.id}
                                    value={company.name}
                                    onSelect={() => {
                                        router.push(`/dashboard/${company.id}`);
                                        setOpen(false);
                                    }}
                                >
                                    <Check className={cn("mr-2 h-4 w-4", "opacity-0")} />
                                    {company.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                         <CommandSeparator />
                         <CommandGroup>
                            <CommandItem onSelect={() => router.push('/dashboard')}>
                                Create/Join Company
                            </CommandItem>
                         </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
         </Popover>
      )}

      <div className="w-full flex-1">
        {/* Can have a search bar here if needed */}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="icon" className="rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.photoURL ?? undefined} alt="User avatar" />
              <AvatarFallback>{getInitials(user?.email)}</AvatarFallback>
            </Avatar>
            <span className="sr-only">Toggle user menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">My Account</p>
              <p className="text-xs leading-none text-muted-foreground">
                {user?.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={handleLogout} className="cursor-pointer">
            <LogOut className="mr-2 h-4 w-4" />
            <span>Log out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

// Add CommandSeparator to be used in the header
export function CommandSeparator() {
    return <div className="-mx-1 my-1 h-px bg-muted" />;
}
