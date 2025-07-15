import { NextResponse } from "next/server";
import { db } from "../../../../models/index";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import sharp from "sharp";

// Configure S3 client for Cloudflare R2
const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
});

export async function POST(request) {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    // Process multipart form data
    const formData = await request.formData();
    
    // Extract product data from JSON string
    const productDataJson = formData.get('productData');
    let productData;
    
    try {
      productData = JSON.parse(productDataJson);
    } catch (error) {
      return NextResponse.json(
        { message: "Invalid product data format" },
        { status: 400 }
      );
    }
    
    // Get image files from form data
    const imageFiles = formData.getAll('imageFiles');
    const primaryImage = formData.get('primaryImage') === 'true';
    
    // Upload images to Cloudflare R2
    let imageUrls = [];
    let featuredImageUrl = null;
    
    if (imageFiles && imageFiles.length > 0) {
      const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;
      const publicUrlBase = process.env.CLOUDFLARE_R2_PUBLIC_URL;
      
      // Process each image file
      for (const file of imageFiles) {
        try {
          // Convert file to buffer
          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          
          // Process image with sharp
          const compressedBuffer = await sharp(buffer)
            .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
            .toFormat("webp")
            .webp({ quality: 80, lossless: false, effort: 4 })
            .toBuffer();
          
          // Generate unique filename
          const fileName = `product-${session.user.id}-${uuidv4()}.webp`;
          const key = `products/${fileName}`;
          
          // Upload to Cloudflare R2
          const s3Params = {
            Bucket: bucketName,
            Key: key,
            Body: compressedBuffer,
            ContentType: "image/webp",
          };
          
          const command = new PutObjectCommand(s3Params);
          await s3Client.send(command);
          
          // Create public URL for the uploaded image
          const imageUrl = `${publicUrlBase}/${key}`;
          imageUrls.push(imageUrl);
        } catch (error) {
          console.error("Error processing file:", error);
          // Continue with other files if one fails
        }
      }
      
      // Set the first image as featured if requested
      if (imageUrls.length > 0 && primaryImage) {
        featuredImageUrl = imageUrls[0];
      }
      
      // If no images were successfully uploaded, return error
      if (imageUrls.length === 0) {
        return NextResponse.json(
          { message: "Failed to upload images" },
          { status: 500 }
        );
      }
    }

    // Create new product in database
    const newProduct = await db.MarketplaceProduct.create({
      id: uuidv4(),
      user_id: session.user.id,
      title: productData.title,
      description: productData.description,
      price: productData.price,
      originalPrice: productData.originalPrice,
      marketplace_category_id: productData.marketplace_category_id,
      marketplace_subcategory_id: productData.marketplace_subcategory_id,
      image: featuredImageUrl, // Featured image URL
      images: imageUrls, // Array of image URLs
      fileType: productData.fileType,
      fileSize: productData.fileSize || "",
      license: productData.license || "Standard",
      deliveryTime: productData.deliveryTime || "Instant",
      featured: productData.featured || false,
    });

    return NextResponse.json(
      {
        id: newProduct.id,
        title: newProduct.title,
        image: featuredImageUrl,
        images: imageUrls,
        message: "Product created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating product:", error);

    return NextResponse.json(
      { message: error.message || "Failed to create product" },
      { status: 500 }
    );
  }
}
