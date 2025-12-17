"use client";
import React from "react";
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

export default function MyVerification(props) {
  const { kyc } = useAccount();

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
    setIdBack
  } = props;

  return (
    <>
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
            <div className="p-4 rounded-md border border-border bg-muted/50 text-muted-foreground flex items-start gap-3">
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
                      {new Date(kyc.submitted_at).toLocaleDateString()}
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
              <div className="text-sm text-muted-foreground">
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
                              : "bg-background text-foreground"
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
                        onChange={(e) => setField("first_name", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Last Name</Label>
                      <Input
                        name="last_name"
                        value={kycForm.last_name}
                        onChange={(e) => setField("last_name", e.target.value)}
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
                        max={new Date().toISOString().split("T")[0]}
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
                        onChange={(e) => setField("state", e.target.value)}
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
                        onChange={(e) => setField("country", e.target.value)}
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
                      />
                    </div>
                    <div>
                      <Label>Issuing Country</Label>
                      <Input
                        name="id_country"
                        value={kycForm.id_country}
                        onChange={(e) => setField("id_country", e.target.value)}
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
                              href={idFront.uploadedUrl || idFront.preview}
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
                        onClick={() => setKycStep((s) => Math.min(4, s + 1))}
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
    </>
  );
}
