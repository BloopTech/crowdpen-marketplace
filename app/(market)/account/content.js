"use client";

import React, { useEffect, useMemo, useState, useActionState } from "react";
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
  const [kycStep, setKycStep] = useState(0);
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
      });
    } catch (_) {
      return null;
    }
  }, [profile?.memberSince]);

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

        <Tabs defaultValue="purchases" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="purchases">My Purchases</TabsTrigger>
            <TabsTrigger value="my-products">My Products</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="verification">Verification</TabsTrigger>
          </TabsList>

          <TabsContent value="purchases" className="mt-6">
            <MyPurchases />
          </TabsContent>

          <TabsContent value="my-products" className="mt-6">
            <MyProducts />
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
            />
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <div className="space-y-6">
              <BankDetailsCard />
            </div>
            <AccountSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
