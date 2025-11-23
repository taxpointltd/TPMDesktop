"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  Briefcase,
  Building,
  FileBarChart2,
  FileText,
  Home,
  Users,
} from "lucide-react";
import { Logo } from "@/components/logo";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const pathname = usePathname();
  const params = useParams();
  const companyId = params.companyId as string | undefined;

  const menuItems = [
    { href: "/dashboard", label: "Companies", icon: Briefcase, requiresCompany: false },
    { href: `/dashboard/${companyId}`, label: 'Overview', icon: Home, requiresCompany: true },
    { href: `/dashboard/${companyId}/data`, label: 'Data Import', icon: FileBarChart2, requiresCompany: true },
    { href: `/dashboard/${companyId}/transactions`, label: 'Transactions', icon: FileText, requiresCompany: true },
    { href: `/dashboard/${companyId}/vendors`, label: 'Vendors', icon: Building, requiresCompany: true },
    { href: `/dashboard/${companyId}/customers`, label: 'Customers', icon: Users, requiresCompany: true },
  ];

  return (
    <Sidebar>
      <SidebarHeader>
        <Logo />
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {menuItems.map((item) =>
            (!item.requiresCompany || companyId) && (
              <SidebarMenuItem key={item.label}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === item.href}
                  tooltip={{ children: item.label }}
                >
                  <Link href={item.href}>
                    <item.icon />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          )}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}
