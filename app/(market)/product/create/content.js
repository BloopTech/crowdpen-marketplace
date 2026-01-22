"use client";
import React, {
  useCallback,
  useState,
  useEffect,
  useRef,
  useActionState,
  useMemo,
} from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { createProduct } from "./action";
import {
  Loader2,
  Upload,
  PlusCircle,
  ImageIcon,
  X,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { reportClientError } from "../../../lib/observability/reportClientError";
import Image from "next/image";
import Link from "next/link";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Switch } from "../../../components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Checkbox } from "../../../components/ui/checkbox";
import { useProductContext } from "./context";
import WhatIncludedEditor from "./what-included-editor";
import RichTextEditor from "../components/rich-text-editor";

const initialStateValues = {
  message: "",
  errors: {
    title: [],
    description: [],
    price: [],
    originalPrice: [],
    sale_end_date: [],
    product_status: [],
    stock: [],
    marketplace_category_id: [],
    marketplace_subcategory_id: [],
    images: [],
    productFile: [],
    fileType: [],
    fileSize: [],
    license: [],
    deliveryTime: [],
    what_included: [],
    credentials: {},
    unknown: "",
  },
  values: {},
  data: {},
};

export default function CreateProductContent({ draftId }) {
  const { categoriesData } = useProductContext();
  const { data: session, status } = useSession();
  const [subCategories, setSubCategories] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [images, setImages] = useState([]);
  const [productFile, setProductFile] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [fileSize, setFileSize] = useState("");
  const [fileType, setFileType] = useState("");
  const [categoryID, setCategoryID] = useState("");
  const [price, setPrice] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const [saleEndDate, setSaleEndDate] = useState("");
  const [productStatus, setProductStatus] = useState("draft");
  const [stock, setStock] = useState("");
  const [description, setDescription] = useState("");
  const [whatIncluded, setWhatIncluded] = useState("");
  const [priceError, setPriceError] = useState("");
  const [hasDiscount, setHasDiscount] = useState(false);
  const [pricesInitialized, setPricesInitialized] = useState(false);
  const [uploadReady, setUploadReady] = useState(null); // null = unknown, true/false
  const [uploadCheckPending, setUploadCheckPending] = useState(false);
  const [uploadRetryCount, setUploadRetryCount] = useState(0);
  const [submitQueued, setSubmitQueued] = useState(false);
  const [state, formAction, isPending] = useActionState(
    createProduct,
    initialStateValues
  );
  const formRef = useRef(null);
  const uploadRetryTimeoutRef = useRef(null);
  const uploadCheckCooldownRef = useRef(0);
  const router = useRouter();

  const draftStorageKey = useMemo(() => {
    if (!session?.user?.id) return null;
    const base = "cp_marketplace_product_draft_v1";
    return draftId
      ? `${base}:${session.user.id}:${draftId}`
      : `${base}:${session.user.id}:new`;
  }, [session?.user?.id, draftId]);

  const [isLoadingDraft, setIsLoadingDraft] = useState(Boolean(draftId));
  const [draftServerId, setDraftServerId] = useState(draftId || null);
  const saveTimerRef = useRef(null);
  const lastSavedRef = useRef(0);
  const lastSentPayloadRef = useRef("");
  const draftKeyRef = useRef(null);

  useEffect(() => {
    if (typeof state?.values?.description === "string") {
      setDescription(state.values.description);
    }
  }, [state?.values?.description]);

  useEffect(() => {
    setDraftServerId(draftId || null);
  }, [draftId]);

  useEffect(() => {
    if (draftId) return;
    if (!draftStorageKey) return;
    if (status !== "authenticated") return;

    const metaKey = `${draftStorageKey}:meta`;

    try {
      const raw = localStorage.getItem(metaKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.draft_key && typeof parsed.draft_key === "string") {
          draftKeyRef.current = parsed.draft_key.slice(0, 200);
        }
      }
    } catch {
    }

    if (draftKeyRef.current) return;

    try {
      const key = `draft_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`.slice(
        0,
        200
      );
      draftKeyRef.current = key;
      localStorage.setItem(metaKey, JSON.stringify({ draft_key: key }));
    } catch {
    }
  }, [draftId, draftStorageKey, status]);

  useEffect(() => {
    if (!draftStorageKey) return;
    if (status !== "authenticated") return;
    try {
      const raw = localStorage.getItem(draftStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          if (typeof parsed.title === "string") {
            const el = formRef.current?.querySelector?.("input[name='title']");
            if (el && !el.value) el.value = parsed.title;
          }
          if (typeof parsed.description === "string") setDescription(parsed.description);
          if (typeof parsed.price === "string") setPrice(parsed.price);
          if (typeof parsed.originalPrice === "string") setOriginalPrice(parsed.originalPrice);
          if (typeof parsed.saleEndDate === "string") setSaleEndDate(parsed.saleEndDate);
          if (typeof parsed.productStatus === "string") setProductStatus(parsed.productStatus);
          if (typeof parsed.stock === "string") setStock(parsed.stock);
          if (typeof parsed.categoryID === "string") setCategoryID(parsed.categoryID);
          if (typeof parsed.whatIncluded === "string") setWhatIncluded(parsed.whatIncluded);
          if (typeof parsed.fileType === "string") setFileType(parsed.fileType);
          if (typeof parsed.fileSize === "string") setFileSize(parsed.fileSize);
        }
      }
    } catch {
    }
    (async () => {
      if (!draftId) {
        setIsLoadingDraft(false);
        return;
      }
      try {
        const res = await fetch(
          `/api/marketplace/products/drafts/${encodeURIComponent(draftId)}`,
          { credentials: "include", cache: "no-store" }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.status !== "success" || !data?.draft) {
          setIsLoadingDraft(false);
          return;
        }
        const d = data.draft;
        if (typeof d.title === "string") {
          const el = formRef.current?.querySelector?.("input[name='title']");
          if (el) el.value = d.title;
        }
        if (typeof d.description === "string") setDescription(d.description);
        if (d.price != null) setPrice(String(d.price));
        if (d.originalPrice != null) setOriginalPrice(String(d.originalPrice));
        if (d.sale_end_date) {
          try {
            setSaleEndDate(new Date(d.sale_end_date).toISOString().slice(0, 10));
          } catch {
          }
        }
        if (typeof d.product_status === "string") setProductStatus(d.product_status);
        if (d.stock != null) setStock(String(d.stock));
        if (typeof d.marketplace_category_id === "string") setCategoryID(d.marketplace_category_id);
        if (typeof d.what_included === "string") setWhatIncluded(d.what_included);
        if (typeof d.fileType === "string") setFileType(d.fileType);
        if (typeof d.fileSize === "string") setFileSize(d.fileSize);
      } catch {
      } finally {
        setIsLoadingDraft(false);
      }
    })();
  }, [draftStorageKey, status, draftId, formRef]);

  const buildLocalDraftSnapshot = useCallback(() => {
    const titleInput = formRef.current?.querySelector?.("input[name='title']");
    return {
      title: titleInput?.value || "",
      description: description || "",
      price: price || "",
      originalPrice: originalPrice || "",
      saleEndDate: saleEndDate || "",
      productStatus: productStatus || "draft",
      stock: stock || "",
      categoryID: categoryID || "",
      whatIncluded: whatIncluded || "",
      fileType: fileType || "",
      fileSize: fileSize || "",
    };
  }, [
    categoryID,
    description,
    fileSize,
    fileType,
    originalPrice,
    price,
    productStatus,
    saleEndDate,
    stock,
    whatIncluded,
  ]);

  const queueDraftSave = useCallback(() => {
    if (status !== "authenticated") return;
    if (!draftStorageKey) return;
    if (isPending) return;

    const snapshot = buildLocalDraftSnapshot();
    try {
      localStorage.setItem(draftStorageKey, JSON.stringify(snapshot));
    } catch {
    }

    const hasAnyContent =
      Boolean(snapshot.title?.trim()) ||
      Boolean(snapshot.description?.trim()) ||
      Boolean(snapshot.originalPrice?.trim()) ||
      Boolean(snapshot.price?.trim()) ||
      Boolean(snapshot.stock?.trim()) ||
      Boolean(snapshot.categoryID?.trim()) ||
      Boolean(snapshot.whatIncluded?.trim());
    if (!hasAnyContent) return;

    const payload = {
      title: snapshot.title || null,
      description: snapshot.description || null,
      price: snapshot.price || null,
      originalPrice: snapshot.originalPrice || null,
      sale_end_date: snapshot.saleEndDate || null,
      product_status: snapshot.productStatus || "draft",
      stock: snapshot.stock || null,
      marketplace_category_id: snapshot.categoryID || null,
      what_included: snapshot.whatIncluded || null,
      fileType: snapshot.fileType || null,
      fileSize: snapshot.fileSize || null,
    };

    if (!draftServerId && !draftKeyRef.current) {
      const metaKey = `${draftStorageKey}:meta`;
      try {
        const key = `draft_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`.slice(
          0,
          200
        );
        draftKeyRef.current = key;
        localStorage.setItem(metaKey, JSON.stringify({ draft_key: key }));
      } catch {
      }
    }

    const body = draftServerId
      ? payload
      : {
          draft_key: draftKeyRef.current || null,
          ...payload,
        };

    const nextPayloadStr = JSON.stringify(body);
    if (nextPayloadStr === lastSentPayloadRef.current) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(async () => {
      try {
        const now = Date.now();
        if (now - lastSavedRef.current < 1500) return;

        const endpoint = draftServerId
          ? `/api/marketplace/products/drafts/${encodeURIComponent(draftServerId)}`
          : "/api/marketplace/products/drafts";

        const res = await fetch(endpoint, {
          method: draftServerId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.status === "success" && data?.draft?.id) {
          lastSavedRef.current = Date.now();
          lastSentPayloadRef.current = nextPayloadStr;
          const returnedId = String(data.draft.id);
          if (!draftServerId && returnedId) setDraftServerId(returnedId);
        }
      } catch {
      }
    }, 900);
  }, [buildLocalDraftSnapshot, draftServerId, draftStorageKey, isPending, status]);

  const runUploadPrecheck = useCallback(async ({ silent = false } = {}) => {
    if (uploadCheckPending) return uploadReady === true;
    const now = Date.now();
    if (uploadCheckCooldownRef.current && now < uploadCheckCooldownRef.current) {
      return uploadReady === true;
    }
    setUploadCheckPending(true);
    try {
      const res = await fetch("/api/marketplace/products/upload-capabilities", {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      const ok = res.ok && data?.status === "success";
      if (!ok) {
        if (!silent) {
          toast.error(data?.message || "Uploads unavailable. Please retry shortly.");
        }
        setUploadReady(false);
        setUploadRetryCount((count) => count + 1);
        const nextAttempt = Math.min(uploadRetryCount + 1, 5);
        const delayMs = Math.min(30000, 2000 * 2 ** nextAttempt);
        uploadCheckCooldownRef.current = Date.now() + delayMs;
        return false;
      }
      setUploadReady(true);
      setUploadRetryCount(0);
      uploadCheckCooldownRef.current = 0;
      return true;
    } catch {
      if (!silent) {
        toast.error("Uploads unavailable. Please check your connection and retry.");
      }
      setUploadReady(false);
      setUploadRetryCount((count) => count + 1);
      const nextAttempt = Math.min(uploadRetryCount + 1, 5);
      const delayMs = Math.min(30000, 2000 * 2 ** nextAttempt);
      uploadCheckCooldownRef.current = Date.now() + delayMs;
      return false;
    } finally {
      setUploadCheckPending(false);
    }
  }, [uploadCheckPending, uploadReady, uploadRetryCount]);

  const deleteDirect = useCallback(async (key) => {
    if (!key) return;
    const res = await fetch("/api/marketplace/uploads/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ key }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.status !== "success") {
      throw new Error(data?.message || "Unable to delete upload");
    }
  }, []);

  const putWithProgress = useCallback((uploadUrl, headers, file, onProgress) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl);
      if (headers && typeof headers === "object") {
        for (const [key, value] of Object.entries(headers)) {
          if (value != null) xhr.setRequestHeader(String(key), String(value));
        }
      }
      xhr.upload.onprogress = (evt) => {
        if (!onProgress) return;
        if (evt && evt.lengthComputable) {
          const pct = Math.max(
            0,
            Math.min(100, Math.round((evt.loaded / evt.total) * 100))
          );
          onProgress(pct);
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error("Upload failed"));
        }
      };
      xhr.onerror = () => reject(new Error("Upload failed"));
      xhr.send(file);
    });
  }, []);

  const uploadDirect = useCallback(async (file, kind, onProgress) => {
    const res = await fetch("/api/marketplace/uploads/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        kind,
        filename: file?.name,
        contentType: file?.type,
        size: file?.size,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.status !== "success") {
      throw new Error(data?.message || "Unable to prepare upload");
    }
    const uploadUrl = data?.data?.uploadUrl;
    const publicUrl = data?.data?.publicUrl;
    const key = data?.data?.key;
    const headers = data?.data?.headers || {};
    if (!uploadUrl || !publicUrl || !key) {
      throw new Error("Unable to prepare upload");
    }
    try {
      await putWithProgress(uploadUrl, headers, file, onProgress);
    } catch (err) {
      try {
        if (key) await deleteDirect(key);
      } catch {
      }
      throw err;
    }
    return { publicUrl, key };
  }, [deleteDirect, putWithProgress]);

  useEffect(() => {
    if (status !== "authenticated") return;
    void runUploadPrecheck({ silent: true });
  }, [runUploadPrecheck, status]);

  useEffect(() => {
    if (status !== "authenticated") {
      if (uploadRetryTimeoutRef.current) {
        clearTimeout(uploadRetryTimeoutRef.current);
        uploadRetryTimeoutRef.current = null;
      }
      return;
    }
    if (uploadReady !== false || uploadCheckPending) {
      if (uploadRetryTimeoutRef.current) {
        clearTimeout(uploadRetryTimeoutRef.current);
        uploadRetryTimeoutRef.current = null;
      }
      return;
    }
    if (uploadRetryTimeoutRef.current) return;
    const cappedAttempt = Math.min(uploadRetryCount, 5);
    const delayMs = Math.min(30000, 2000 * 2 ** cappedAttempt);
    uploadRetryTimeoutRef.current = setTimeout(() => {
      uploadRetryTimeoutRef.current = null;
      void runUploadPrecheck({ silent: true });
    }, delayMs);
  }, [status, uploadReady, uploadCheckPending, uploadRetryCount, runUploadPrecheck]);

  useEffect(() => {
    return () => {
      if (uploadRetryTimeoutRef.current) {
        clearTimeout(uploadRetryTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (state?.message) {
      if (state?.success === false || Object.keys(state?.errors || {}).length > 0) {
        toast.error(state.message);
      } else if (Object.keys(state?.data || {}).length > 0) {
        toast.success(state.message);
        const destinationId = state?.data?.product_id || state?.data?.id;
        if (destinationId) {
          router.push(`/product/${destinationId}`);
        }
      }
    }
  }, [state?.message, state?.errors, state?.data, state?.success, router]);

  useEffect(() => {
    if (!state?.data || Object.keys(state.data || {}).length === 0) return;
    if (!draftStorageKey) return;
    try {
      localStorage.removeItem(draftStorageKey);
    } catch {
    }
  }, [state?.data, draftStorageKey]);

  console.log("categories", categoriesData);

  useEffect(() => {
    if (categoriesData?.length && categoryID) {
      setSubCategories(
        categoriesData?.find((category) => category.id === categoryID)
          ?.MarketplaceSubCategories
      );
    }
  }, [categoriesData, categoryID]);

  useEffect(() => {
    queueDraftSave();
  }, [queueDraftSave]);

  useEffect(() => {
    if (price && originalPrice && !pricesInitialized) {
      setPricesInitialized(true);
    }
  }, [price, originalPrice, pricesInitialized]);

  // Validate price relationship
  const validatePrices = (currentPrice, currentOriginalPrice) => {
    if (hasDiscount && currentOriginalPrice && currentPrice) {
      const priceNum = parseFloat(currentPrice);
      const originalPriceNum = parseFloat(currentOriginalPrice);

      if (originalPriceNum < priceNum) {
        setPriceError("Original price must be greater than or equal to sale price");
        return false;
      } else {
        setPriceError("");
        return true;
      }
    }
    setPriceError("");
    return true;
  };

  // Handle price change
  const handlePriceChange = (e) => {
    const newPrice = e.target.value;
    setPrice(newPrice);
    validatePrices(newPrice, originalPrice);
  };

  const netRevenue = useMemo(() => {
    const effective = hasDiscount ? price : originalPrice;
    const priceNum = parseFloat(effective);
    if (Number.isFinite(priceNum) && priceNum > 0) {
      const revenue = priceNum * 0.8;
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(revenue);
    }
    return null;
  }, [price, originalPrice, hasDiscount]);

  // Handle original price change
  const handleOriginalPriceChange = (e) => {
    const newOriginalPrice = e.target.value;
    setOriginalPrice(newOriginalPrice);
    if (!hasDiscount) {
      setPrice(newOriginalPrice);
    }
    validatePrices(price, newOriginalPrice);
  };

  // Handle image upload
  const handleImageUpload = async (e) => {
    const inputEl = e.target;
    const files = inputEl.files;
    if (!files || files.length === 0) return;

    setUploadingImage(true);

    try {
      const maxTotalSize = 3 * 1024 * 1024;
      const maxCombinedSize = 3 * 1024 * 1024; // 3MB total
      const incomingFiles = Array.from(files);

      const validIncoming = incomingFiles.filter((file) => {
        if (!file?.type?.startsWith?.("image/")) {
          toast.error(`${file?.name || "File"} is not a valid image file`);
          return false;
        }
        if (typeof file.size === "number" && file.size > maxTotalSize) {
          toast.error(`${file.name} must be 3MB or less.`);
          return false;
        }
        return true;
      });

      if (validIncoming.length === 0) {
        return;
      }
      const incomingNames = new Set(validIncoming.map((file) => file.name));
      const existingAdjustedTotal = images.reduce((acc, imageObj) => {
        const name = imageObj?.name;
        if (name && incomingNames.has(name)) {
          return acc;
        }
        return acc + (imageObj?.bytes || 0);
      }, 0);

      const incomingTotal = validIncoming.reduce((acc, file) => acc + file.size, 0);

      if (existingAdjustedTotal + incomingTotal > maxCombinedSize) {
        toast.error("Total images size must not exceed 3MB.");
        return;
      }

      const uploadJobs = validIncoming.map((file) => ({ file, name: file.name }));
      setImages((prev) => {
        const next = [...prev];

        for (const job of uploadJobs) {
          const file = job.file;
          const existingIndex = next.findIndex((img) => img?.name === job.name);
          const nextObj = {
            name: file.name,
            bytes: file.size,
            contentType: file.type,
            previewUrl: URL.createObjectURL(file),
            file,
            uploadedUrl: null,
            uploadedKey: null,
            uploading: true,
            progress: 0,
            error: "",
          };

          if (existingIndex >= 0) {
            const prevUrl = next[existingIndex]?.previewUrl;
            if (prevUrl) URL.revokeObjectURL(prevUrl);
            next[existingIndex] = nextObj;
          } else {
            next.push(nextObj);
          }
        }

        return next;
      });

      for (const job of uploadJobs) {
        try {
          const uploaded = await uploadDirect(job.file, "image", (pct) => {
            setImages((prev) =>
              prev.map((img) =>
                img?.name === job.name
                  ? {
                      ...img,
                      progress: pct,
                    }
                  : img
              )
            );
          });
          setImages((prev) =>
            prev.map((img) =>
              img?.name === job.name
                ? {
                    ...img,
                    uploadedUrl: uploaded.publicUrl,
                    uploadedKey: uploaded.key,
                    uploading: false,
                    progress: 100,
                    error: "",
                    file: null,
                  }
                : img
            )
          );
        } catch (err) {
          setImages((prev) =>
            prev.map((img) =>
              img?.name === job.name
                ? {
                    ...img,
                    uploading: false,
                    error: err?.message || "Upload failed",
                    progress: 0,
                  }
                : img
            )
          );
          toast.error(err?.message || "Failed to upload image");
        }
      }
    } catch (error) {
      try {
        await reportClientError(error, {
          tag: "product_create_handle_image_error",
        });
      } catch {
      }
      toast.error("Failed to process image");
    } finally {
      setUploadingImage(false);
      if (inputEl) inputEl.value = "";
    }
  };

  const retryImageUpload = async (index) => {
    const item = images?.[index];
    const file = item?.file;
    if (!file) {
      toast.error("Please re-upload the image");
      return;
    }
    setImages((prev) =>
      prev.map((img, i) =>
        i === index
          ? {
              ...img,
              uploading: true,
              progress: 0,
              error: "",
              uploadedUrl: null,
              uploadedKey: null,
            }
          : img
      )
    );
    try {
      const uploaded = await uploadDirect(file, "image", (pct) => {
        setImages((prev) =>
          prev.map((img, i) =>
            i === index
              ? {
                  ...img,
                  progress: pct,
                }
              : img
          )
        );
      });
      setImages((prev) =>
        prev.map((img, i) =>
          i === index
            ? {
                ...img,
                uploading: false,
                uploadedUrl: uploaded.publicUrl,
                uploadedKey: uploaded.key,
                progress: 100,
                error: "",
                file: null,
              }
            : img
        )
      );
      toast.success("Image uploaded");
    } catch (err) {
      setImages((prev) =>
        prev.map((img, i) =>
          i === index
            ? {
                ...img,
                uploading: false,
                error: err?.message || "Upload failed",
                progress: 0,
              }
            : img
        )
      );
      toast.error(err?.message || "Failed to upload image");
    }
  };

  // Remove an image
  const removeImage = async (index) => {
    const selected = images?.[index];
    const key = selected?.uploadedKey;
    try {
      if (key) await deleteDirect(key);
    } catch (err) {
      toast.error(err?.message || "Unable to delete image");
      return;
    }
    setImages((prev) => {
      const url = prev?.[index]?.previewUrl;
      if (url) URL.revokeObjectURL(url);
      return prev.filter((_, i) => i !== index);
    });
  };

  // Handle product file upload
  const handleFileUpload = async (e) => {
    const inputEl = e.target;
    const files = inputEl.files;
    if (!files || files.length === 0) return;

    setUploadingFile(true);
    const file = files[0];

    try {
      // Validate file size (max 25MB)
      const maxSize = 25 * 1024 * 1024; // 25MB
      if (file.size > maxSize) {
        toast.error("File size must be 25MB or less");
        return;
      }

      // Calculate and format file size
      const formatFileSize = (bytes) => {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
      };

      const formattedSize = formatFileSize(file.size);
      setFileSize(formattedSize);

      // Detect and set file type based on extension
      const getFileType = (fileName) => {
        const extension = fileName.split(".").pop().toLowerCase();
        const fileTypeMap = {
          pdf: "PDF",
          psd: "PSD",
          ai: "AI",
          fig: "FIGMA",
          figma: "FIGMA",
          zip: "ZIP",
          doc: "DOC",
          docx: "DOC",
          xls: "XLS",
          xlsx: "XLS",
          ppt: "PPT",
          pptx: "PPT",
        };
        return fileTypeMap[extension] || "PDF"; // Default to PDF if unknown
      };

      const detectedFileType = getFileType(file.name);
      setFileType(detectedFileType);

      setProductFile({
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        file,
        uploadedUrl: null,
        uploadedKey: null,
        uploading: true,
        progress: 0,
        error: "",
      });

      const uploaded = await uploadDirect(file, "productFile", (pct) => {
        setProductFile((prev) =>
          prev
            ? {
                ...prev,
                progress: pct,
              }
            : prev
        );
      });

      setProductFile({
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        file: null,
        uploadedUrl: uploaded.publicUrl,
        uploadedKey: uploaded.key,
        uploading: false,
        progress: 100,
        error: "",
      });

      toast.success(`File "${file.name}" uploaded (${formattedSize})`);
    } catch (error) {
      try {
        await reportClientError(error, {
          tag: "product_create_handle_file_error",
        });
      } catch {
      }
      setProductFile((prev) =>
        prev
          ? {
              ...prev,
              uploading: false,
              progress: 0,
              error: error?.message || "Upload failed",
            }
          : prev
      );
      toast.error(error?.message || "Failed to upload file");
    } finally {
      setUploadingFile(false);
      if (inputEl) inputEl.value = "";
    }
  };

  const retryFileUpload = async () => {
    const file = productFile?.file;
    if (!file) {
      toast.error("Please re-upload the file");
      return;
    }
    setUploadingFile(true);
    setProductFile((prev) =>
      prev
        ? {
            ...prev,
            uploading: true,
            progress: 0,
            error: "",
            uploadedUrl: null,
            uploadedKey: null,
          }
        : prev
    );
    try {
      const uploaded = await uploadDirect(file, "productFile", (pct) => {
        setProductFile((prev) =>
          prev
            ? {
                ...prev,
                progress: pct,
              }
            : prev
        );
      });
      setProductFile((prev) =>
        prev
          ? {
              ...prev,
              file: null,
              uploadedUrl: uploaded.publicUrl,
              uploadedKey: uploaded.key,
              uploading: false,
              progress: 100,
              error: "",
            }
          : prev
      );
      toast.success("File uploaded");
    } catch (err) {
      setProductFile((prev) =>
        prev
          ? {
              ...prev,
              uploading: false,
              progress: 0,
              error: err?.message || "Upload failed",
            }
          : prev
      );
      toast.error(err?.message || "Failed to upload file");
    } finally {
      setUploadingFile(false);
    }
  };

  // Remove product file
  const removeFile = async () => {
    const key = productFile?.uploadedKey;
    try {
      if (key) await deleteDirect(key);
    } catch (err) {
      toast.error(err?.message || "Unable to delete file");
      return;
    }
    setProductFile(null);
    setFileSize("");
    setFileType("");
    const fileInput = document.getElementById("productFile");
    if (fileInput) fileInput.value = "";
  };

  const hasPendingUploads =
    uploadingImage ||
    uploadingFile ||
    (Array.isArray(images) && images.some((img) => img?.uploading)) ||
    productFile?.uploading;

  const hasUploadErrors =
    (Array.isArray(images) && images.some((img) => img?.error)) ||
    Boolean(productFile?.error);

  useEffect(() => {
    if (!submitQueued) return;
    if (hasPendingUploads) return;
    if (hasUploadErrors) {
      setSubmitQueued(false);
      toast.error("Some uploads failed. Please retry.");
      return;
    }
    setSubmitQueued(false);
    try {
      formRef.current?.requestSubmit?.();
    } catch {
    }
  }, [submitQueued, hasPendingUploads, hasUploadErrors]);

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl" data-testid="product-create-page">
      {isLoadingDraft ? (
        <div className="flex items-center gap-2 text-muted-foreground mb-4" data-testid="product-create-loading">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading draft...
        </div>
      ) : null}
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/" data-testid="product-create-back">
            <span className="inline-flex items-center">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
            </span>
          </Link>
        </Button>
      </div>
      <Card data-testid="product-create-card">
        <CardHeader data-testid="product-create-header">
          <CardTitle className="text-2xl font-bold">
            Create New Product
          </CardTitle>
          <CardDescription>
            Fill out the form below to list your product on the marketplace.
          </CardDescription>
        </CardHeader>

        <form
          ref={formRef}
          action={async (formData) => {
            formData.delete("images");
            formData.delete("productFile");
            if (hasUploadErrors) {
              toast.error("Some uploads failed. Please retry.");
              return;
            }
            if (hasPendingUploads) {
              setSubmitQueued(true);
              toast("Uploads in progress. We'll create your product automatically when done.");
              return;
            }
            if (!productFile?.uploadedUrl) {
              toast.error("Product file is required");
              return;
            }
            if (!Array.isArray(images) || images.length === 0) {
              toast.error("At least one image is required");
              return;
            }
            if (images.some((img) => !img?.uploadedUrl)) {
              toast.error("Some images did not finish uploading. Please re-upload.");
              return;
            }
            formData.append(
              "imageUrls",
              JSON.stringify(images.map((img) => img.uploadedUrl))
            );
            formData.append("productFileUrl", productFile.uploadedUrl);
            formAction(formData);
          }}
          data-testid="product-create-form"
        >
          <CardContent className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Basic Information</h3>

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">
                  Title <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="title"
                  name="title"
                  placeholder="Enter product title"
                  required
                  className={`w-full border border-gray-200 rounded-md p-2 form-input focus:outline-none focus:ring-2 ${
                    Object.keys(state?.errors).length !== 0 &&
                    state?.errors?.title?.length
                      ? "border-red-500 focus:ring-red-500"
                      : "focus:ring-tertiary"
                  }`}
                  disabled={isPending}
                  data-testid="product-create-title"
                  onChange={(e) => {
                    // keep existing uncontrolled behavior
                    queueDraftSave();
                  }}
                />
                <span className="text-xs text-red-500">
                  {Object.keys(state?.errors).length !== 0 &&
                  state?.errors?.title?.length
                    ? state?.errors?.title[0]
                    : null}
                </span>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description-editor">
                  Description <span className="text-red-500">*</span>
                </Label>
                <RichTextEditor
                  value={description}
                  onChange={setDescription}
                  placeholder="Enter detailed product description"
                  disabled={isPending}
                  dataTestId="product-create-description"
                  error={
                    Object.keys(state?.errors).length !== 0 &&
                    state?.errors?.description?.length
                  }
                />
                <input type="hidden" name="description" value={description} required />
                <span className="text-xs text-red-500">
                  {Object.keys(state?.errors).length !== 0 &&
                  state?.errors?.description?.length
                    ? state?.errors?.description[0]
                    : null}
                </span>
              </div>

              {/* What's Included */}
              <div className="space-y-2">
                <Label htmlFor="whatIncluded">What&apos;s Included</Label>
                <WhatIncludedEditor
                  value={whatIncluded}
                  onChange={setWhatIncluded}
                  error={
                    Object.keys(state?.errors).length !== 0 &&
                    state?.errors?.what_included?.length
                  }
                  disabled={isPending}
                  dataTestId="product-create-what-included"
                />
                {/* Hidden input for form submission */}
                <input
                  type="hidden"
                  name="what_included"
                  value={whatIncluded}
                />
              </div>

              {/* Category and Subcategory */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Category */}
                <div className="space-y-2">
                  <Label htmlFor="category">
                    Category <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    defaultValue={
                      categoriesData?.length && categoriesData?.[0]?.id
                    }
                    onValueChange={(value) => {
                      setCategoryID(value);
                    }}
                    name="marketplace_category_id"
                    required
                    disabled={isPending}
                  >
                    <SelectTrigger data-testid="product-create-category">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categoriesData?.length
                        ? categoriesData?.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))
                        : null}
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-red-500">
                    {Object.keys(state?.errors).length !== 0 &&
                    state?.errors?.marketplace_category_id?.length
                      ? state?.errors?.marketplace_category_id[0]
                      : null}
                  </span>
                </div>

                {/* Subcategory */}
                <div className="space-y-2">
                  <Label htmlFor="subcategory">
                    Subcategory <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    defaultValue={
                      subCategories?.length && subCategories?.[0]?.id
                    }
                    name="marketplace_subcategory_id"
                    required
                    disabled={isPending || !categoryID}
                  >
                    <SelectTrigger data-testid="product-create-subcategory">
                      <SelectValue placeholder="Select a subcategory" />
                    </SelectTrigger>
                    <SelectContent>
                      {subCategories?.length
                        ? subCategories?.map((subcategory) => (
                            <SelectItem
                              key={subcategory.id}
                              value={subcategory.id}
                            >
                              {subcategory.name}
                            </SelectItem>
                          ))
                        : null}
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-red-500">
                    {Object.keys(state?.errors).length !== 0 &&
                    state?.errors?.marketplace_subcategory_id?.length
                      ? state?.errors?.marketplace_subcategory_id[0]
                      : null}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="product_status">
                    Product Status <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={productStatus}
                    onValueChange={setProductStatus}
                    disabled={isPending}
                  >
                    <SelectTrigger id="product_status" data-testid="product-create-status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                  <input type="hidden" name="product_status" value={productStatus} />
                  <span className="text-xs text-red-500">
                    {Object.keys(state?.errors).length !== 0 &&
                    state?.errors?.product_status?.length
                      ? state?.errors?.product_status[0]
                      : null}
                  </span>
                </div>

                <input type="hidden" name="sale_end_date" value={saleEndDate} />

                <div className="flex items-center justify-between rounded-md border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/60 px-3 py-2">
                  <div className="flex items-center gap-3">
                    <Label htmlFor="hasDiscount">Discount / Sale</Label>
                    <Switch
                      id="hasDiscount"
                      checked={hasDiscount}
                      onCheckedChange={(checked) => {
                        setHasDiscount(checked);
                        setPriceError("");
                        if (!checked) {
                          setSaleEndDate("");
                          setPrice(originalPrice);
                        } else if (price === originalPrice) {
                          setPrice("");
                        }
                      }}
                      disabled={isPending}
                      data-testid="product-create-discount-toggle"
                    />
                  </div>
                  <div className="text-xs text-muted-foreground dark:text-slate-400">
                    {hasDiscount
                      ? "Enter a sale price lower than the original price."
                      : "Off: Sale price equals original price."}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="originalPrice">
                      Original Price ($) <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="originalPrice"
                      name="originalPrice"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="29.99"
                      value={originalPrice}
                      onChange={handleOriginalPriceChange}
                      required
                      className={`w-full border border-gray-200 dark:border-slate-700 rounded-md p-2 form-input bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-tertiary dark:focus:ring-slate-500 ${
                        (Object.keys(state?.errors).length !== 0 &&
                          state?.errors?.originalPrice?.length) ||
                        priceError
                          ? "border-red-500 dark:border-red-500 focus:ring-red-500 dark:focus:ring-red-500"
                          : ""
                      }`}
                      disabled={isPending}
                      data-testid="product-create-original-price"
                    />
                    <span className="text-xs text-red-500">
                      {Object.keys(state?.errors).length !== 0 &&
                      state?.errors?.originalPrice?.length
                        ? state?.errors?.originalPrice[0]
                        : priceError || null}
                    </span>
                    {hasDiscount && originalPrice && price && !priceError && (
                      <p className="text-xs text-green-600">
                        Discount:{" "}
                        {(
                          ((parseFloat(originalPrice) - parseFloat(price)) /
                            parseFloat(originalPrice)) *
                          100
                        ).toFixed(0)}
                        % off
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    {hasDiscount && (
                      <>
                        <Label htmlFor="price">
                          Sale Price ($) <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="price"
                          name="price"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="19.99"
                          value={price}
                          onChange={handlePriceChange}
                          required={hasDiscount}
                          className={`w-full border border-gray-200 rounded-md p-2 form-input focus:outline-none focus:ring-2 ${
                            (Object.keys(state?.errors).length !== 0 &&
                              state?.errors?.price?.length) ||
                            priceError
                              ? "border-red-500 focus:ring-red-500"
                              : "focus:ring-tertiary"
                          }`}
                          disabled={isPending}
                          data-testid="product-create-sale-price"
                        />
                        <span className="text-xs text-red-500">
                          {Object.keys(state?.errors).length !== 0 &&
                          state?.errors?.price?.length
                            ? state?.errors?.price[0]
                            : priceError || null}
                        </span>

                        <div className="space-y-2">
                          <Label htmlFor="sale_end_date">Sale End Date</Label>
                          <Input
                            id="sale_end_date"
                            type="date"
                            value={saleEndDate}
                            onChange={(e) => setSaleEndDate(e.target.value)}
                            className={`w-full border border-gray-200 rounded-md p-2 form-input focus:outline-none focus:ring-2 ${
                              Object.keys(state?.errors).length !== 0 &&
                              state?.errors?.sale_end_date?.length
                                ? "border-red-500 focus:ring-red-500"
                                : "focus:ring-tertiary"
                            }`}
                            disabled={isPending}
                            data-testid="product-create-sale-end"
                          />
                          <span className="text-xs text-red-500">
                            {Object.keys(state?.errors).length !== 0 &&
                            state?.errors?.sale_end_date?.length
                              ? state?.errors?.sale_end_date[0]
                              : null}
                          </span>
                        </div>
                      </>
                    )}

                    {!hasDiscount && (
                      <input type="hidden" name="price" value={originalPrice} />
                    )}

                    <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
                      <p className="text-xs font-medium text-emerald-700">
                        Estimated merchant earnings
                      </p>
                      <p className="text-sm text-emerald-800">
                        {netRevenue
                          ? `${netRevenue} after 20% platform fee`
                          : "Enter a price to see your earnings after fees."}
                      </p>
                      <p className="mt-1 text-xs text-emerald-700">
                        The platform fee covers payment processing, creator
                        support, and ongoing marketplace maintenance.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Stock */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="stock">In Stock Quantity</Label>
                  <Input
                    id="stock"
                    name="stock"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Enter available stock"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    className="w-full border border-gray-200 rounded-md p-2 form-input focus:outline-none focus:ring-2 focus:ring-tertiary"
                    disabled={isPending}
                    data-testid="product-create-stock"
                  />
                  <span className="text-xs text-red-500">
                    {Object.keys(state?.errors).length !== 0 && state?.errors?.stock?.length
                      ? state?.errors?.stock[0]
                      : null}
                  </span>
                </div>
              </div>

              {/* Images */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="images">
                    Images <span className="text-red-500">*</span>
                  </Label>
                  <div className="flex flex-wrap gap-3">
                  {images.map((imageObj, index) => (
                    <div
                      key={index}
                      className="relative h-24 w-24 rounded-md overflow-hidden border"
                    >
                      <Image
                        src={imageObj.previewUrl}
                        alt={`Product image ${index + 1}`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 50vw"
                        priority
                      />
                      {imageObj?.uploadedUrl && !imageObj?.uploading && !imageObj?.error ? (
                        <div className="absolute left-1 top-1 rounded bg-green-600 px-1 py-0.5 text-[10px] text-white">
                          Uploaded
                        </div>
                      ) : null}
                      {imageObj?.uploading ? (
                        <div className="absolute inset-x-0 bottom-0 bg-black/60 p-1 text-white">
                          <div className="h-1 w-full rounded bg-white/30">
                            <div
                              className="h-1 rounded bg-white"
                              style={{ width: `${imageObj?.progress || 0}%` }}
                            />
                          </div>
                          <div className="mt-0.5 text-center text-[10px]">
                            {imageObj?.progress || 0}%
                          </div>
                        </div>
                      ) : null}
                      {imageObj?.error && !imageObj?.uploading ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-red-600/70 p-1 text-white">
                          <div className="text-[10px]">Upload failed</div>
                          <button
                            type="button"
                            onClick={() => retryImageUpload(index)}
                            className="text-[10px] underline"
                            data-testid={`product-create-image-retry-${index}`}
                          >
                            Retry
                          </button>
                        </div>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
                        data-testid={`product-create-image-remove-${index}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                      {index === 0 && (
                        <div className="absolute bottom-0 left-0 right-0 bg-purple-500 text-white text-[10px] text-center py-0.5">
                          Featured
                        </div>
                      )}
                    </div>
                  ))}

                  <label
                    htmlFor="images"
                    className="h-24 w-24 border-2 border-dashed rounded-md flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50"
                    data-testid="product-create-images-trigger"
                  >
                    {uploadingImage ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      <>
                        <ImageIcon className="h-6 w-6 mb-1" />
                        <span className="text-xs">Add Image(s)</span>
                      </>
                    )}
                    <input
                      id="images"
                      name="images"
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleImageUpload}
                      disabled={uploadingImage || isPending}
                      data-testid="product-create-images"
                    />
                  </label>
                </div>
                <span className="text-xs text-red-500">
                  {Object.keys(state?.errors).length !== 0 &&
                  state?.errors?.images?.length
                    ? state?.errors?.images[0]
                    : null}
                </span>
              </div>
            </div>

            {/* Product File Upload */}
            <div className="space-y-2">
              <Label htmlFor="productFile">
                Product File <span className="text-red-500">*</span>
              </Label>
              <div className="space-y-3">
                {/* File Upload Area */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                  {productFile ? (
                    <div className="flex items-center justify-between bg-blue-50 p-4 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="bg-blue-100 p-2 rounded">
                          <Upload className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {productFile.name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {fileSize} • {productFile.type || "Unknown type"}
                          </p>
                          {productFile?.uploading ? (
                            <div className="mt-2">
                              <div className="h-1.5 w-56 rounded bg-blue-200">
                                <div
                                  className="h-1.5 rounded bg-blue-600"
                                  style={{ width: `${productFile?.progress || 0}%` }}
                                />
                              </div>
                              <div className="mt-1 text-xs text-gray-600">
                                Uploading... {productFile?.progress || 0}%
                              </div>
                            </div>
                          ) : null}
                          {productFile?.error ? (
                            <div className="mt-2 text-xs text-red-600">
                              {productFile.error}{" "}
                              <button
                                type="button"
                                onClick={retryFileUpload}
                                className="underline"
                                disabled={uploadingFile || isPending}
                                data-testid="product-create-file-retry"
                              >
                                Retry
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={removeFile}
                        className="text-red-500 hover:text-red-700 p-1"
                        disabled={uploadingFile || isPending}
                        data-testid="product-create-file-remove"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  ) : (
                    <label
                      htmlFor="productFile"
                      className="flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 rounded-lg p-4"
                      data-testid="product-create-file-trigger"
                    >
                      {uploadingFile ? (
                        <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-2" />
                      ) : (
                        <Upload className="h-8 w-8 text-gray-400 mb-2" />
                      )}
                      <p className="text-sm font-medium text-gray-900 mb-1">
                        {uploadingFile
                          ? "Processing file..."
                          : "Upload your product file"}
                      </p>
                      <p className="text-xs text-gray-500 text-center">
                        PDF, PSD, AI, Figma, ZIP, DOC, XLS, PPT files up to 25MB
                      </p>
                      <input
                        id="productFile"
                        name="productFile"
                        type="file"
                        accept=".pdf,.psd,.ai,.fig,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                        className="hidden"
                        onChange={handleFileUpload}
                        disabled={uploadingFile || isPending}
                        data-testid="product-create-file"
                      />
                    </label>
                  )}
                </div>

                {/* File Requirements */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <h4 className="text-sm font-medium text-yellow-800 mb-1">
                    File Requirements:
                  </h4>
                  <ul className="text-xs text-yellow-700 space-y-1">
                    <li>• Maximum file size: 25MB</li>
                    <li>
                      • Supported formats: PDF, PSD, AI, Figma, ZIP, DOC, XLS,
                      PPT
                    </li>
                    <li>
                      • File will be available for download after purchase
                    </li>
                  </ul>
                </div>
              </div>
              <span className="text-xs text-red-500">
                {Object.keys(state?.errors).length !== 0 &&
                state?.errors?.productFile?.length
                  ? state?.errors?.productFile[0]
                  : null}
              </span>
            </div>

            {/* Additional Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Additional Details</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* File Type */}
                <div className="space-y-2">
                  <Label htmlFor="fileType" className="text-gray-900 dark:text-slate-100">
                    File Type <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="fileType"
                    name="fileType"
                    value={fileType}
                    placeholder="Auto-detected from uploaded file"
                    readOnly
                    className="border border-gray-200 dark:border-slate-700 rounded-md p-2 form-input bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-tertiary dark:focus:ring-slate-500"
                    data-testid="product-create-file-type"
                  />
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    File type is automatically detected from the uploaded file
                  </p>
                  <span className="text-xs text-red-500">
                    {Object.keys(state?.errors).length !== 0 &&
                    state?.errors?.fileType?.length
                      ? state?.errors?.fileType[0]
                      : null}
                  </span>
                </div>

                {/* File Size */}
                <div className="space-y-2">
                  <Label htmlFor="fileSize">File Size</Label>
                  <Input
                    id="fileSize"
                    name="fileSize"
                    value={fileSize}
                    placeholder="Auto-calculated from uploaded file"
                    readOnly
                    className="border border-gray-200 dark:border-slate-700 rounded-md p-2 form-input bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-tertiary dark:focus:ring-slate-500"
                    data-testid="product-create-file-size"
                  />
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    File size is automatically calculated when you upload a file
                  </p>
                </div>
              </div>

              <p className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg p-2">
                💡 <strong>Auto-Detection:</strong> File type and size are
                automatically detected when you upload a file and cannot be
                changed to ensure data integrity.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* License */}
                <div className="space-y-2">
                  <Label htmlFor="license">License</Label>
                  <Select name="license" disabled={isPending}>
                    <SelectTrigger data-testid="product-create-license">
                    <SelectValue placeholder="Select license type" />
                  </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Standard">Standard License</SelectItem>
                      <SelectItem value="Extended">Extended License</SelectItem>
                      <SelectItem value="Commercial">
                        Commercial License
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Delivery Time */}
                <div className="space-y-2">
                  <Label htmlFor="deliveryTime">Delivery Time</Label>
                  <Select name="deliveryTime" disabled={isPending}>
                    <SelectTrigger data-testid="product-create-delivery">
                    <SelectValue placeholder="Select delivery time" />
                  </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Instant">Instant Delivery</SelectItem>
                      <SelectItem value="1 day">Within 1 day</SelectItem>
                      <SelectItem value="2-3 days">2-3 days</SelectItem>
                      <SelectItem value="1 week">Up to 1 week</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex justify-between">
            <Button
              variant="outline"
              type="button"
              onClick={() => router.back()}
              data-testid="product-create-cancel"
            >
              Cancel
            </Button>
            <div className="flex flex-col items-end gap-1">
              <Button
                type="submit"
                disabled={isPending}
                className="bg-black text-white disabled:cursor-not-allowed cursor-pointer border border-black hover:bg-white hover:text-black"
                data-testid="product-create-submit"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : submitQueued ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  "Create Product"
                )}
              </Button>
              {submitQueued || hasPendingUploads ? (
                <div className="text-xs text-gray-600">
                  Uploads in progress, will submit automatically.
                </div>
              ) : null}
              {uploadCheckPending ? (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Checking upload availability...
                </div>
              ) : null}
              {uploadReady === false ? (
                <div className="text-xs text-amber-600">
                  Uploads unavailable. Retrying automatically...
                </div>
              ) : null}
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
