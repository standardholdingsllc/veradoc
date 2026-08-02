"use client";

import { useState } from "react";
import { Tabs } from "@/components/ui/tabs";
import { OverviewMetrics } from "./overview-metrics";
import { RealtorQueue } from "./realtor-queue";
import { NotaryInvitations } from "./notary-invitations";
import { NotaryCoverage } from "./notary-coverage";
import { UserManagement } from "./user-management";

const TABS = [
  { id: "overview", label: "Resumen" },
  { id: "realtors", label: "Agentes" },
  { id: "invitations", label: "Invitaciones" },
  { id: "coverage", label: "Cobertura" },
  { id: "users", label: "Usuarios" },
] as const;

interface AdminTabsProps {
  pendingRealtors: {
    id: string;
    full_name: string;
    email: string;
    dni: string | null;
    province: string | null;
    department: string | null;
    company_name: string | null;
    ruc: string | null;
    license_number: string | null;
    phone: string | null;
    created_at: string | null;
  }[];
  invitations: {
    id: string;
    email: string;
    role: string;
    status: string;
    expires_at: string;
    accepted_at: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
    invited_by: string;
  }[];
  coverage: {
    id: string;
    province: string;
    department: string | null;
    active: boolean;
    created_at: string | null;
    notary_id: string;
    profiles: { full_name: string; email: string } | null;
  }[];
  notaries: {
    id: string;
    full_name: string;
    email: string;
  }[];
  metrics: {
    activeRealtors: number;
    activeNotaries: number;
    activeSigners: number;
    packetsByStatus: Record<string, number>;
    totalPackets: number;
    recentCertifications: number;
    paymentTotals: Record<string, number>;
  };
  users: {
    id: string;
    full_name: string;
    email: string;
    role: string;
    status: string;
    province: string | null;
    phone: string | null;
    dni: string | null;
    created_at: string | null;
  }[];
  usersPageInfo: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
  };
  initialTab?: string;
}

export function AdminTabs({
  pendingRealtors,
  invitations,
  coverage,
  notaries,
  metrics,
  users,
  usersPageInfo,
  initialTab,
}: AdminTabsProps) {
  const [activeTab, setActiveTab] = useState(
    TABS.some((tab) => tab.id === initialTab) ? initialTab! : "overview",
  );

  return (
    <Tabs tabs={[...TABS]} activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === "overview" && <OverviewMetrics metrics={metrics} />}
      {activeTab === "realtors" && (
        <RealtorQueue pendingRealtors={pendingRealtors} />
      )}
      {activeTab === "invitations" && (
        <NotaryInvitations invitations={invitations} />
      )}
      {activeTab === "coverage" && (
        <NotaryCoverage coverage={coverage} notaries={notaries} />
      )}
      {activeTab === "users" && (
        <UserManagement users={users} pageInfo={usersPageInfo} />
      )}
    </Tabs>
  );
}
