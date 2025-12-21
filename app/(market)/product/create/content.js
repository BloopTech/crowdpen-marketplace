"use client";
import React, {
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
  X,
  Image as ImageIcon,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { useFormState } from "react-dom";
import Link from "next/link";

// UI Components
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
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

export default function CreateProductContent() {
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
  const [whatIncluded, setWhatIncluded] = useState("");
  const [priceError, setPriceError] = useState("");
  const [hasDiscount, setHasDiscount] = useState(false);
  const [pricesInitialized, setPricesInitialized] = useState(false);
  const [state, formAction, isPending] = useActionState(
    createProduct,
    initialStateValues
  );
  const formRef = useRef(null);
  const router = useRouter();

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
      router.push(`/product/${state.data.id}`);
    }
  }, [state?.message, state?.errors, state?.data, router]);

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
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingImage(true);

    try {
      const maxCombinedSize = 3 * 1024 * 1024; // 3MB total
      const incomingFiles = Array.from(files);

      const existingTotal = images.reduce(
        (acc, imageObj) => acc + (imageObj.file?.size || 0),
        0
      );
      const incomingTotal = incomingFiles.reduce(
        (acc, file) => acc + file.size,
        0
      );

      if (existingTotal + incomingTotal > maxCombinedSize) {
        toast.error("Total images size must not exceed 3MB.");
        return;
      }

      const validImages = incomingFiles.map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
      }));

      if (validImages.length) {
        setImages((prev) => [...prev, ...validImages]);
      }
    } catch (error) {
      console.error("Error handling image:", error);
      toast.error("Failed to process image");
    } finally {
      setUploadingImage(false);
    }
  };

  // Remove an image
  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle product file upload
  const handleFileUpload = async (e) => {
    const files = e.target.files;
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
      setProductFile(file);

      toast.success(`File "${file.name}" selected (${formattedSize})`);
    } catch (error) {
      console.error("Error handling file:", error);
      toast.error("Failed to process file");
    } finally {
      setUploadingFile(false);
    }
  };

  // Remove product file
  const removeFile = () => {
    setProductFile(null);
    setFileSize("");
    setFileType("");
    // Reset file input
    const fileInput = document.getElementById("productFile");
    if (fileInput) fileInput.value = "";
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/">
            <span className="inline-flex items-center">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
            </span>
          </Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">
            Create New Product
          </CardTitle>
          <CardDescription>
            Fill out the form below to list your product on the marketplace.
          </CardDescription>
        </CardHeader>

        <form
          ref={formRef}
          action={(formData) => {
            // Add product file to form data if it exists
            if (productFile) {
              formData.append("productFile", productFile);
            }
            // Add images to form data
            images.forEach((imageObj) => {
              if (imageObj.file) {
                formData.append("images", imageObj.file);
              }
            });
            // Call the original form action
            formAction(formData);
          }}
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
                <Label htmlFor="description">
                  Description <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Enter detailed product description"
                  required
                  rows={5}
                  className={`resize-none w-full border border-gray-200 rounded-md p-2 form-input focus:outline-none focus:ring-2 ${
                    Object.keys(state?.errors).length !== 0 &&
                    state?.errors?.description?.length
                      ? "border-red-500 focus:ring-red-500"
                      : "focus:ring-tertiary"
                  }`}
                  disabled={isPending}
                />
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
                    state?.errors?.whatIncluded?.length
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
                  <input type="hidden" name="product_status" value={productStatus} />
                  <span className="text-xs text-red-500">
                    {Object.keys(state?.errors).length !== 0 &&
                    state?.errors?.product_status?.length
                      ? state?.errors?.product_status[0]
                      : null}
                  </span>
                </div>

                <input type="hidden" name="sale_end_date" value={saleEndDate} />

                <div className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
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
                  <div className="text-xs text-muted-foreground">
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
                      className={`w-full border border-gray-200 rounded-md p-2 form-input focus:outline-none focus:ring-2 ${
                        (Object.keys(state?.errors).length !== 0 &&
                          state?.errors?.originalPrice?.length) ||
                        priceError
                          ? "border-red-500 focus:ring-red-500"
                          : "focus:ring-tertiary"
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
                    placeholder="0"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    className="w-full border border-gray-200 rounded-md p-2 form-input focus:outline-none focus:ring-2 focus:ring-tertiary"
                    disabled={isPending}
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
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
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
                  <Label htmlFor="fileType">
                    File Type <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="fileType"
                    name="fileType"
                    value={fileType}
                    placeholder="Auto-detected from uploaded file"
                    readOnly
                    className="border border-gray-200 rounded-md p-2 form-input focus:outline-none focus:ring-2 focus:ring-tertiary"
                  />
                  <p className="text-xs text-gray-500">
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
                    className="border border-gray-200 rounded-md p-2 form-input focus:outline-none focus:ring-2 focus:ring-tertiary"
                  />
                  <p className="text-xs text-gray-500">
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
                </div>

                {/* Delivery Time */}
                <div className="space-y-2">
                  <Label htmlFor="deliveryTime">Delivery Time</Label>
                  <Select name="deliveryTime" disabled={isPending}>
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
            <Button
              type="submit"
              disabled={isPending}
              className="bg-black text-white disabled:cursor-not-allowed cursor-pointer border border-black hover:bg-white hover:text-black"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Product"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
