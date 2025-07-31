"use client";
import React, { useState, useEffect, useRef, useActionState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { EditProduct } from "./action";
import {
  Loader2,
  Upload,
  PlusCircle,
  X,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { useFormState } from "react-dom";

// UI Components
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { Textarea } from "../../../../components/ui/textarea";
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

const initialStateValues = {
  message: "",
  errors: {
    title: [],
    description: [],
    price: [],
    originalPrice: [],
    marketplace_category_id: [],
    marketplace_subcategory_id: [],
    images: [],
    fileType: [],
    fileSize: [],
    license: [],
    deliveryTime: [],
    featured: [],
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
  const [fileSize, setFileSize] = useState("");
  const [fileType, setFileType] = useState("");
  const [categoryID, setCategoryID] = useState("");
  const [subcategoryID, setSubcategoryID] = useState("");
  const [price, setPrice] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const [whatIncluded, setWhatIncluded] = useState("");
  const [priceError, setPriceError] = useState("");
  const [featured, setFeatured] = useState(false);
  const [deliveryTime, setDeliveryTime] = useState("");
  const [license, setLicense] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [state, formAction, isPending] = useActionState(
    EditProduct,
    initialStateValues
  );
  const formRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    if (product) {
      setPrice(product?.price || "");
      setOriginalPrice(product?.originalPrice || "");
      setWhatIncluded(product?.what_included || "");
      setFeatured(product?.featured || false);
      setDeliveryTime(product?.deliveryTime || "");
      setFileType(product?.fileType || "");
      setFileSize(product?.fileSize || "");
      setTitle(product?.title || "");
      setDescription(product?.description || "");
      setLicense(product?.license || "");

      if(categoriesData?.length){
        setCategoryID(product?.marketplace_category_id || "");
      }

      if(subCategories?.length){
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
      const selectedCategory = categoriesData?.find((category) => category.id === categoryID);
      const subcategories = selectedCategory?.MarketplaceSubCategories || [];
      setSubCategories(subcategories);
      
      // If subcategory ID is set but not in the new subcategories, reset it
      if (subcategoryID && !subcategories.find(sub => sub.id === subcategoryID)) {
        setSubcategoryID("");
      }
    } else {
      setSubCategories([]);
      setSubcategoryID("");
    }
  }, [categoriesData, categoryID, subcategoryID]);

  // Validate price relationship
  const validatePrices = (currentPrice, currentOriginalPrice) => {
    if (currentOriginalPrice && currentPrice) {
      const priceNum = parseFloat(currentPrice);
      const originalPriceNum = parseFloat(currentOriginalPrice);

      if (originalPriceNum <= priceNum) {
        setPriceError("Original price must be higher than the current price");
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
    validatePrices(price, newOriginalPrice);
  };

  // Handle multiple image uploads
  const handleImageUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingImage(true);

    try {
      const newImages = [];

      // Process all selected files
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Validate file type
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} is not a valid image file`);
          continue;
        }

        // Validate file size (max 10MB per image)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
          toast.error(`${file.name} is too large. Maximum size is 10MB`);
          continue;
        }

        // Create preview URL and add to array
        const previewUrl = URL.createObjectURL(file);
        newImages.push({ file, previewUrl });
      }

      if (newImages.length > 0) {
        setImages([...images, ...newImages]);
        toast.success(`${newImages.length} image(s) added successfully`);
      }
    } catch (error) {
      console.error("Error handling images:", error);
      toast.error("Failed to process images");
    } finally {
      setUploadingImage(false);
    }
  };

  // Remove a new uploaded image
  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Remove an existing image
  const removeExistingImage = (index) => {
    setExistingImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle single product file upload
  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingFile(true);
    const file = files[0]; // Only take the first file (single file upload)

    try {
      // Validate file size (max 100MB)
      const maxSize = 100 * 1024 * 1024; // 100MB
      if (file.size > maxSize) {
        toast.error("Product file size must be less than 100MB");
        return;
      }

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
      setProductFile(file);

      toast.success(`File "${file.name}" selected (${formattedSize})`);
    } catch (error) {
      console.error("Error handling file:", error);
      toast.error("Failed to process file");
    } finally {
      setUploadingFile(false);
    }
  };

  // Remove new product file
  const removeFile = () => {
    setProductFile(null);
    setFileSize("");
    setFileType("");
    // Reset file input
    const fileInput = document.getElementById("productFile");
    if (fileInput) fileInput.value = "";
  };

  // Remove existing product file
  const removeExistingFile = () => {
    setExistingProductFile(null);
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Edit Product</CardTitle>
          <CardDescription>
            Update your product information below.
          </CardDescription>
        </CardHeader>

        <form
          ref={formRef}
          action={(formData) => {
            // Add product ID for editing
            formData.append("productId", product.id);

            // Add new product file to form data if it exists
            if (productFile) {
              formData.append("productFile", productFile);
            }

            // Add existing product file URL if it exists and no new file
            if (existingProductFile && !productFile) {
              formData.append("existingProductFile", existingProductFile);
            }

            // Add new images to form data
            images.forEach((imageObj) => {
              if (imageObj.file) {
                formData.append("images", imageObj.file);
              }
            });

            // Add existing images as JSON
            if (existingImages.length > 0) {
              formData.append("existingImages", JSON.stringify(existingImages));
            }

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
                      : "focus:ring-blue-500"
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
                      : "focus:ring-blue-500"
                  }`}
                  disabled={isPending}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
                <span className="text-xs text-red-500">
                  {Object.keys(state?.errors).length !== 0 &&
                  state?.errors?.description?.length
                    ? state?.errors?.description[0]
                    : null}
                </span>
                <input type="hidden" value={description} name="description" />
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
                  <input type="hidden" value={categoryID} name="marketplace_category_id" />
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
                  <input type="hidden" value={subcategoryID} name="marketplace_subcategory_id" />
                </div>
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Price */}
                <div className="space-y-2">
                  <Label htmlFor="price">
                    Price ($) <span className="text-red-500">*</span>
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
                    required
                    className={`w-full border border-gray-200 rounded-md p-2 form-input focus:outline-none focus:ring-2 ${
                      (Object.keys(state?.errors).length !== 0 &&
                        state?.errors?.price?.length) ||
                      priceError
                        ? "border-red-500 focus:ring-red-500"
                        : "focus:ring-blue-500"
                    }`}
                    disabled={isPending}
                  />
                  <span className="text-xs text-red-500">
                    {Object.keys(state?.errors).length !== 0 &&
                    state?.errors?.price?.length
                      ? state?.errors?.price[0]
                      : priceError || null}
                  </span>
                </div>

                {/* Original Price */}
                <div className="space-y-2">
                  <Label htmlFor="originalPrice">
                    Original Price ($) (Optional)
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
                    className={`w-full border border-gray-200 rounded-md p-2 form-input focus:outline-none focus:ring-2 ${
                      (Object.keys(state?.errors).length !== 0 &&
                        state?.errors?.originalPrice?.length) ||
                      priceError
                        ? "border-red-500 focus:ring-red-500"
                        : "focus:ring-blue-500"
                    }`}
                    disabled={isPending}
                  />
                  <span className="text-xs text-red-500">
                    {Object.keys(state?.errors).length !== 0 &&
                    state?.errors?.originalPrice?.length
                      ? state?.errors?.originalPrice[0]
                      : priceError || null}
                  </span>
                  {originalPrice && price && !priceError && (
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
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
                        disabled={isPending}
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
                        PDF, PSD, AI, Figma, ZIP, DOC, XLS, PPT files up to
                        100MB
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
                    <li>• Maximum file size: 10MB</li>
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
                    className="bg-gray-50"
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
                    className="bg-gray-50"
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

              {/* Featured */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="featured"
                  name="featured"
                  value={featured}
                  onCheckedChange={(value) => setFeatured(value)}
                />
                <Label htmlFor="featured">
                  Mark as featured product (may require approval)
                </Label>
                <input type="hidden" value={featured} name="featured" />
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
                  Updating...
                </>
              ) : (
                "Edit Product"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
