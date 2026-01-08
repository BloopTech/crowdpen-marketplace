"use client";

import React, { useEffect, useMemo, useState, useActionState, useCallback } from "react";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "../../components/ui/avatar";
import { Badge } from "../../components/ui/badge";
import { Separator } from "../../components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Alert, AlertTitle, AlertDescription } from "../../components/ui/alert";
import {
  User,
  Download,
  Heart,
  CreditCard,
  Settings,
  Calendar,
  DollarSign,
  Loader2,
  ShieldCheck,
  Upload,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Pencil,
} from "lucide-react";
import MarketplaceHeader from "../../components/marketplace-header";
import Link from "next/link";
import NextImage from "next/image";
import { useAccount } from "./context";
import { toast } from "sonner";
import { upsertKyc } from "./action";
import BankDetailsCard from "./bank-card";
import MyPurchases from "./tabs/purchases";
import MyProducts from "./tabs/products";
import MyBillings from "./tabs/billing";
import MyVerification from "./tabs/verification";
import AccountSettings from "./tabs/settings";
import PayoutsTab from "./tabs/payouts";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const initialStateValues = {
  message: "",
  errors: {
    firstName: [],
    lastName: [],
    email: [],
    bio: [],
    image: [],
    name: [],
  },
};

export default function AccountContentPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParamRaw = (searchParams?.get("tab") || "purchases").slice(0, 50);
  const tabParam =
    tabParamRaw === "purchases" ||
    tabParamRaw === "my-products" ||
    tabParamRaw === "payouts" ||
    tabParamRaw === "billing" ||
    tabParamRaw === "settings" ||
    tabParamRaw === "verification"
      ? tabParamRaw
      : "purchases";
  const [activeTab, setActiveTab] = useState(tabParam);
  const {
    profile,
    purchases = [],
    kyc,
    refetchAccountQuery,
    accountQueryLoading,
    accountQueryError,
    // My Products from context (tanstack query)
    myProducts,
    myProductsTotal,
    myProductsHasMore,
    myProductsLoading,
    myProductsLoadingMore,
    myProductsError,
    loadMoreMyProducts,
    // Filters/sort
    myProductsSearch,
    setMyProductsSearch,
    myProductsSelectedCategory,
    setMyProductsSelectedCategory,
    myProductsSortBy,
    setMyProductsSortBy,
    categories,
  } = useAccount();

  const [kycStep, setKycStep] = useState(0);
  const [isSavingKycDraft, setIsSavingKycDraft] = useState(false);

  // Server Action wiring
  const [kycState, kycFormAction, kycIsPending] = useActionState(
    upsertKyc,
    initialStateValues
  );
  useEffect(() => {
    if (Object.keys(kycState?.data || {}).length > 0 && kycState.message) {
      toast.success(kycState.message);
      setKycStep(0);
      refetchAccountQuery();
    } else if (
      Object.keys(kycState?.errors || {}).length > 0 &&
      kycState.message
    ) {
      toast.error(kycState.message);
    }
  }, [kycState, refetchAccountQuery]);

  useEffect(() => {
    if (tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [tabParam, activeTab]);

  const handleTabChange = useCallback(
    (next) => {
      const v = String(next || "purchases");
      setActiveTab(v);
      const params = new URLSearchParams(searchParams?.toString() || "");
      if (v && v !== "purchases") params.set("tab", v);
      else params.delete("tab");
      const nextUrl = params.toString()
        ? `${pathname}?${params.toString()}`
        : pathname;
      router.replace(nextUrl);
    },
    [router, pathname, searchParams]
  );

  // Local editable draft for the Profile tab
  const [draftProfile, setDraftProfile] = useState(null);
  useEffect(() => {
    if (profile) {
      setDraftProfile({
        firstName: profile.firstName || "",
        lastName: profile.lastName || "",
        email: profile.email || "",
        bio: profile.bio || "",
        image: profile.image || null,
        name: profile.name || "",
      });
    }
  }, [profile]);

  // KYC State
  // const [kycStep, setKycStep] = useState(0); // Moved up
  const MAX_BYTES = 2 * 1024 * 1024; // 2MB
  const formatMB = (bytes) =>
    bytes ? (bytes / (1024 * 1024)).toFixed(2) : "0.00";
  const [kycForm, setKycForm] = useState({
    first_name: "",
    last_name: "",
    middle_name: "",
    phone_number: "",
    dob: "",
    nationality: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    postal_code: "",
    country: "",
    id_type: "passport",
    id_number: "",
    id_country: "",
    id_expiry: "",
  });
  const [idFront, setIdFront] = useState({
    file: null,
    preview: null,
    uploadedUrl: null,
    uploading: false,
    size: 0,
  });
  const [idBack, setIdBack] = useState({
    file: null,
    preview: null,
    uploadedUrl: null,
    uploading: false,
    size: 0,
  });
  const [selfie, setSelfie] = useState({
    file: null,
    preview: null,
    uploadedUrl: null,
    uploading: false,
    size: 0,
  });

  const hasKycInputData = useMemo(() => {
    const fieldsToCheck = [
      "first_name",
      "last_name",
      "middle_name",
      "phone_number",
      "dob",
      "nationality",
      "address_line1",
      "address_line2",
      "city",
      "state",
      "postal_code",
      "country",
      "id_number",
      "id_country",
      "id_expiry",
    ];
    const hasTypedValues = fieldsToCheck.some((field) => {
      const value = kycForm[field];
      return typeof value === "string" ? value.trim() !== "" : Boolean(value);
    });
    const docTypeChanged =
      typeof kycForm.id_type === "string" &&
      kycForm.id_type.trim() !== "" &&
      kycForm.id_type !== (kyc?.id_type || "passport");
    const hasFiles =
      Boolean(idFront.file || idFront.uploadedUrl) ||
      Boolean(idBack.file || idBack.uploadedUrl) ||
      Boolean(selfie.file || selfie.uploadedUrl);
    return hasTypedValues || docTypeChanged || hasFiles;
  }, [kycForm, kyc?.id_type, idFront.file, idFront.uploadedUrl, idBack.file, idBack.uploadedUrl, selfie.file, selfie.uploadedUrl]);

  const saveKycDraft = useCallback(async () => {
    if (!hasKycInputData || isSavingKycDraft) {
      return true;
    }
    setIsSavingKycDraft(true);
    const sanitize = (value) => {
      if (value == null) return null;
      const str = typeof value === "string" ? value.trim() : String(value);
      return str === "" ? null : str;
    };
    const level = (kyc?.level || "standard").toLowerCase();
    const payload = {
      status: "pending",
      level,
      first_name: sanitize(kycForm.first_name),
      last_name: sanitize(kycForm.last_name),
      middle_name: sanitize(kycForm.middle_name),
      phone_number: sanitize(kycForm.phone_number),
      dob: sanitize(kycForm.dob),
      nationality: sanitize(kycForm.nationality),
      address_line1: sanitize(kycForm.address_line1),
      address_line2: sanitize(kycForm.address_line2),
      city: sanitize(kycForm.city),
      state: sanitize(kycForm.state),
      postal_code: sanitize(kycForm.postal_code),
      country: sanitize(kycForm.country),
      id_type: sanitize(kycForm.id_type) || "passport",
      id_number: sanitize(kycForm.id_number),
      id_country: sanitize(kycForm.id_country),
      id_expiry: sanitize(kycForm.id_expiry),
      id_front_url: sanitize(idFront.uploadedUrl),
      id_back_url: sanitize(idBack.uploadedUrl),
      selfie_url: sanitize(selfie.uploadedUrl),
    };
    try {
      const response = await fetch("/api/marketplace/account/kyc", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.status !== "success") {
        toast.error(result?.message || "Failed to save verification progress");
        return false;
      }
      return true;
    } catch (error) {
      toast.error(error?.message || "Failed to save verification progress");
      return false;
    } finally {
      setIsSavingKycDraft(false);
    }
  }, [hasKycInputData, isSavingKycDraft, kyc, kycForm, idFront, idBack, selfie]);

  useEffect(() => {
    if (kyc) {
      setKycForm((prev) => ({
        ...prev,
        first_name: kyc.first_name || "",
        last_name: kyc.last_name || "",
        middle_name: kyc.middle_name || "",
        phone_number: kyc.phone_number || "",
        dob: kyc.dob ? new Date(kyc.dob).toISOString().slice(0, 10) : "",
        nationality: kyc.nationality || "",
        address_line1: kyc.address_line1 || "",
        address_line2: kyc.address_line2 || "",
        city: kyc.city || "",
        state: kyc.state || "",
        postal_code: kyc.postal_code || "",
        country: kyc.country || "",
        id_type: kyc.id_type || "passport",
        id_number: kyc.id_number || "",
        id_country: kyc.id_country || "",
        id_expiry: kyc.id_expiry
          ? new Date(kyc.id_expiry).toISOString().slice(0, 10)
          : "",
      }));
      setIdFront((p) => ({ ...p, uploadedUrl: kyc.id_front_url || null }));
      setIdBack((p) => ({ ...p, uploadedUrl: kyc.id_back_url || null }));
      setSelfie((p) => ({ ...p, uploadedUrl: kyc.selfie_url || null }));
    }
  }, [kyc]);

  const setField = (key, value) =>
    setKycForm((prev) => ({ ...prev, [key]: value }));

  const handleFilePick = (setter) => async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    // Hard-block files over 2MB and show error
    if (file.size > MAX_BYTES) {
      setter({
        file: null,
        preview: null,
        uploadedUrl: null,
        uploading: false,
        size: file.size,
      });
      toast.error(`File too large (${formatMB(file.size)} MB). Max 2.00 MB.`);
      return;
    }
    // Start upload immediately for better DX
    setter({
      file,
      preview,
      uploadedUrl: null,
      uploading: true,
      size: file.size,
    });
    try {
      const url = await uploadImage(file);
      setter({
        file,
        preview,
        uploadedUrl: url,
        uploading: false,
        size: file.size,
      });
    } catch (err) {
      setter({
        file,
        preview,
        uploadedUrl: null,
        uploading: false,
        size: file.size,
      });
      toast.error(`Upload failed: ${err.message}`);
    }
  };

  const uploadImage = async (file) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", "kyc");
    const res = await fetch("/api/upload/images", { method: "POST", body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.message || "Upload failed");
    }
    const data = await res.json();
    return data?.urls?.[0] || null;
  };

  const memberSinceText = useMemo(() => {
    if (!profile?.memberSince) return null;
    try {
      return new Date(profile.memberSince).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        timeZone: "UTC",
      });
    } catch {
      return null;
    }
  }, [profile]);

  const displayFirstName = draftProfile?.firstName || profile?.firstName || "";
  const displayLastName = draftProfile?.lastName || profile?.lastName || "";
  const displayName = useMemo(() => {
    const combined = `${displayFirstName} ${displayLastName}`.trim();
    return profile?.name || combined;
  }, [displayFirstName, displayLastName, profile?.name]);

  if (accountQueryLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          Loading your account...
        </div>
      </div>
    );
  }

  if (accountQueryError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-foreground">Failed to load your account.</p>
          <Button onClick={() => refetchAccountQuery()}>Retry</Button>
        </div>
      </div>
    );
  }
  console.log("KYC FORM", kycForm);
  return (
    <div className="min-h-screen bg-background">
      <MarketplaceHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearch={() => {}}
        cartItemCount={0}
      />

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Avatar className="w-16 h-16 ring-4 ring-border shadow-xl">
            <AvatarImage
              src={profile?.image || "/default-avatar.png"}
              alt={displayName}
              className="object-cover"
            />
            <AvatarFallback className="text-2xl bg-gradient-to-br from-blue-500 to-purple-600 text-white">
              {displayName?.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold">
              {displayFirstName || displayLastName
                ? `${displayFirstName} ${displayLastName}`.trim()
                : displayName}
            </h1>
            <p className="text-muted-foreground">
              {memberSinceText ? `Member since ${memberSinceText}` : null}
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="flex flex-wrap w-full h-auto gap-1 p-1">
            <TabsTrigger value="purchases" className="flex-1 min-w-[100px] text-xs sm:text-sm">Purchases</TabsTrigger>
            <TabsTrigger value="my-products" className="flex-1 min-w-[100px] text-xs sm:text-sm">Products</TabsTrigger>
            <TabsTrigger value="payouts" className="flex-1 min-w-[80px] text-xs sm:text-sm">Payouts</TabsTrigger>
            <TabsTrigger value="billing" className="flex-1 min-w-[80px] text-xs sm:text-sm">Billing</TabsTrigger>
            <TabsTrigger value="settings" className="flex-1 min-w-[80px] text-xs sm:text-sm">Settings</TabsTrigger>
            <TabsTrigger value="verification" className="flex-1 min-w-[100px] text-xs sm:text-sm">Verification</TabsTrigger>
          </TabsList>

          <TabsContent value="purchases" className="mt-6">
            <MyPurchases />
          </TabsContent>

          <TabsContent value="my-products" className="mt-6">
            <MyProducts />
          </TabsContent>

          <TabsContent value="payouts" className="mt-6">
            <PayoutsTab />
          </TabsContent>

          <TabsContent value="billing" className="mt-6">
            <MyBillings />
          </TabsContent>

          <TabsContent value="verification" className="mt-6">
            <MyVerification
              kycFormAction={kycFormAction}
              kycForm={kycForm}
              idFront={idFront}
              idBack={idBack}
              selfie={selfie}
              kycStep={kycStep}
              kycIsPending={kycIsPending}
              setField={setField}
              handleFilePick={handleFilePick}
              MAX_BYTES={MAX_BYTES}
              setKycStep={setKycStep}
              formatMB={formatMB}
              setIdFront={setIdFront}
              setIdBack={setIdBack}
              onAutoSaveDraft={saveKycDraft}
              isSavingKycDraft={isSavingKycDraft}
              setSelfie={setSelfie}
            />
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <AccountSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
