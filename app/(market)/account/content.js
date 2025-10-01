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
} from "lucide-react";
import MarketplaceHeader from "../../components/marketplace-header";
import { useAccount } from "./context";
import { toast } from "sonner";
import { upsertKyc } from "./action";
import BankDetailsCard from "./bank-card";

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
  const { profile, purchases = [], kyc, accountQuery } = useAccount();

  // Server Action wiring
  const [kycState, kycFormAction, kycIsPending] = useActionState(
    upsertKyc,
    initialStateValues
  );
  useEffect(() => {
    if (!kycState) return;
    if (kycState.success && kycState.message) {
      toast.success(kycState.message);
      setKycStep(0);
      accountQuery.refetch();
    } else if (!kycState.success && kycState.message) {
      toast.error(kycState.message);
    }
  }, [kycState, accountQuery]);

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
    size: undefined,
  });
  const [idBack, setIdBack] = useState({
    file: null,
    preview: null,
    uploadedUrl: null,
    uploading: false,
    size: undefined,
  });
  const [selfie, setSelfie] = useState({
    file: null,
    preview: null,
    uploadedUrl: null,
    uploading: false,
    size: undefined,
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

  if (accountQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="h-6 w-6 animate-spin" />
          Loading your account...
        </div>
      </div>
    );
  }

  if (accountQuery.isError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-slate-700">Failed to load your account.</p>
          <Button onClick={() => accountQuery.refetch()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <MarketplaceHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearch={() => {}}
        cartItemCount={0}
      />

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Avatar className="w-16 h-16 ring-4 ring-white shadow-xl">
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
            <TabsTrigger value="billing">Billing</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="verification">Verification</TabsTrigger>
          </TabsList>

          <TabsContent value="purchases" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  My Purchases ({purchases.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {purchases.map((purchase) => (
                    <div
                      key={purchase.id}
                      className="flex items-center justify-between p-4 border border-slate-300 rounded-lg"
                    >
                      <div className="flex-1">
                        <h3 className="font-semibold">{purchase.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          by {purchase.author}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>Purchased {purchase.purchaseDate}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            <span>${purchase.price}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {purchase.status === "completed"
                            ? "✓ Complete"
                            : "Processing"}
                        </Badge>
                        <Button size="sm">
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="billing" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Billing & Payment Methods
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-5 w-5" />
                      <div>
                        <div className="font-medium">•••• •••• •••• 4242</div>
                        <div className="text-sm text-muted-foreground">
                          Expires 12/25
                        </div>
                      </div>
                    </div>
                    <Badge>Default</Badge>
                  </div>
                </div>
                <Button variant="outline">Add Payment Method</Button>

                <Separator />

                <div>
                  <h3 className="font-semibold mb-3">Recent Transactions</h3>
                  <div className="space-y-2">
                    {purchases.map((purchase) => (
                      <div
                        key={purchase.id}
                        className="flex justify-between text-sm"
                      >
                        <span>{purchase.title}</span>
                        <span>${purchase.price}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="verification" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  Identity Verification (KYC)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <form action={kycFormAction} className="space-y-6">
                  {/* Hidden fields for status, level, select value and uploaded URLs */}
                  <input type="hidden" name="status" value="pending" />
                  <input
                    type="hidden"
                    name="level"
                    value={kyc?.level || "standard"}
                  />
                  <input type="hidden" name="id_type" value={kycForm.id_type} />
                  <input
                    type="hidden"
                    name="id_front_url"
                    value={idFront.uploadedUrl || ""}
                  />
                  <input
                    type="hidden"
                    name="id_back_url"
                    value={idBack.uploadedUrl || ""}
                  />
                  <input
                    type="hidden"
                    name="selfie_url"
                    value={selfie.uploadedUrl || ""}
                  />
                  {/* Hidden sizes for Zod validation on server */}
                  <input
                    type="hidden"
                    name="id_front_size"
                    value={idFront.size ?? ""}
                  />
                  <input
                    type="hidden"
                    name="id_back_size"
                    value={idBack.size ?? ""}
                  />
                  <input
                    type="hidden"
                    name="selfie_size"
                    value={selfie.size ?? ""}
                  />
                  <div className="p-4 rounded-md border bg-slate-50 text-slate-700 flex items-start gap-3">
                    {kyc?.status === "approved" ? (
                      <ShieldCheck className="h-5 w-5 text-green-600 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          Status:{" "}
                          {kyc?.status
                            ? kyc.status.toUpperCase()
                            : "UNVERIFIED"}
                        </Badge>
                        {kyc?.submitted_at && (
                          <span className="text-xs text-muted-foreground">
                            Submitted{" "}
                            {new Date(kyc.submitted_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <p className="text-sm mt-1">
                        {kyc?.status === "approved"
                          ? "You're verified. Thanks for keeping our marketplace safe!"
                          : kyc?.status === "pending"
                            ? "Your documents are under review. We'll notify you once it's done."
                            : "Get verified to unlock purchases and selling with confidence."}
                      </p>
                    </div>
                  </div>

                  {kyc?.status === "approved" && (
                    <div className="text-sm text-slate-600">
                      <p>Verification Level: {kyc?.level || "standard"}</p>
                      <p>
                        Name:{" "}
                        {[kyc?.first_name, kyc?.middle_name, kyc?.last_name]
                          .filter(Boolean)
                          .join(" ") || "—"}
                      </p>
                      <p>Country: {kyc?.country || "—"}</p>
                    </div>
                  )}

                  {kyc?.status !== "approved" && (
                    <>
                      {/* Stepper */}
                      <div className="grid grid-cols-5 gap-2">
                        {["Personal", "Address", "ID", "Selfie", "Review"].map(
                          (label, idx) => (
                            <div
                              key={label}
                              className={`flex items-center justify-center rounded-md border px-2 py-1 text-sm ${
                                kycStep === idx
                                  ? "bg-blue-600 text-white border-blue-600"
                                  : idx < kycStep
                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                    : "bg-white text-slate-700"
                              }`}
                            >
                              <span className="mr-2">{idx + 1}</span>
                              <span className="truncate">{label}</span>
                            </div>
                          )
                        )}
                      </div>

                      {/* Steps */}
                      {kycStep === 0 && (
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div>
                            <Label>First Name</Label>
                            <Input
                              name="first_name"
                              value={kycForm.first_name}
                              onChange={(e) =>
                                setField("first_name", e.target.value)
                              }
                            />
                          </div>
                          <div>
                            <Label>Last Name</Label>
                            <Input
                              name="last_name"
                              value={kycForm.last_name}
                              onChange={(e) =>
                                setField("last_name", e.target.value)
                              }
                            />
                          </div>
                          <div>
                            <Label>Middle Name (optional)</Label>
                            <Input
                              name="middle_name"
                              value={kycForm.middle_name}
                              onChange={(e) =>
                                setField("middle_name", e.target.value)
                              }
                            />
                          </div>
                          <div>
                            <Label>Phone Number</Label>
                            <Input
                              name="phone_number"
                              value={kycForm.phone_number}
                              onChange={(e) =>
                                setField("phone_number", e.target.value)
                              }
                            />
                          </div>
                          <div>
                            <Label>Date of Birth</Label>
                            <Input
                              name="dob"
                              type="date"
                              value={kycForm.dob}
                              onChange={(e) => setField("dob", e.target.value)}
                            />
                          </div>
                          <div>
                            <Label>Nationality</Label>
                            <Input
                              name="nationality"
                              value={kycForm.nationality}
                              onChange={(e) =>
                                setField("nationality", e.target.value)
                              }
                            />
                          </div>
                        </div>
                      )}

                      {kycStep === 1 && (
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div>
                            <Label>Address Line 1</Label>
                            <Input
                              name="address_line1"
                              value={kycForm.address_line1}
                              onChange={(e) =>
                                setField("address_line1", e.target.value)
                              }
                            />
                          </div>
                          <div>
                            <Label>Address Line 2</Label>
                            <Input
                              name="address_line2"
                              value={kycForm.address_line2}
                              onChange={(e) =>
                                setField("address_line2", e.target.value)
                              }
                            />
                          </div>
                          <div>
                            <Label>City</Label>
                            <Input
                              name="city"
                              value={kycForm.city}
                              onChange={(e) => setField("city", e.target.value)}
                            />
                          </div>
                          <div>
                            <Label>State/Province</Label>
                            <Input
                              name="state"
                              value={kycForm.state}
                              onChange={(e) =>
                                setField("state", e.target.value)
                              }
                            />
                          </div>
                          <div>
                            <Label>Postal Code</Label>
                            <Input
                              name="postal_code"
                              value={kycForm.postal_code}
                              onChange={(e) =>
                                setField("postal_code", e.target.value)
                              }
                            />
                          </div>
                          <div>
                            <Label>Country</Label>
                            <Input
                              name="country"
                              value={kycForm.country}
                              onChange={(e) =>
                                setField("country", e.target.value)
                              }
                            />
                          </div>
                        </div>
                      )}

                      {kycStep === 2 && (
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div>
                            <Label>Document Type</Label>
                            <Select
                              value={kycForm.id_type}
                              onValueChange={(v) => setField("id_type", v)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select document type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="passport">
                                  Passport
                                </SelectItem>
                                <SelectItem value="national_id">
                                  National ID
                                </SelectItem>
                                <SelectItem value="driver_license">
                                  Driver License
                                </SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Document Number</Label>
                            <Input
                              name="id_number"
                              value={kycForm.id_number}
                              onChange={(e) =>
                                setField("id_number", e.target.value)
                              }
                            />
                          </div>
                          <div>
                            <Label>Issuing Country</Label>
                            <Input
                              name="id_country"
                              value={kycForm.id_country}
                              onChange={(e) =>
                                setField("id_country", e.target.value)
                              }
                            />
                          </div>
                          <div>
                            <Label>Expiry Date</Label>
                            <Input
                              name="id_expiry"
                              type="date"
                              value={kycForm.id_expiry}
                              onChange={(e) =>
                                setField("id_expiry", e.target.value)
                              }
                            />
                          </div>

                          {/* Uploads */}
                          <div className="sm:col-span-2 grid sm:grid-cols-2 gap-4">
                            <div>
                              <Label>ID Front</Label>
                              <div className="mt-1 flex items-center gap-3">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleFilePick(setIdFront)}
                                />
                                {idFront.uploading && (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                )}
                                {(idFront.preview || idFront.uploadedUrl) && (
                                  <a
                                    href={
                                      idFront.uploadedUrl || idFront.preview
                                    }
                                    target="_blank"
                                    className="text-sm text-blue-600 underline flex items-center gap-1"
                                  >
                                    <ImageIcon className="h-4 w-4" /> Preview
                                  </a>
                                )}
                              </div>
                              {idFront.size > MAX_BYTES && (
                                <p className="text-xs text-red-600 mt-1">
                                  File must be 2MB or less (selected:{" "}
                                  {formatMB(idFront.size)} MB)
                                </p>
                              )}
                              <input
                                type="hidden"
                                name="id_front_size"
                                value={idFront.size}
                              />
                            </div>
                            <div>
                              <Label>ID Back</Label>
                              <div className="mt-1 flex items-center gap-3">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleFilePick(setIdBack)}
                                />
                                {idBack.uploading && (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                )}
                                {(idBack.preview || idBack.uploadedUrl) && (
                                  <a
                                    href={idBack.uploadedUrl || idBack.preview}
                                    target="_blank"
                                    className="text-sm text-blue-600 underline flex items-center gap-1"
                                  >
                                    <ImageIcon className="h-4 w-4" /> Preview
                                  </a>
                                )}
                              </div>
                              {idBack.size > MAX_BYTES && (
                                <p className="text-xs text-red-600 mt-1">
                                  File must be 2MB or less (selected:{" "}
                                  {formatMB(idBack.size)} MB)
                                </p>
                              )}
                              <input
                                type="hidden"
                                name="id_back_size"
                                value={idBack.size}
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {kycStep === 3 && (
                        <div className="grid gap-4">
                          <div>
                            <Label>Selfie</Label>
                            <div className="mt-1 flex items-center gap-3">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleFilePick(setSelfie)}
                              />
                              {selfie.uploading && (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              )}
                              {(selfie.preview || selfie.uploadedUrl) && (
                                <a
                                  href={selfie.uploadedUrl || selfie.preview}
                                  target="_blank"
                                  className="text-sm text-blue-600 underline flex items-center gap-1"
                                >
                                  <ImageIcon className="h-4 w-4" /> Preview
                                </a>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Tip: Use good lighting. Your face must be clearly
                              visible.
                            </p>
                            {selfie.size > MAX_BYTES && (
                              <p className="text-xs text-red-600 mt-1">
                                File must be 2MB or less (selected:{" "}
                                {formatMB(selfie.size)} MB)
                              </p>
                            )}
                            <input
                              type="hidden"
                              name="selfie_size"
                              value={selfie.size}
                            />
                          </div>
                        </div>
                      )}

                      {kycStep === 4 && (
                        <div className="space-y-4">
                          <div className="grid sm:grid-cols-2 gap-4">
                            <div>
                              <Label>Full Name</Label>
                              <div className="mt-1 text-sm">
                                {[
                                  kycForm.first_name,
                                  kycForm.middle_name,
                                  kycForm.last_name,
                                ]
                                  .filter(Boolean)
                                  .join(" ") || "—"}
                              </div>
                            </div>
                            <div>
                              <Label>Phone</Label>
                              <div className="mt-1 text-sm">
                                {kycForm.phone_number || "—"}
                              </div>
                            </div>
                            <div>
                              <Label>Address</Label>
                              <div className="mt-1 text-sm">
                                {[
                                  kycForm.address_line1,
                                  kycForm.address_line2,
                                  kycForm.city,
                                  kycForm.state,
                                  kycForm.postal_code,
                                  kycForm.country,
                                ]
                                  .filter(Boolean)
                                  .join(", ") || "—"}
                              </div>
                            </div>
                            <div>
                              <Label>Document</Label>
                              <div className="mt-1 text-sm">
                                {kycForm.id_type} • {kycForm.id_number || "—"}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span>
                              ID Front:{" "}
                              {idFront.uploadedUrl
                                ? "Uploaded"
                                : idFront.file
                                  ? "Selected"
                                  : "—"}
                            </span>
                            <span>
                              ID Back:{" "}
                              {idBack.uploadedUrl
                                ? "Uploaded"
                                : idBack.file
                                  ? "Selected"
                                  : "—"}
                            </span>
                            <span>
                              Selfie:{" "}
                              {selfie.uploadedUrl
                                ? "Uploaded"
                                : selfie.file
                                  ? "Selected"
                                  : "—"}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Navigation */}
                      <div className="flex items-center justify-between">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setKycStep((s) => Math.max(0, s - 1))}
                          disabled={kycStep === 0 || kycIsPending}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" /> Back
                        </Button>
                        <div className="flex items-center gap-2">
                          {kycStep < 4 ? (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() =>
                                setKycStep((s) => Math.min(4, s + 1))
                              }
                              disabled={kycIsPending}
                            >
                              Next <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                          ) : (
                            <Button
                              type="submit"
                              size="sm"
                              disabled={
                                kycIsPending ||
                                idFront.uploading ||
                                idBack.uploading ||
                                selfie.uploading ||
                                idFront.size > MAX_BYTES ||
                                idBack.size > MAX_BYTES ||
                                selfie.size > MAX_BYTES
                              }
                            >
                              {kycIsPending ? (
                                <span className="inline-flex items-center">
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />{" "}
                                  Submitting...
                                </span>
                              ) : (
                                "Submit for Review"
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <div className="space-y-6">
              <BankDetailsCard />
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Account Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-3">Email Preferences</h3>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" defaultChecked />
                      <span className="text-sm">New product notifications</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" defaultChecked />
                      <span className="text-sm">Weekly newsletter</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" />
                      <span className="text-sm">Marketing emails</span>
                    </label>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold mb-3">Privacy Settings</h3>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" defaultChecked />
                      <span className="text-sm">Make my purchases public</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" />
                      <span className="text-sm">
                        Allow others to see my wishlist
                      </span>
                    </label>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold mb-3 text-red-600">
                    Danger Zone
                  </h3>
                  <Button variant="destructive" size="sm">
                    Delete Account
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
