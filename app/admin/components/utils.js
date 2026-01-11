"use client";
import { ShieldUser, LayoutDashboard, Users, FileCheck, CreditCard, ListOrdered, BadgeCheck, Ticket, Package, Tags, LineChart, TriangleAlert, Settings } from "lucide-react";
import { useSession } from "next-auth/react";

export const useNavigationData = () => {
  const { data: session } = useSession();
  const admin = session?.user?.role === "admin";
  const senior = session?.user?.role === "senior_admin";
  const isAdmin = admin || senior;

  const base = [
    {
      id: 1,
      label: "",
      items: [
        {
          name: "Home",
          href: "/admin",
          icon: LayoutDashboard,
          other_items: [],
        },
      ],
    },
  ];

  if (isAdmin) {
    base[0].items.push(
      {
        name: "Analytics",
        href: "/admin/analytics",
        icon: LineChart,
        other_items: [],
      },
      {
        name: "Products",
        href: "/admin/products",
        icon: Package,
        other_items: [],
      },
      {
        name: "Roles",
        href: "/admin/roles",
        icon: ShieldUser,
        other_items: [],
      },
      {
        name: "Merchants",
        href: "/admin/merchants",
        icon: Users,
        other_items: [],
      },
      {
        name: "KYC",
        href: "/admin/kyc",
        icon: FileCheck,
        other_items: [],
      },
      {
        name: "Payouts",
        href: "/admin/payouts",
        icon: CreditCard,
        other_items: [],
      },
      {
        name: "Transactions",
        href: "/admin/transactions",
        icon: ListOrdered,
        other_items: [],
      },
      {
        name: "Payment Provider",
        href: "/admin/payment-provider",
        icon: Settings,
        other_items: [],
      },
      {
        name: "Licenses",
        href: "/admin/licenses",
        icon: BadgeCheck,
        other_items: [],
      },
      {
        name: "Tickets",
        href: "/admin/tickets",
        icon: Ticket,
        other_items: [],
      },
      {
        name: "Errors",
        href: "/admin/errors",
        icon: TriangleAlert,
        other_items: [],
      },
      {
        name: "Coupons",
        href: "/admin/coupons",
        icon: Tags,
        other_items: [],
      }
    );
  }

  return base;
};
