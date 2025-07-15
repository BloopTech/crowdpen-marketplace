"use client";
import React, { useState, useEffect, useRef, useActionState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { createProduct } from "./authenticate";
import { Loader2, Upload, PlusCircle, X, Image as ImageIcon } from "lucide-react";
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

const initialStateValues = {
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
};

export default function CreateProductPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [filteredSubCategories, setFilteredSubCategories] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [images, setImages] = useState([]);
  const [formErrors, setFormErrors] = useState({});
  const [state, formAction, isPending] = useActionState(
    createProduct,
    initialStateValues
  );
  
  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price: "",
    originalPrice: "",
    marketplace_category_id: "",
    marketplace_subcategory_id: "",
    fileType: "",
    fileSize: "",
    license: "Standard",
    deliveryTime: "Instant",
    featured: false
  });


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
    }
  }, [
    state?.message,
    state?.errors,
    state?.data,
  ]);


  // Load categories and subcategories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/marketplace/categories');
        if (response.ok) {
          const data = await response.json();
          setCategories(data);
        }
      } catch (error) {
        console.error("Failed to fetch categories:", error);
      }
    };

    const fetchSubCategories = async () => {
      try {
        const response = await fetch('/api/marketplace/subcategories');
        if (response.ok) {
          const data = await response.json();
          setSubCategories(data);
        }
      } catch (error) {
        console.error("Failed to fetch subcategories:", error);
      }
    };

    fetchCategories();
    fetchSubCategories();
  }, []);

  // Filter subcategories based on selected category
  useEffect(() => {
    if (formData.marketplace_category_id) {
      const filtered = subCategories.filter(
        (sub) => sub.marketplace_category_id === formData.marketplace_category_id
      );
      setFilteredSubCategories(filtered);
      // Reset subcategory selection if current selection doesn't belong to the selected category
      if (!filtered.find(sub => sub.id === formData.marketplace_subcategory_id)) {
        setFormData(prev => ({ ...prev, marketplace_subcategory_id: "" }));
      }
    } else {
      setFilteredSubCategories([]);
    }
  }, [formData.marketplace_category_id, formData.marketplace_subcategory_id, subCategories]);

  // Check if user is authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      toast.error("You must be logged in to create a product");
      router.push("/login?redirect=/product/create");
    }
  }, [status, router]);

  // Handle form input changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
    
    // Clear error for this field when user starts typing
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  // Handle select changes
  const handleSelectChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

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
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const formRef = useRef(null);

  // Watch for state changes from form action
  useEffect(() => {
    if (state && state.message) {
      if (state.success) {
        toast.success("Product created successfully!");
        router.push(`/product/${state.productId}`);
      } else {
        toast.error(state.message);
        setFormErrors(state.errors || {});
      }
    }
  }, [state, router]);

  // Form submission handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormErrors({});

    try {
      const formDataObj = new FormData(e.target);
      
      // Add all form fields
      Object.entries(formData).forEach(([key, value]) => {
        if (value !== null && value !== undefined && key !== 'images') {
          formDataObj.append(key, value);
        }
      });
      
      // Handle featured checkbox specially
      formDataObj.append('featured', formData.featured ? 'true' : 'false');
      
      // Add image files directly - server action will process them
      let primaryImageAdded = false;
      images.forEach((imageObj, index) => {
        // Add each file to FormData
        if (imageObj.file) {
          const fileName = `image-${index}`;
          formDataObj.append('imageFiles', imageObj.file);
          
          // Set the first image as the primary image (for the 'image' field)
          if (!primaryImageAdded) {
            formDataObj.append('primaryImage', 'true');
            primaryImageAdded = true;
          }
        }
      });

      // Submit the form via the form action
      formAction(formDataObj);
    } catch (error) {
      toast.error("An unexpected error occurred");
      console.error(error);
      setIsSubmitting(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Create New Product</CardTitle>
          <CardDescription>
            Fill out the form below to list your product on the marketplace.
          </CardDescription>
        </CardHeader>

        <form ref={formRef} action={formAction} onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Basic Information</h3>
              
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Title <span className="text-red-500">*</span></Label>
                <Input
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="Enter product title"
                  required
                  className={formErrors.title ? "border-red-500" : ""}
                />
                {formErrors.title && (
                  <p className="text-red-500 text-sm">{formErrors.title}</p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description <span className="text-red-500">*</span></Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Enter detailed product description"
                  required
                  rows={5}
                  className={formErrors.description ? "border-red-500" : ""}
                />
                {formErrors.description && (
                  <p className="text-red-500 text-sm">{formErrors.description}</p>
                )}
              </div>

              {/* Category and Subcategory */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Category */}
                <div className="space-y-2">
                  <Label htmlFor="category">Category <span className="text-red-500">*</span></Label>
                  <Select
                    value={formData.marketplace_category_id}
                    onValueChange={(value) => handleSelectChange("marketplace_category_id", value)}
                  >
                    <SelectTrigger className={formErrors.marketplace_category_id ? "border-red-500" : ""}>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formErrors.marketplace_category_id && (
                    <p className="text-red-500 text-sm">{formErrors.marketplace_category_id}</p>
                  )}
                </div>

                {/* Subcategory */}
                <div className="space-y-2">
                  <Label htmlFor="subcategory">Subcategory <span className="text-red-500">*</span></Label>
                  <Select
                    value={formData.marketplace_subcategory_id}
                    onValueChange={(value) => handleSelectChange("marketplace_subcategory_id", value)}
                    disabled={!formData.marketplace_category_id}
                  >
                    <SelectTrigger className={formErrors.marketplace_subcategory_id ? "border-red-500" : ""}>
                      <SelectValue placeholder="Select a subcategory" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredSubCategories.map((subcategory) => (
                        <SelectItem key={subcategory.id} value={subcategory.id}>
                          {subcategory.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formErrors.marketplace_subcategory_id && (
                    <p className="text-red-500 text-sm">{formErrors.marketplace_subcategory_id}</p>
                  )}
                </div>
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Price */}
                <div className="space-y-2">
                  <Label htmlFor="price">Price ($) <span className="text-red-500">*</span></Label>
                  <Input
                    id="price"
                    name="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={handleChange}
                    placeholder="19.99"
                    required
                    className={formErrors.price ? "border-red-500" : ""}
                  />
                  {formErrors.price && (
                    <p className="text-red-500 text-sm">{formErrors.price}</p>
                  )}
                </div>

                {/* Original Price */}
                <div className="space-y-2">
                  <Label htmlFor="originalPrice">Original Price ($) (Optional)</Label>
                  <Input
                    id="originalPrice"
                    name="originalPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.originalPrice}
                    onChange={handleChange}
                    placeholder="29.99"
                    className={formErrors.originalPrice ? "border-red-500" : ""}
                  />
                  {formErrors.originalPrice && (
                    <p className="text-red-500 text-sm">{formErrors.originalPrice}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Images */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Product Images</h3>
              
              {/* Image Upload */}
              <div className="space-y-2">
                <Label htmlFor="images">Images <span className="text-red-500">*</span></Label>
                <div className="flex flex-wrap gap-3">
                  {images.map((imageObj, index) => (
                    <div key={index} className="relative h-24 w-24 rounded-md overflow-hidden border">
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
                  
                  <label htmlFor="image-upload" className="h-24 w-24 border-2 border-dashed rounded-md flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50">
                    {uploadingImage ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      <>
                        <ImageIcon className="h-6 w-6 mb-1" />
                        <span className="text-xs">Add Image</span>
                      </>
                    )}
                    <input
                      id="image-upload"
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                    />
                  </label>
                </div>
                {formErrors.images && (
                  <p className="text-red-500 text-sm">{formErrors.images}</p>
                )}
              </div>
            </div>

            {/* Additional Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Additional Details</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* File Type */}
                <div className="space-y-2">
                  <Label htmlFor="fileType">File Type <span className="text-red-500">*</span></Label>
                  <Select
                    value={formData.fileType}
                    onValueChange={(value) => handleSelectChange("fileType", value)}
                  >
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
                  {formErrors.fileType && (
                    <p className="text-red-500 text-sm">{formErrors.fileType}</p>
                  )}
                </div>

                {/* File Size */}
                <div className="space-y-2">
                  <Label htmlFor="fileSize">File Size</Label>
                  <Input
                    id="fileSize"
                    name="fileSize"
                    value={formData.fileSize}
                    onChange={handleChange}
                    placeholder="e.g. 15MB"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* License */}
                <div className="space-y-2">
                  <Label htmlFor="license">License</Label>
                  <Select
                    value={formData.license}
                    onValueChange={(value) => handleSelectChange("license", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select license type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Standard">Standard License</SelectItem>
                      <SelectItem value="Extended">Extended License</SelectItem>
                      <SelectItem value="Commercial">Commercial License</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Delivery Time */}
                <div className="space-y-2">
                  <Label htmlFor="deliveryTime">Delivery Time</Label>
                  <Select
                    value={formData.deliveryTime}
                    onValueChange={(value) => handleSelectChange("deliveryTime", value)}
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
                </div>
              </div>

              {/* Featured */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="featured"
                  name="featured"
                  checked={formData.featured}
                  onCheckedChange={(checked) => {
                    setFormData(prev => ({ ...prev, featured: checked }));
                  }}
                />
                <Label htmlFor="featured">Mark as featured product (may require approval)</Label>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex justify-between">
            <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
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
