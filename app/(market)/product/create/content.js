"use client";
import React, { useState, useEffect, useRef, useActionState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { createProduct } from "./authenticate";
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
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
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
  const [categoryID, setCategoryID] = useState("");
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

  // Handle image upload
  const handleImageUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingImage(true);
    const file = files[0];

    try {
      // Store the file object and create a preview URL
      const previewUrl = URL.createObjectURL(file);
      setImages([...images, { file, previewUrl }]);
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

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">
            Create New Product
          </CardTitle>
          <CardDescription>
            Fill out the form below to list your product on the marketplace.
          </CardDescription>
        </CardHeader>

        <form ref={formRef} action={formAction}>
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
                      : "focus:ring-blue-500"
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
                    required
                    className={`w-full border border-gray-200 rounded-md p-2 form-input focus:outline-none focus:ring-2 ${
                      Object.keys(state?.errors).length !== 0 &&
                      state?.errors?.price?.length
                        ? "border-red-500 focus:ring-red-500"
                        : "focus:ring-blue-500"
                    }`}
                    disabled={isPending}
                  />
                  <span className="text-xs text-red-500">
                    {Object.keys(state?.errors).length !== 0 &&
                    state?.errors?.price?.length
                      ? state?.errors?.price[0]
                      : null}
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
                    className={`w-full border border-gray-200 rounded-md p-2 form-input focus:outline-none focus:ring-2 ${
                      Object.keys(state?.errors).length !== 0 &&
                      state?.errors?.originalPrice?.length
                        ? "border-red-500 focus:ring-red-500"
                        : "focus:ring-blue-500"
                    }`}
                  />
                  <span className="text-xs text-red-500">
                    {Object.keys(state?.errors).length !== 0 &&
                    state?.errors?.originalPrice?.length
                      ? state?.errors?.originalPrice[0]
                      : null}
                  </span>
                </div>
              </div>
            </div>

            {/* Images */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Product Images</h3>

              {/* Image Upload */}
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

            {/* Additional Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Additional Details</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* File Type */}
                <div className="space-y-2">
                  <Label htmlFor="fileType">
                    File Type <span className="text-red-500">*</span>
                  </Label>
                  <Select name="fileType" disabled={isPending}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select file type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PDF">PDF</SelectItem>
                      <SelectItem value="PSD">PSD</SelectItem>
                      <SelectItem value="AI">AI</SelectItem>
                      <SelectItem value="FIGMA">Figma</SelectItem>
                      <SelectItem value="ZIP">ZIP</SelectItem>
                      <SelectItem value="DOC">DOC/DOCX</SelectItem>
                      <SelectItem value="XLS">XLS/XLSX</SelectItem>
                      <SelectItem value="PPT">PPT/PPTX</SelectItem>
                    </SelectContent>
                  </Select>
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
                    placeholder="e.g. 15MB"
                  />
                </div>
              </div>

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

              {/* Featured */}
              <div className="flex items-center space-x-2">
                <Checkbox id="featured" name="featured" />
                <Label htmlFor="featured">
                  Mark as featured product (may require approval)
                </Label>
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
