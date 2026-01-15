"use client";
import React, {
  useState,
  useEffect,
  useRef,
  useActionState,
  useMemo,
  useCallback
} from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { EditProduct } from "./action";
import {
  Loader2,
  Upload,
  PlusCircle,
  X,
  Image as ImageIcon,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { reportClientError } from "../../../../lib/observability/reportClientError";
import Image from "next/image";
import Link from "next/link";

// UI Components
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { Switch } from "../../../../components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../../../components/ui/card";
import { Checkbox } from "../../../../components/ui/checkbox";
import { useProductContext } from "./context";
import WhatIncludedEditor from "./what-included-editor";
import RichTextEditor from "../../components/rich-text-editor";

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

export default function EditProductContent(props) {
  const { product } = props;
  const { categoriesData } = useProductContext();
  const { data: session, status } = useSession();
  const [subCategories, setSubCategories] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [images, setImages] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [productFile, setProductFile] = useState(null);
  const [existingProductFile, setExistingProductFile] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadReady, setUploadReady] = useState(null); // null = unknown, true/false
  const [uploadCheckPending, setUploadCheckPending] = useState(false);
  const [uploadRetryCount, setUploadRetryCount] = useState(0);
  const [submitQueued, setSubmitQueued] = useState(false);
  const [fileSize, setFileSize] = useState("");
  const [fileType, setFileType] = useState("");
  const [categoryID, setCategoryID] = useState("");
  const [subcategoryID, setSubcategoryID] = useState("");
  const [price, setPrice] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const [saleEndDate, setSaleEndDate] = useState("");
  const [productStatus, setProductStatus] = useState("draft");
  const [stock, setStock] = useState("");
  const [whatIncluded, setWhatIncluded] = useState("");
  const [description, setDescription] = useState(product?.description || "");
  const [priceError, setPriceError] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [license, setLicense] = useState("");
  const [title, setTitle] = useState("");
  const [pricesInitialized, setPricesInitialized] = useState(false);
  const [hasDiscount, setHasDiscount] = useState(false);
  const [clientErrors, setClientErrors] = useState({
    productFile: "",
  });

  const [state, formAction, isPending] = useActionState(
    EditProduct,
    initialStateValues
  );
  const formRef = useRef(null);
  const uploadRetryTimeoutRef = useRef(null);
  const uploadCheckCooldownRef = useRef(0);
  const router = useRouter();

  const hasFieldErrors = useMemo(() => {
    if (!state?.errors) return false;
    const { credentials, unknown, ...rest } = state.errors;
    return Object.values(rest).some((val) =>
      Array.isArray(val) ? val.length > 0 : !!val
    );
  }, [state?.errors]);

  useEffect(() => {
    if (product) {
      setPrice(product?.price || "");
      setOriginalPrice(product?.originalPrice || "");
      setStock(
        typeof product?.stock === "number" || typeof product?.stock === "string"
          ? String(product?.stock)
          : ""
      );
      setWhatIncluded(product?.what_included || "");
      setDeliveryTime(product?.deliveryTime || "");
      setFileType(product?.fileType || "");
      setFileSize(product?.fileSize || "");
      setTitle(product?.title || "");
      setDescription(product?.description || "");
      setLicense(product?.license || "");

      setProductStatus(product?.product_status || "draft");
      if (product?.sale_end_date) {
        const d = new Date(product.sale_end_date);
        if (!Number.isNaN(d.getTime())) {
          setSaleEndDate(d.toISOString().slice(0, 10));
        } else {
          setSaleEndDate("");
        }
      } else {
        setSaleEndDate("");
      }

      if (categoriesData?.length) {
        setCategoryID(product?.marketplace_category_id || "");
      }

      if (subCategories?.length) {
        setSubcategoryID(product?.marketplace_subcategory_id || "");
      }

      // Handle existing product file (URL)
      if (product?.file) {
        setExistingProductFile(product.file);
      }

      // Handle existing images (URLs)
      const productImages = [];
      if (product?.image) {
        productImages.push(product.image);
      }
      if (product?.images) {
        try {
          const parsedImages = JSON.parse(product.images);
          if (Array.isArray(parsedImages)) {
            productImages.push(...parsedImages);
          }
        } catch (e) {
          console.warn("Failed to parse existing images:", e);
        }
      }
      setExistingImages(productImages);

      // Reset new file uploads
      setImages([]);
      setProductFile(null);
    }
  }, [product, categoriesData, subCategories]);

  // Initialize discount state based on existing values
  useEffect(() => {
    if (originalPrice && price) {
      const op = parseFloat(originalPrice);
      const sp = parseFloat(price);
      if (Number.isFinite(op) && Number.isFinite(sp)) {
        setHasDiscount(sp < op);
      }
    }
  }, [originalPrice, price]);

  useEffect(() => {
    if (
      state?.message &&
      Object.keys(state?.errors || {}).length > 0 &&
      Object.keys(state?.errors?.credentials || {}).length > 0
    ) {
      toast.error(state?.message);
    }

    if (state?.message && Object.keys(state?.data || {}).length > 0) {
      toast.success(state?.message);
      console.log("state.data", state?.data);
      const destinationId = state?.data?.product_id || state?.data?.id;
      if (destinationId) {
        router.push(`/product/${destinationId}`);
      }
    }
  }, [state?.message, state?.errors, state?.data, router]);

  useEffect(() => {
    if (state?.success) {
      setClientErrors({
        productFile: "",
      });
    }
  }, [state?.success]);

  console.log("categories", categoriesData);

  useEffect(() => {
    if (categoriesData?.length && categoryID) {
      const selectedCategory = categoriesData?.find(
        (category) => category.id === categoryID
      );
      const subcategories = selectedCategory?.MarketplaceSubCategories || [];
      setSubCategories(subcategories);

      // If subcategory ID is set but not in the new subcategories, reset it
      if (
        subcategoryID &&
        !subcategories.find((sub) => sub.id === subcategoryID)
      ) {
        setSubcategoryID("");
      }
    } else {
      setSubCategories([]);
      setSubcategoryID("");
    }
  }, [categoriesData, categoryID, subcategoryID]);

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

  // Validate price relationship
  const validatePrices = (currentPrice, currentOriginalPrice) => {
    if (hasDiscount && currentOriginalPrice && currentPrice) {
      const priceNum = parseFloat(currentPrice);
      const originalPriceNum = parseFloat(currentOriginalPrice);

      if (originalPriceNum < priceNum) {
        setPriceError(
          "Original price must be greater than or equal to sale price"
        );
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

  // Handle original price change
  const handleOriginalPriceChange = (e) => {
    const newOriginalPrice = e.target.value;
    setOriginalPrice(newOriginalPrice);
    if (!hasDiscount) {
      setPrice(newOriginalPrice);
    }
    validatePrices(price, newOriginalPrice);
  };

  // Mark prices initialized once both are set (prevents further auto-sync)
  useEffect(() => {
    if (price && originalPrice && !pricesInitialized) {
      setPricesInitialized(true);
    }
  }, [price, originalPrice, pricesInitialized]);

  // Handle multiple image uploads
  const handleImageUpload = async (e) => {
    const inputEl = e.target;
    const files = inputEl.files;
    if (!files || files.length === 0) return;

    const ready = uploadReady === true || (await runUploadPrecheck());
    if (!ready) {
      if (inputEl) inputEl.value = "";
      return;
    }

    setUploadingImage(true);

    try {
      const maxTotalSize = 3 * 1024 * 1024;
      const maxCombinedSize = 3 * 1024 * 1024;
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
          tag: "product_edit_handle_images_error",
        });
      } catch {
      }
      toast.error("Failed to process images");
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

  // Remove a new uploaded image
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

  // Remove an existing image
  const removeExistingImage = (index) => {
    setExistingImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle single product file upload
  const handleFileUpload = async (e) => {
    const inputEl = e.target;
    const files = inputEl.files;
    if (!files || files.length === 0) return;

    const ready = uploadReady === true || (await runUploadPrecheck());
    if (!ready) {
      if (inputEl) inputEl.value = "";
      return;
    }

    const file = files[0]; // Only take the first file (single file upload)
    // Pre-flight size check before we toggle UI states
    const maxSize = 25 * 1024 * 1024; // 25MB
    if (file && typeof file.size === "number" && file.size > maxSize) {
      toast.error("Product file size must be 25MB or less");
      if (inputEl) inputEl.value = "";
      return;
    }

    setUploadingFile(true);

    try {
      // Validate file type
      const allowedExtensions = [
        "pdf",
        "psd",
        "ai",
        "fig",
        "figma",
        "zip",
        "doc",
        "docx",
        "xls",
        "xlsx",
        "ppt",
        "pptx",
      ];
      const fileExtension = file.name.split(".").pop().toLowerCase();
      if (!allowedExtensions.includes(fileExtension)) {
        toast.error(
          `File type .${fileExtension} is not supported. Allowed types: PDF, PSD, AI, Figma, ZIP, DOC, XLS, PPT`
        );
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
          tag: "product_edit_handle_file_error",
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

  // Remove new product file
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

  // Remove existing product file
  const removeExistingFile = () => {
    setExistingProductFile(null);
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
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/">
            <span className="inline-flex items-center">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </span>
          </Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Edit Product</CardTitle>
          <CardDescription>
            Update your product information below.
          </CardDescription>
        </CardHeader>

        <form
          ref={formRef}
          action={async (formData) => {
            formData.delete("images");
            formData.delete("productFile");
            const ready = uploadReady === true || (await runUploadPrecheck());
            if (!ready) return;
            if (hasUploadErrors) {
              toast.error("Some uploads failed. Please retry.");
              return;
            }
            if (hasPendingUploads) {
              setSubmitQueued(true);
              toast("Uploads in progress. We'll save your changes automatically when done.");
              return;
            }
            const missingProductFile = !productFile && !existingProductFile;
            if (missingProductFile) {
              setClientErrors((prev) => ({
                ...prev,
                productFile: "Product file is required",
              }));
              toast.error("Product file is required");
              return;
            } else {
              setClientErrors((prev) => ({
                ...prev,
                productFile: "",
              }));
            }
            const hasAnyImages =
              (Array.isArray(existingImages) && existingImages.length > 0) ||
              (Array.isArray(images) && images.length > 0);
            if (!hasAnyImages) {
              toast.error("At least one image is required");
              return;
            }
            if (images.some((img) => !img?.uploadedUrl)) {
              toast.error("Some images did not finish uploading. Please re-upload.");
              return;
            }
            // Add product ID for editing
            formData.append("productId", product.id);

            if (productFile?.uploadedUrl) {
              formData.append("productFileUrl", productFile.uploadedUrl);
            }

            if (existingProductFile && !productFile?.uploadedUrl) {
              formData.append("existingProductFile", existingProductFile);
            }

            if (images.length > 0) {
              formData.append(
                "imageUrls",
                JSON.stringify(images.map((img) => img.uploadedUrl))
              );
            }

            // Add existing images as JSON
            if (existingImages.length > 0) {
              formData.append("existingImages", JSON.stringify(existingImages));
            }

            // Call the original form action
            formAction(formData);
          }}
        >
          <CardContent className="space-y-6">
            {state?.message && hasFieldErrors && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {state.message}
              </div>
            )}
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
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <span className="text-xs text-red-500">
                  {Object.keys(state?.errors).length !== 0 &&
                  state?.errors?.title?.length
                    ? state?.errors?.title[0]
                    : null}
                </span>
                <input type="hidden" value={title} name="title" />
              </div>
              {/* Stock */}
              <div className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label htmlFor="stock">In Stock Quantity</Label>
                  <Input
                    id="stock"
                    name="stock"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    className="w-full border border-gray-200 rounded-md p-2 form-input focus:outline-none focus:ring-2 focus:ring-tertiary"
                    disabled={isPending}
                  />
                  <span className="text-xs text-red-500">
                    {Object.keys(state?.errors).length !== 0 &&
                    state?.errors?.stock?.length
                      ? state?.errors?.stock[0]
                      : null}
                  </span>
                </div>
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
                  error={
                    Object.keys(state?.errors).length !== 0 &&
                    state?.errors?.description?.length
                  }
                />
                <span className="text-xs text-red-500">
                  {Object.keys(state?.errors).length !== 0 &&
                  state?.errors?.description?.length
                    ? state?.errors?.description[0]
                    : null}
                </span>
                <input
                  type="hidden"
                  name="description"
                  value={description}
                  required
                />
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
                    value={categoryID}
                    onValueChange={(value) => {
                      setCategoryID(value);
                      // Reset subcategory when category changes
                      setSubcategoryID("");
                    }}
                    name="marketplace_category_id"
                    required
                    disabled={isPending}
                  >
                    <SelectTrigger>
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
                  <input
                    type="hidden"
                    value={categoryID}
                    name="marketplace_category_id"
                  />
                </div>

                {/* Subcategory */}
                <div className="space-y-2">
                  <Label htmlFor="subcategory">
                    Subcategory <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={subcategoryID}
                    onValueChange={(value) => {
                      setSubcategoryID(value);
                    }}
                    name="marketplace_subcategory_id"
                    required
                    disabled={isPending || !categoryID}
                  >
                    <SelectTrigger>
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
                  <input
                    type="hidden"
                    value={subcategoryID}
                    name="marketplace_subcategory_id"
                  />
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
                    <SelectTrigger id="product_status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                  <input
                    type="hidden"
                    name="product_status"
                    value={productStatus}
                  />
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

            {/* Images */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Product Images</h3>

              {/* Existing Images */}
              {existingImages.length > 0 && (
                <div className="space-y-2">
                  <Label>Current Images</Label>
                  <div className="flex flex-wrap gap-3">
                    {existingImages.map((imageUrl, index) => (
                      <div
                        key={`existing-${index}`}
                        className="relative h-24 w-24 rounded-md overflow-hidden border"
                      >
                        <Image
                          src={imageUrl}
                          alt={`Existing product image ${index + 1}`}
                          fill
                          className="object-cover"
                          sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 33vw"
                          priority
                        />
                        <button
                          type="button"
                          onClick={() => removeExistingImage(index)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
                          disabled={isPending}
                        >
                          <X className="h-3 w-3" />
                        </button>
                        {index === 0 &&
                          existingImages.length === 1 &&
                          images.length === 0 && (
                            <div className="absolute bottom-0 left-0 right-0 bg-purple-500 text-white text-[10px] text-center py-0.5">
                              Featured
                            </div>
                          )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New Image Upload */}
              <div className="space-y-2">
                <Label htmlFor="images">
                  {existingImages.length > 0 ? "Add New Images" : "Images"}{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <div className="flex flex-wrap gap-3">
                  {images.map((imageObj, index) => (
                    <div
                      key={`new-${index}`}
                      className="relative h-24 w-24 rounded-md overflow-hidden border"
                    >
                      <Image
                        src={imageObj.previewUrl}
                        alt={`New product image ${index + 1}`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 33vw"
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
                          >
                            Retry
                          </button>
                        </div>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
                        disabled={imageObj?.uploading || isPending}
                      >
                        <X className="h-3 w-3" />
                      </button>
                      {index === 0 && existingImages.length === 0 && (
                        <div className="absolute bottom-0 left-0 right-0 bg-purple-500 text-white text-[10px] text-center py-0.5">
                          Featured
                        </div>
                      )}
                    </div>
                  ))}

                  <label
                    htmlFor="images"
                    className="h-24 w-24 border-2 border-dashed rounded-md flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50"
                  >
                    {uploadingImage ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      <>
                        <ImageIcon className="h-6 w-6 mb-1" />
                        <span className="text-xs">Add Multiple Images</span>
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
                    />
                  </label>
                </div>
                <span className="text-xs text-red-500">
                  {Object.keys(state?.errors).length !== 0 &&
                  state?.errors?.images?.length
                    ? state?.errors?.images[0]
                    : null}
                </span>
                {existingImages.length === 0 && images.length === 0 && (
                  <p className="text-xs text-gray-500">
                    At least one image is required. You can upload multiple
                    images. The first image will be used as the featured image.
                  </p>
                )}
                {(existingImages.length > 0 || images.length > 0) && (
                  <p className="text-xs text-gray-500">
                    You can upload multiple images. The first image will be used
                    as the featured image.
                  </p>
                )}
              </div>
            </div>

            {/* Product File Upload */}
            <div className="space-y-2">
              <Label htmlFor="productFile">
                Product File <span className="text-red-500">*</span>
              </Label>
              <div className="space-y-3">
                {/* Existing Product File */}
                {existingProductFile && (
                  <div className="space-y-2">
                    <Label>Current Product File</Label>
                    <div className="flex items-center justify-between bg-green-50 p-4 rounded-lg border">
                      <div className="flex items-center space-x-3">
                        <div className="bg-green-100 p-2 rounded">
                          <Upload className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {existingProductFile.split("/").pop() ||
                              "Product File"}
                          </p>
                          <p className="text-sm text-gray-500">
                            {fileSize || "Current file"} • {fileType || "File"}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={removeExistingFile}
                        className="text-red-500 hover:text-red-700 p-1"
                        disabled={isPending}
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* New File Upload Area */}
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
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  ) : (
                    <label
                      htmlFor="productFile"
                      className="flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 rounded-lg p-4"
                    >
                      {uploadingFile ? (
                        <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-2" />
                      ) : (
                        <Upload className="h-8 w-8 text-gray-400 mb-2" />
                      )}
                      <p className="text-sm font-medium text-gray-900 mb-1">
                        {uploadingFile
                          ? "Processing file..."
                          : existingProductFile
                            ? "Upload new product file (replaces current)"
                            : "Upload your product file"}
                      </p>
                      <p className="text-xs text-gray-500 text-center mb-1">
                        PDF, PSD, AI, Figma, ZIP, DOC, XLS, PPT files up to 25MB
                      </p>
                      <p className="text-xs text-gray-400 text-center">
                        Only one product file allowed
                      </p>
                      <input
                        id="productFile"
                        name="productFile"
                        type="file"
                        accept=".pdf,.psd,.ai,.fig,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                        className="hidden"
                        onChange={handleFileUpload}
                        disabled={uploadingFile || isPending}
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
                {clientErrors.productFile ||
                  (Object.keys(state?.errors).length !== 0 &&
                  state?.errors?.productFile?.length
                    ? state?.errors?.productFile[0]
                    : null)}
              </span>
            </div>

            {/* Additional Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Additional Details</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* File Type */}
                <div className="space-y-2">
                  <Label
                    htmlFor="fileType"
                    className="text-gray-900 dark:text-slate-100"
                  >
                    File Type <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="fileType"
                    name="fileType"
                    value={fileType}
                    placeholder="Auto-detected from uploaded file"
                    readOnly
                    className="border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-md"
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
                  <Label
                    htmlFor="fileSize"
                    className="text-gray-900 dark:text-slate-100"
                  >
                    File Size
                  </Label>
                  <Input
                    id="fileSize"
                    name="fileSize"
                    value={fileSize}
                    placeholder="Auto-calculated from uploaded file"
                    readOnly
                    className="border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-md"
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
                  <Select
                    name="license"
                    disabled={isPending}
                    value={license}
                    onValueChange={(value) => setLicense(value)}
                  >
                    <SelectTrigger>
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
                  <input type="hidden" value={license} name="license" />
                </div>

                {/* Delivery Time */}
                <div className="space-y-2">
                  <Label htmlFor="deliveryTime">Delivery Time</Label>
                  <Select
                    name="deliveryTime"
                    disabled={isPending}
                    value={deliveryTime}
                    onValueChange={(value) => setDeliveryTime(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select delivery time" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Instant">Instant Delivery</SelectItem>
                      <SelectItem value="1 day">Within 1 day</SelectItem>
                      <SelectItem value="2-3 days">2-3 days</SelectItem>
                      <SelectItem value="1 week">Up to 1 week</SelectItem>
                    </SelectContent>
                  </Select>
                  <input
                    type="hidden"
                    value={deliveryTime}
                    name="deliveryTime"
                  />
                </div>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex justify-between">
            <Button
              variant="outline"
              type="button"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <div className="flex flex-col items-end gap-1">
              <Button
                type="submit"
                disabled={isPending}
                className="bg-black text-white disabled:cursor-not-allowed cursor-pointer border border-black hover:bg-white hover:text-black"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : submitQueued ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  "Edit Product"
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
