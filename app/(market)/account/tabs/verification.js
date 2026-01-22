"use client";
import React, { useCallback, useMemo } from "react";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Badge } from "../../../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from "../../../components/ui/alert";
import {
  Loader2,
  ShieldCheck,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { useAccount } from "../context";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { CountrySelect } from "../../../components/country-select";
import { toast } from "sonner";
import { cn } from "../../../lib/utils";

const REQUIRED_FIELD_LABELS = {
  first_name: "First name",
  last_name: "Last name",
  middle_name: "Middle name",
  phone_number: "Phone number",
  dob: "Date of birth",
  nationality: "Nationality",
  address_line1: "Address line 1",
  address_line2: "Address line 2",
  city: "City",
  state: "State/Province",
  postal_code: "Postal code",
  country: "Country",
  id_type: "Document type",
  id_number: "Document number",
  id_country: "Issuing country",
  id_expiry: "Expiry date",
  id_front_url: "ID front",
  id_back_url: "ID back",
  selfie_url: "Selfie",
};

const REQUIRED_FIELDS_BY_STEP = {
  0: ["first_name", "last_name", "phone_number", "dob", "nationality"],
  1: [
    "address_line1",
    "address_line2",
    "city",
    "state",
    "postal_code",
    "country",
  ],
  2: [
    "id_type",
    "id_number",
    "id_country",
    "id_expiry",
    "id_front_url",
    "id_back_url",
  ],
  3: ["selfie_url"],
};

const FieldLabel = ({ label, required = false, htmlFor }) => (
  <Label htmlFor={htmlFor} className="flex items-center gap-1">
    {label}
    {required ? (
      <span className="text-red-500 font-semibold" aria-hidden="true">
        *
      </span>
    ) : (
      <span className="text-xs text-muted-foreground">(optional)</span>
    )}
  </Label>
);

const isFieldRequired = (field) => field !== "middle_name";

export default function MyVerification(props) {
  const {
    kycFormAction,
    kycForm,
    idFront,
    idBack,
    selfie,
    kycStep,
    kycIsPending,
    setField,
    handleFilePick,
    MAX_BYTES,
    setKycStep,
    formatMB,
    setIdFront,
    setIdBack,
    setSelfie,
    onAutoSaveDraft,
    isSavingKycDraft,
  } = props;

  const { kyc, profile } = useAccount();
  const isKycExempt = Boolean(
    profile?.crowdpen_staff === true ||
      profile?.role === "admin" ||
      profile?.role === "senior_admin"
  );

  const formatMissingFields = useCallback((fields) => {
    return fields
      .map((field) => REQUIRED_FIELD_LABELS[field] || field)
      .filter(Boolean)
      .join(", ");
  }, []);

  const missingByStep = useMemo(() => {
    const getFieldValue = (field) => {
      switch (field) {
        case "id_front_url":
          return idFront?.uploadedUrl;
        case "id_back_url":
          return idBack?.uploadedUrl;
        case "selfie_url":
          return selfie?.uploadedUrl;
        default:
          return typeof kycForm?.[field] === "string"
            ? kycForm[field]?.trim()
            : kycForm?.[field];
      }
    };

    return Object.entries(REQUIRED_FIELDS_BY_STEP).reduce(
      (acc, [step, fields]) => {
        acc[Number(step)] = fields.filter((field) => {
          const value = getFieldValue(field);
          if (typeof value === "string") {
            return value.length === 0;
          }
          return !value;
        });
        return acc;
      },
      {}
    );
  }, [kycForm, idFront, idBack, selfie]);

  const allMissingRequiredFields = useMemo(() => {
    return Array.from(new Set(Object.values(missingByStep).flat()));
  }, [missingByStep]);

  const currentStepMissing = useMemo(
    () => missingByStep[kycStep] || [],
    [missingByStep, kycStep]
  );

  const uploadsInProgress =
    (kycStep === 2 && (idFront?.uploading || idBack?.uploading)) ||
    (kycStep === 3 && selfie?.uploading);

  const nextDisabled =
    kycIsPending ||
    isSavingKycDraft ||
    uploadsInProgress ||
    currentStepMissing.length > 0;

  const handleNextStep = useCallback(async () => {
    if (kycStep >= 4 || nextDisabled) {
      if (currentStepMissing.length > 0) {
        toast.error(
          `Please complete the following before continuing: ${formatMissingFields(currentStepMissing)}`
        );
      }
      return;
    }

    const saved = (await onAutoSaveDraft?.()) !== false;
    if (saved) {
      setKycStep((s) => Math.min(4, s + 1));
    }
  }, [
    currentStepMissing,
    formatMissingFields,
    kycStep,
    nextDisabled,
    onAutoSaveDraft,
    setKycStep,
  ]);

  const submitDisabled =
    kycIsPending ||
    idFront.uploading ||
    idBack.uploading ||
    selfie.uploading ||
    idFront.size > MAX_BYTES ||
    idBack.size > MAX_BYTES ||
    selfie.size > MAX_BYTES ||
    allMissingRequiredFields.length > 0;

  return (
    <>
      <Card data-testid="verification-card">
        <CardHeader data-testid="verification-header">
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Identity Verification (KYC)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6" data-testid="verification-content">
          {isKycExempt ? (
            <div
              className="p-4 rounded-md border border-border bg-muted/50 text-muted-foreground flex items-start gap-3"
              data-testid="verification-exempt"
            >
              <ShieldCheck className="h-5 w-5 text-green-600 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Status: EXEMPT</Badge>
                </div>
                <p className="text-sm mt-1">
                  KYC is not required for your account.
                </p>
              </div>
            </div>
          ) : (
            <form
              action={kycFormAction}
              className="space-y-6"
              data-testid="verification-form"
            >
            {/* Hidden fields for status, level, select value and uploaded URLs */}
            <input type="hidden" name="status" value="pending" />
            <input
              type="hidden"
              name="level"
              value={kyc?.level || "standard"}
            />
            <input
              type="hidden"
              name="first_name"
              value={kycForm.first_name || ""}
            />
            <input
              type="hidden"
              name="last_name"
              value={kycForm.last_name || ""}
            />
            <input
              type="hidden"
              name="middle_name"
              value={kycForm.middle_name || ""}
            />
            <input
              type="hidden"
              name="phone_number"
              value={kycForm.phone_number || ""}
            />
            <input type="hidden" name="dob" value={kycForm.dob || ""} />
            <input
              type="hidden"
              name="nationality"
              value={kycForm.nationality || ""}
            />
            <input
              type="hidden"
              name="address_line1"
              value={kycForm.address_line1 || ""}
            />
            <input
              type="hidden"
              name="address_line2"
              value={kycForm.address_line2 || ""}
            />
            <input type="hidden" name="city" value={kycForm.city || ""} />
            <input type="hidden" name="state" value={kycForm.state || ""} />
            <input
              type="hidden"
              name="postal_code"
              value={kycForm.postal_code || ""}
            />
            <input type="hidden" name="country" value={kycForm.country || ""} />
            <input type="hidden" name="id_type" value={kycForm.id_type} />
            <input
              type="hidden"
              name="id_number"
              value={kycForm.id_number || ""}
            />
            <input
              type="hidden"
              name="id_country"
              value={kycForm.id_country || ""}
            />
            <input
              type="hidden"
              name="id_expiry"
              value={kycForm.id_expiry || ""}
            />
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
            <input type="hidden" name="selfie_size" value={selfie.size ?? ""} />
            <div
              className="p-4 rounded-md border border-border bg-muted/50 text-muted-foreground flex items-start gap-3"
              data-testid="verification-status"
            >
              {kyc?.status === "approved" ? (
                <ShieldCheck className="h-5 w-5 text-green-600 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    Status:{" "}
                    {kyc?.status ? kyc.status.toUpperCase() : "UNVERIFIED"}
                  </Badge>
                  {kyc?.submitted_at && (
                    <span className="text-xs text-muted-foreground">
                      Submitted{" "}
                      {new Date(kyc.submitted_at).toLocaleDateString("en-US", { timeZone: "UTC" })}
                    </span>
                  )}
                </div>
                <p className="text-sm mt-1">
                  {kyc?.status === "approved"
                    ? "You're verified. Thanks for keeping our marketplace safe!"
                    : kyc?.status === "pending"
                      ? "Your documents are under review. We'll notify you once it's done."
                      : kyc?.status === "rejected"
                        ? "We couldn't approve your verification. See the reason below and resubmit your details."
                        : "Get verified to unlock purchases and selling with confidence."}
                </p>
              </div>
            </div>

            {kyc?.status === "rejected" && (
              <div className="mt-3">
                <Alert
                  variant="destructive"
                  className="border-destructive/40 bg-destructive/10"
                  data-testid="verification-rejected"
                >
                  <AlertCircle className="h-5 w-5" />
                  <AlertTitle>Verification not approved</AlertTitle>
                  <AlertDescription>
                    <div className="space-y-2">
                      <p className="text-sm">
                        {kyc?.rejection_reason ||
                          "Please review your details and resubmit."}
                      </p>
                      <p className="text-sm">
                        Update your information below and submit again.
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {kyc?.status === "approved" && (
              <div className="text-sm text-muted-foreground" data-testid="verification-approved-summary">
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
                <div className="grid grid-cols-5 gap-2" data-testid="verification-stepper">
                  {["Personal", "Address", "ID", "Selfie", "Review"].map(
                    (label, idx) => (
                      <div
                        key={label}
                        className={`flex items-center justify-center rounded-md border px-2 py-1 text-sm ${
                          kycStep === idx
                            ? "bg-blue-600 text-white border-blue-600"
                            : idx < kycStep
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-background text-foreground"
                        }`}
                        data-testid={`verification-step-${idx}`}
                      >
                        <span className="mr-2">{idx + 1}</span>
                        <span className="truncate">{label}</span>
                      </div>
                    )
                  )}
                </div>

                {/* Steps */}
                {kycStep === 0 && (
                  <div className="grid sm:grid-cols-2 gap-4" data-testid="verification-step-personal">
                    <div>
                      <Label>First Name</Label>
                      <Input
                        name="first_name"
                        value={kycForm.first_name}
                        onChange={(e) => setField("first_name", e.target.value)}
                        data-testid="verification-first-name"
                      />
                    </div>
                    <div>
                      <Label>Last Name</Label>
                      <Input
                        name="last_name"
                        value={kycForm.last_name}
                        onChange={(e) => setField("last_name", e.target.value)}
                        data-testid="verification-last-name"
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
                        data-testid="verification-middle-name"
                      />
                    </div>
                    <div>
                      <Label>Phone Number</Label>
                      <div className="phone-input-container" data-testid="verification-phone">
                        <PhoneInput
                          placeholder="Enter phone number"
                          value={kycForm.phone_number}
                          onChange={(v) => setField("phone_number", v)}
                          international={false}
                          defaultCountry="US"
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>.PhoneInputCountry]:mr-2 [&>input]:bg-transparent [&>input]:outline-none [&>input]:border-none [&>input]:h-full [&>input]:w-full [&>input]:placeholder:text-muted-foreground"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Date of Birth</Label>
                      <Input
                        name="dob"
                        type="date"
                        value={kycForm.dob}
                        max={new Date().toISOString().split("T")[0]}
                        onChange={(e) => setField("dob", e.target.value)}
                        data-testid="verification-dob"
                      />
                    </div>
                    <div>
                      <Label>Nationality</Label>
                      <CountrySelect
                        value={kycForm.nationality}
                        onChange={(v) => setField("nationality", v)}
                        placeholder="Select nationality..."
                        dataTestId="verification-nationality"
                      />
                    </div>
                  </div>
                )}

                {kycStep === 1 && (
                  <div className="grid sm:grid-cols-2 gap-4" data-testid="verification-step-address">
                    <div>
                      <Label>Address Line 1</Label>
                      <Input
                        name="address_line1"
                        value={kycForm.address_line1}
                        onChange={(e) =>
                          setField("address_line1", e.target.value)
                        }
                        data-testid="verification-address-line1"
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
                        data-testid="verification-address-line2"
                      />
                    </div>
                    <div>
                      <Label>City</Label>
                      <Input
                        name="city"
                        value={kycForm.city}
                        onChange={(e) => setField("city", e.target.value)}
                        data-testid="verification-city"
                      />
                    </div>
                    <div>
                      <Label>State/Province</Label>
                      <Input
                        name="state"
                        value={kycForm.state}
                        onChange={(e) => setField("state", e.target.value)}
                        data-testid="verification-state"
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
                        data-testid="verification-postal-code"
                      />
                    </div>
                    <div>
                      <Label>Country</Label>
                      <CountrySelect
                        value={kycForm.country}
                        onChange={(v) => setField("country", v)}
                        placeholder="Select country..."
                        dataTestId="verification-country"
                      />
                    </div>
                  </div>
                )}

                {kycStep === 2 && (
                  <div className="grid sm:grid-cols-2 gap-4" data-testid="verification-step-id">
                    <div>
                      <Label>Document Type</Label>
                      <Select
                        value={kycForm.id_type}
                        onValueChange={(v) => setField("id_type", v)}
                      >
                        <SelectTrigger data-testid="verification-id-type">
                          <SelectValue placeholder="Select document type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="passport">Passport</SelectItem>
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
                        onChange={(e) => setField("id_number", e.target.value)}
                        data-testid="verification-id-number"
                      />
                    </div>
                    <div>
                      <Label>Issuing Country</Label>
                      <CountrySelect
                        value={kycForm.id_country}
                        onChange={(v) => setField("id_country", v)}
                        placeholder="Select issuing country..."
                        dataTestId="verification-id-country"
                      />
                    </div>
                    <div>
                      <Label>Expiry Date</Label>
                      <Input
                        name="id_expiry"
                        type="date"
                        value={kycForm.id_expiry}
                        min={new Date().toISOString().split("T")[0]}
                        onChange={(e) => setField("id_expiry", e.target.value)}
                        data-testid="verification-id-expiry"
                      />
                    </div>

                    {/* Uploads */}
                    <div
                      className="sm:col-span-2 grid sm:grid-cols-2 gap-4"
                      data-testid="verification-id-uploads"
                    >
                      <div data-testid="verification-id-front-upload">
                        <Label>ID Front</Label>
                        <div className="mt-1 flex items-center gap-3">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFilePick(setIdFront)}
                            data-testid="verification-id-front"
                          />
                          {idFront.uploading && (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          )}
                          {(idFront.preview || idFront.uploadedUrl) && (
                            <a
                              href={idFront.uploadedUrl || idFront.preview}
                              target="_blank"
                              className="text-sm text-blue-600 underline flex items-center gap-1"
                              data-testid="verification-id-front-preview"
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
                      <div data-testid="verification-id-back-upload">
                        <Label>ID Back</Label>
                        <div className="mt-1 flex items-center gap-3">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFilePick(setIdBack)}
                            data-testid="verification-id-back"
                          />
                          {idBack.uploading && (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          )}
                          {(idBack.preview || idBack.uploadedUrl) && (
                            <a
                              href={idBack.uploadedUrl || idBack.preview}
                              target="_blank"
                              className="text-sm text-blue-600 underline flex items-center gap-1"
                              data-testid="verification-id-back-preview"
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
                  <div className="grid gap-4" data-testid="verification-step-selfie">
                    <div>
                      <Label>Selfie</Label>
                      <div className="mt-1 flex items-center gap-3">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFilePick(setSelfie)}
                          data-testid="verification-selfie"
                        />
                        {selfie.uploading && (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                        {(selfie.preview || selfie.uploadedUrl) && (
                          <a
                            href={selfie.uploadedUrl || selfie.preview}
                            target="_blank"
                            className="text-sm text-blue-600 underline flex items-center gap-1"
                            data-testid="verification-selfie-preview"
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
                  <div className="space-y-4" data-testid="verification-step-review">
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
                    <div className="flex items-center gap-4 text-sm" data-testid="verification-review-files">
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
                <div className="flex items-center justify-between" data-testid="verification-navigation">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setKycStep((s) => Math.max(0, s - 1))}
                    disabled={kycStep === 0 || kycIsPending}
                    data-testid="verification-back"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" /> Back
                  </Button>
                  <div className="flex items-center gap-2">
                    {kycStep < 4 ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleNextStep}
                        disabled={nextDisabled}
                        data-testid="verification-next"
                      >
                        {isSavingKycDraft ? (
                          <span className="inline-flex items-center">
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            Saving...
                          </span>
                        ) : (
                          <>
                            Next <ChevronRight className="h-4 w-4 ml-1" />
                          </>
                        )}
                      </Button>
                    ) : (
                      <Button
                        type="submit"
                        size="sm"
                        disabled={submitDisabled}
                        data-testid="verification-submit"
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
          )}
        </CardContent>
      </Card>
    </>
  );
}
