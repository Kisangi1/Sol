import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { uploadToSupabase } from "@/lib/supabase";
import { createImages } from "@/lib/dal/images";
import { revalidateTag } from "next/cache";

export const maxRequestBodySize = '10mb'; // Reduced to prevent Vercel limits (4.5MB actual limit)

// Previous body parser configuration is no longer needed.

// GET all packages or filtered
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");
    const type = searchParams.get("type");
    const exclude = searchParams.get("exclude");
    const limit = searchParams.get("limit");

    // Get single package by slug
    if (slug) {
      const packageData = await prisma.package.findUnique({
        where: { slug, isActive: true },
        include: {
          packageImages: {
            orderBy: [
              { isHero: "desc" },
              { displayOrder: "asc" },
            ],
          },
        },
      });
      
      if (!packageData) {
        return NextResponse.json([]);
      }
      
      // Merge images from packageImages and images array
      const images: string[] = [];
      if (packageData.packageImages && packageData.packageImages.length > 0) {
        images.push(...packageData.packageImages.map(img => img.url));
      } else if (Array.isArray(packageData.images) && packageData.images.length > 0) {
        images.push(...packageData.images);
      }
      
      return NextResponse.json([{
        ...packageData,
        images,
      }]);
    }

    // Get related packages by type
    if (type) {
      const packages = await prisma.package.findMany({
        where: {
          isActive: true,
          packageType: type,
          ...(exclude && { id: { not: exclude } }),
        },
        orderBy: { createdAt: "desc" },
        take: limit ? parseInt(limit) : undefined,
        include: {
          packageImages: {
            orderBy: [
              { isHero: "desc" },
              { displayOrder: "asc" },
            ],
            select: {
              url: true,
            },
          },
        },
      });
      
      // Merge images from packageImages and images array
      const packagesWithImages = packages.map((pkg) => {
        let images: string[] = [];
        if (pkg.packageImages && pkg.packageImages.length > 0) {
          images = pkg.packageImages.map(img => img.url);
        } else if (Array.isArray(pkg.images) && pkg.images.length > 0) {
          images = pkg.images;
        }
        
        return {
          ...pkg,
          images,
        };
      });
      
      return NextResponse.json(packagesWithImages, {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      });
    }

    // Get all packages - optimize by selecting only needed fields for list view
    // Return all packages regardless of isActive status
    const packages = await prisma.package.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        packageType: true,
        description: true,
        pricing: true,
        daysOfTravel: true,
        images: true, // Kept for backward compatibility
        maxCapacity: true,
        currentBookings: true,
        isActive: true,
        destination: true,
        packageImages: {
          orderBy: [
            { isHero: "desc" },
            { displayOrder: "asc" },
          ],
          select: {
            url: true,
            isHero: true,
            displayOrder: true,
          },
        },
        // Exclude: createdAt, updatedAt, createdBy to reduce payload
      },
    });
    
    // Transform images - prioritize packageImages, fallback to images array
    const optimizedPackages = packages.map((pkg) => {
      let finalImages: string[] = [];
      
      // Priority 1: Use packageImages relation if available
      if (pkg.packageImages && pkg.packageImages.length > 0) {
        finalImages = pkg.packageImages.map(img => img.url);
      }
      // Priority 2: Fallback to images array
      else if (Array.isArray(pkg.images) && pkg.images.length > 0) {
        finalImages = pkg.images;
      }
      
      return {
        ...pkg,
        images: finalImages,
      };
    });

    return NextResponse.json(optimizedPackages, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error("Error fetching packages:", error);
    return NextResponse.json(
      { error: "Failed to fetch packages" },
      { status: 500 }
    );
  }
}

// POST create new package (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true },
    });

    if (!user?.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check content type to handle both FormData and JSON
    const contentType = request.headers.get("content-type") || "";
    let name: string;
    let slug: string;
    let packageType: string;
    let description: string;
    let pricing: number;
    let daysOfTravel: number;
    let isActive: boolean;
    let uploadedImages: string[] = [];
    let failedUploads = 0;

    if (contentType.includes("multipart/form-data") || contentType.includes("form-data")) {
      // Handle FormData
      const formData = await request.formData();
      name = formData.get("name") as string;
      slug = formData.get("slug") as string;
      packageType = (formData.get("packageType") as string) || "safari";
      description = formData.get("description") as string;
      pricing = parseFloat(formData.get("pricing") as string);
      daysOfTravel = parseInt(formData.get("daysOfTravel") as string) || 1;
      isActive = formData.get("isActive") === "true";
      
      // Handle image files - upload to Supabase with size validation
      const imageFiles = formData.getAll("images") as File[];
      let totalFileSize = 0;
      const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB per file
      const MAX_TOTAL_SIZE = 10 * 1024 * 1024; // 10MB total
      
      // Store image metadata for creating Image records
      const imageMetadata: Array<{
        url: string;
        file: File;
        filePath: string;
      }> = [];
      
      for (const imageFile of imageFiles) {
        if (imageFile instanceof File && imageFile.size > 0) {
          // Validate individual file size
          if (imageFile.size > MAX_FILE_SIZE) {
            return NextResponse.json({ 
              error: "File too large",
              details: `Image ${imageFile.name} exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`
            }, { status: 400 });
          }
          
          totalFileSize += imageFile.size;
          
          // Validate total size
          if (totalFileSize > MAX_TOTAL_SIZE) {
            return NextResponse.json({ 
              error: "Total file size too large",
              details: `Total image size exceeds ${MAX_TOTAL_SIZE / (1024 * 1024)}MB limit`
            }, { status: 400 });
          }
          
          try {
            const imageUrl = await uploadToSupabase("packages", imageFile);
            uploadedImages.push(imageUrl);
            
            // Extract file path from URL for Image record
            const urlParts = imageUrl.split(`/storage/v1/object/public/packages/`);
            const filePath = urlParts.length > 1 ? urlParts[1] : imageFile.name;
            
            imageMetadata.push({
              url: imageUrl,
              file: imageFile,
              filePath,
            });
          } catch (uploadError) {
            console.error("Error uploading package image:", uploadError);
            failedUploads++;
            // Continue with other images even if one fails
          }
        }
      }
    } else {
      // Handle JSON
      const body = await request.json();
      name = body.name;
      slug = body.slug;
      packageType = body.packageType || "safari";
      description = body.description;
      pricing = parseFloat(body.price || body.pricing);
      // Extract days from duration string if provided, otherwise use daysOfTravel
      if (body.duration) {
        const daysMatch = body.duration.match(/(\d+)/);
        daysOfTravel = daysMatch ? parseInt(daysMatch[1]) : (body.daysOfTravel || 1);
      } else {
        daysOfTravel = body.daysOfTravel || 1;
      }
      isActive = body.isPublished ?? body.isActive ?? true;
      uploadedImages = body.images || [];
    }

    // Character limits to prevent 413 errors
    const MAX_DESCRIPTION_LENGTH = 5000;
    const MAX_NAME_LENGTH = 200;
    const MAX_SLUG_LENGTH = 100;

    // Validate required fields
    if (!name || !slug || !description || isNaN(pricing) || pricing < 0 || !daysOfTravel || daysOfTravel < 1) {
      return NextResponse.json({ 
        error: "Missing required fields",
        details: "Name, slug, description, pricing (>= 0), and daysOfTravel (>= 1) are required"
      }, { status: 400 });
    }

    // Validate character limits
    if (name.length > MAX_NAME_LENGTH) {
      return NextResponse.json({ 
        error: "Name too long",
        details: `Name must be less than ${MAX_NAME_LENGTH} characters`
      }, { status: 400 });
    }

    if (slug.length > MAX_SLUG_LENGTH) {
      return NextResponse.json({ 
        error: "Slug too long",
        details: `Slug must be less than ${MAX_SLUG_LENGTH} characters`
      }, { status: 400 });
    }

    if (description.length > MAX_DESCRIPTION_LENGTH) {
      return NextResponse.json({ 
        error: "Description too long",
        details: `Description must be less than ${MAX_DESCRIPTION_LENGTH} characters`
      }, { status: 400 });
    }

    // Validate slug format (alphanumeric, hyphens, underscores only)
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugRegex.test(slug)) {
      return NextResponse.json({ 
        error: "Invalid slug format",
        details: "Slug must be lowercase alphanumeric with hyphens only (e.g., 'ultimate-safari')"
      }, { status: 400 });
    }

    // Validate package type
    const validPackageTypes = ["safari", "beach", "cultural", "adventure", "luxury", "mixed"];
    if (!validPackageTypes.includes(packageType)) {
      return NextResponse.json({ 
        error: "Invalid package type",
        details: `Package type must be one of: ${validPackageTypes.join(", ")}`
      }, { status: 400 });
    }

    // Use uploaded images if any, otherwise use default
    // Only use uploaded images from Supabase buckets - no default fallback
    const finalImages = uploadedImages.length > 0 ? uploadedImages : [];
    
    if (failedUploads > 0 && uploadedImages.length === 0) {
      console.error("All image uploads failed. Check Supabase configuration.");
    }

    // Truncate fields to limits before saving
    const truncatedName = name.substring(0, MAX_NAME_LENGTH);
    const truncatedDescription = description.substring(0, MAX_DESCRIPTION_LENGTH);

    let packageData;
    try {
      let attempts = 0;
      const maxAttempts = 3;

      // Retry loop to handle race conditions for unique slug
      while (attempts < maxAttempts) {
        try {
          // Check for duplicate slug and make unique if necessary
          // Recalculate inside loop to handle race conditions
          let uniqueSlug = slug;
          let counter = 1;
          while (await prisma.package.findUnique({ where: { slug: uniqueSlug } })) {
            uniqueSlug = `${slug}-${counter}`;
            counter++;
          }
          
          const truncatedSlug = uniqueSlug.substring(0, MAX_SLUG_LENGTH);

          packageData = await prisma.package.create({
            data: {
              name: truncatedName,
              slug: truncatedSlug,
              packageType,
              description: truncatedDescription,
              pricing,
              daysOfTravel,
              images: finalImages,
              maxCapacity: 10,
              currentBookings: 0,
              destination: {
                id: "default",
                name: "Kenya",
                slug: "kenya",
                bestTime: "Year-round"
              },
              isActive,
              createdBy: session.user.id,
            },
          });
          
          // If successful, break loop
          break;
        } catch (dbError) {
          attempts++;
          // If it's a unique constraint error and we have retries left, continue
          if (dbError instanceof Error && 
              (dbError.message.includes('Unique constraint') || dbError.message.includes('duplicate')) && 
              attempts < maxAttempts) {
            console.log(`Slug collision for ${slug}, retrying... (Attempt ${attempts})`);
            continue;
          }
          
          // Otherwise throw to be caught by outer catch
          throw dbError;
        }
      }

      if (!packageData) {
        throw new Error("Failed to create package");
      }
      
      // Create Image records in database for packageImages relation
      if (imageMetadata.length > 0 && packageData.id) {
        try {
          await createImages(
            imageMetadata.map((img, index) => ({
              url: img.url,
              bucket: "packages",
              filename: img.file.name,
              filePath: img.filePath,
              fileSize: img.file.size,
              mimeType: img.file.type,
              isHero: index === 0, // First image is hero
              displayOrder: index,
              packageId: packageData.id,
            }))
          );
        } catch (imageError) {
          console.error("Error creating image records:", imageError);
          // Continue even if Image record creation fails - package is still created
        }
      }
    } catch (dbError) {
      // Prisma/DB error logging
      if (dbError instanceof Error) {
        console.error("Prisma error creating package:", dbError.message, dbError.stack);
        // Check for unique constraint violation (duplicate slug)
        if (dbError.message.includes('Unique constraint') || dbError.message.includes('duplicate')) {
          return NextResponse.json(
            { error: "Duplicate slug", details: "A package with this slug already exists" },
            { status: 409 }
          );
        }
      } else {
        console.error("Prisma error creating package:", dbError);
      }
      return NextResponse.json(
        { error: "Database error", details: dbError instanceof Error ? dbError.message : "Unknown error" },
        { status: 500 }
      );
    }

    // Revalidate cache
    revalidateTag('packages');
    revalidateTag(`package-${slug}`);

    return NextResponse.json({ 
      success: true, 
      package: packageData,
      warnings: failedUploads > 0 ? ["Image uploads failed"] : undefined
    }, { status: 201 });
  } catch (error) {
    // General error logging
    if (error instanceof Error) {
      console.error("Error creating package:", error.message, error.stack);
    } else {
      console.error("Error creating package:", error);
    }
    return NextResponse.json(
      { error: "Failed to create package", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
