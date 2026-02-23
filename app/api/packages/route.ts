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
    const session = await auth.api.getSession({ headers: await headers() });
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

    const contentType = request.headers.get("content-type") || "";

    // Shared fields
    let name = "";
    let slug = "";
    let packageType = "safari";
    let description = "";
    let pricing = 0;
    let daysOfTravel = 1;
    let isActive = true;

    let imageUrls: string[] = [];
    let imagesMeta: Array<{
      url: string;
      bucket: "packages";
      filename: string;
      filePath: string;
      fileSize: number;
      mimeType: string;
      isHero?: boolean;
      displayOrder?: number;
    }> = [];

    if (contentType.includes("application/json")) {
      const body = await request.json();
      name = body.name;
      slug = body.slug;
      packageType = body.packageType || "safari";
      description = body.description;
      pricing = Number(body.pricing ?? body.price);
      daysOfTravel = Number(body.daysOfTravel ?? 1);
      isActive = body.isActive ?? body.isPublished ?? true;
      imageUrls = Array.isArray(body.images) ? body.images : [];

      if (Array.isArray(body.imagesMeta)) {
        imagesMeta = body.imagesMeta
          .filter((img: any) => img && typeof img.url === "string")
          .map((img: any, index: number) => ({
            url: String(img.url),
            bucket: "packages" as const,
            filename: String(img.filename || `image-${index}`),
            filePath: String(img.filePath || ""),
            fileSize: Number(img.fileSize || 0),
            mimeType: String(img.mimeType || "application/octet-stream"),
            isHero: Boolean(img.isHero),
            displayOrder: Number.isFinite(img.displayOrder)
              ? Number(img.displayOrder)
              : index,
          }));
      }
    } else if (
      contentType.includes("multipart/form-data") ||
      contentType.includes("form-data")
    ) {
      // Backward compatibility only — can hit Vercel payload limits.
      const formData = await request.formData();
      name = formData.get("name") as string;
      slug = formData.get("slug") as string;
      packageType = (formData.get("packageType") as string) || "safari";
      description = formData.get("description") as string;
      pricing = parseFloat(formData.get("pricing") as string);
      daysOfTravel = parseInt(formData.get("daysOfTravel") as string) || 1;
      isActive = formData.get("isActive") === "true";

      const imageFiles = formData.getAll("images") as File[];
      for (const [idx, file] of imageFiles.entries()) {
        if (!(file instanceof File) || file.size <= 0) continue;
        const url = await uploadToSupabase("packages", file);
        imageUrls.push(url);
        const urlParts = url.split(`/storage/v1/object/public/packages/`);
        const filePath = urlParts.length > 1 ? urlParts[1] : file.name;
        imagesMeta.push({
          url,
          bucket: "packages",
          filename: file.name,
          filePath,
          fileSize: file.size,
          mimeType: file.type,
          isHero: idx === 0,
          displayOrder: idx,
        });
      }
    } else {
      return NextResponse.json(
        { error: "Unsupported content type" },
        { status: 415 }
      );
    }

    // Limits
    const MAX_DESCRIPTION_LENGTH = 5000;
    const MAX_NAME_LENGTH = 200;
    const MAX_SLUG_LENGTH = 100;

    if (
      !name ||
      !slug ||
      !description ||
      !Number.isFinite(pricing) ||
      pricing <= 0 ||
      !Number.isFinite(daysOfTravel) ||
      daysOfTravel < 1
    ) {
      return NextResponse.json(
        {
          error: "Missing required fields",
          details:
            "Name, slug, description, pricing (> 0), and daysOfTravel (>= 1) are required",
        },
        { status: 400 }
      );
    }

    if (name.length > MAX_NAME_LENGTH) {
      return NextResponse.json(
        { error: "Name too long", details: `Max ${MAX_NAME_LENGTH} chars` },
        { status: 400 }
      );
    }
    if (slug.length > MAX_SLUG_LENGTH) {
      return NextResponse.json(
        { error: "Slug too long", details: `Max ${MAX_SLUG_LENGTH} chars` },
        { status: 400 }
      );
    }
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      return NextResponse.json(
        {
          error: "Description too long",
          details: `Max ${MAX_DESCRIPTION_LENGTH} chars`,
        },
        { status: 400 }
      );
    }

    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugRegex.test(slug)) {
      return NextResponse.json(
        {
          error: "Invalid slug format",
          details:
            "Slug must be lowercase alphanumeric with hyphens only (e.g., 'ultimate-safari')",
        },
        { status: 400 }
      );
    }

    const validPackageTypes = [
      "safari",
      "beach",
      "cultural",
      "adventure",
      "luxury",
      "mixed",
    ];
    if (!validPackageTypes.includes(packageType)) {
      return NextResponse.json(
        {
          error: "Invalid package type",
          details: `Package type must be one of: ${validPackageTypes.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Enforce "no dummy images" by requiring at least one URL (recommended)
    if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
      return NextResponse.json(
        { error: "At least one image is required" },
        { status: 400 }
      );
    }

    const truncatedName = name.substring(0, MAX_NAME_LENGTH);
    const truncatedDescription = description.substring(0, MAX_DESCRIPTION_LENGTH);

    // Create with slug de-duplication (race-safe)
    const baseSlug = slug.substring(0, MAX_SLUG_LENGTH);
    let packageData: any | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const trySlug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt}`;
      try {
        packageData = await prisma.package.create({
          data: {
            name: truncatedName,
            slug: trySlug.substring(0, MAX_SLUG_LENGTH),
            packageType,
            description: truncatedDescription,
            pricing,
            daysOfTravel,
            images: imageUrls,
            maxCapacity: 10,
            currentBookings: 0,
            destination: {
              id: "default",
              name: "Kenya",
              slug: "kenya",
              bestTime: "Year-round",
            },
            isActive,
            createdBy: session.user.id,
          },
        });
        slug = packageData.slug;
        break;
      } catch (dbError) {
        const code = (dbError as any)?.code;
        if (code === "P2002" && attempt < 4) continue;
        return NextResponse.json(
          {
            error: code === "P2002" ? "Duplicate slug" : "Database error",
            details: dbError instanceof Error ? dbError.message : "Unknown error",
          },
          { status: code === "P2002" ? 409 : 500 }
        );
      }
    }

    if (!packageData) {
      return NextResponse.json(
        { error: "Failed to create package" },
        { status: 500 }
      );
    }

    // Image rows (best-effort)
    if (imagesMeta.length > 0) {
      try {
        await createImages(
          imagesMeta.map((img, idx) => ({
            url: img.url,
            bucket: "packages",
            filename: img.filename,
            filePath: img.filePath,
            fileSize: img.fileSize,
            mimeType: img.mimeType,
            isHero: img.isHero ?? idx === 0,
            displayOrder: img.displayOrder ?? idx,
            packageId: packageData.id,
          }))
        );
      } catch (e) {
        console.error("Error creating package image records:", e);
      }
    }

    revalidateTag("packages");
    revalidateTag(`package-${slug}`);

    return NextResponse.json({ success: true, package: packageData }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      {
        error: "Failed to create package",
        details: e instanceof Error ? e.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
