export const maxRequestBodySize = '10mb'; // Reduced to prevent Vercel limits (4.5MB actual limit)
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { uploadToSupabase } from "@/lib/supabase";
import { createImages } from "@/lib/dal/images";
import { revalidateTag } from "next/cache";

// GET all destinations or single by slug
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");
    const listView = searchParams.get("listView") === "true";
    const limit = searchParams.get("limit");

    if (slug) {
      // Get single destination by slug
      const destination = await prisma.destination.findUnique({
        where: { slug, isPublished: true },
        include: {
          destinationImages: {
            orderBy: [{ isHero: "desc" }, { displayOrder: "asc" }],
            select: {
              url: true,
              isHero: true,
              displayOrder: true,
            },
          },
        },
      });
      if (!destination) return NextResponse.json([]);

      const relImages = (destination.destinationImages || [])
        .map((img) => img.url)
        .filter(Boolean);
      const relHero =
        destination.destinationImages?.find((img) => img.isHero)?.url ||
        destination.destinationImages?.[0]?.url ||
        destination.heroImage ||
        "";

      return NextResponse.json([
        {
          ...destination,
          heroImage: relHero,
          images: relImages.length > 0 ? relImages : destination.images || [],
        },
      ]);
    }

    // Get all destinations
    if (listView) {
      // For list view, only return essential fields to reduce payload size
      const destinations = await prisma.destination.findMany({
        where: { isPublished: true },
        orderBy: { createdAt: "desc" },
        take: limit ? parseInt(limit) : undefined,
        select: {
          id: true,
          name: true,
          slug: true,
          tagline: true,
          description: true, // Needed for display
          heroImage: true,
          location: true,
          highlights: true, // Needed for display
          isPublished: true,
          destinationImages: {
            where: { isHero: true },
            take: 1,
            select: { url: true },
          },
          // Exclude: images array, overview, wildlife, bestTimeToVisit, thingsToKnow, whatToPack, accommodation, activities, createdAt, updatedAt
        },
      });
      const transformed = destinations.map((d: any) => ({
        ...d,
        heroImage: d.destinationImages?.[0]?.url || d.heroImage || "",
      }));

      return NextResponse.json(transformed, {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      });
    }

    // Full data for other cases - but still optimize by excluding large fields when not needed
    const destinations = await prisma.destination.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        tagline: true,
        description: true,
        heroImage: true,
        images: true,
        location: true,
        overview: true,
        wildlife: true,
        bestTimeToVisit: true,
        thingsToKnow: true,
        whatToPack: true,
        accommodation: true,
        activities: true,
        highlights: true,
        funFacts: true,
        isPublished: true,
        destinationImages: {
          orderBy: [{ isHero: "desc" }, { displayOrder: "asc" }],
          select: { url: true, isHero: true, displayOrder: true },
        },
        // Exclude: createdAt, updatedAt, createdBy to reduce payload
      },
    });

    const transformed = destinations.map((d: any) => {
      const relImages = (d.destinationImages || [])
        .map((img: any) => img.url)
        .filter(Boolean);
      const relHero =
        d.destinationImages?.find((img: any) => img.isHero)?.url ||
        d.destinationImages?.[0]?.url ||
        d.heroImage ||
        "";
      return {
        ...d,
        heroImage: relHero,
        images: relImages.length > 0 ? relImages : d.images || [],
      };
    });

    return NextResponse.json(transformed, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error("Error fetching destinations:", error);
    return NextResponse.json(
      { error: "Failed to fetch destinations" },
      { status: 500 }
    );
  }
}

// POST create new destination (admin only)
// ...existing code...

// POST create new destination (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
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
    let tagline: string;
    let description: string;
    let isPublished: boolean;
    let heroImage: string | null = null;
    let uploadedImages: string[] = [];
    let imagesMeta: Array<{
      url: string;
      bucket: "destinations";
      filename: string;
      filePath: string;
      fileSize: number;
      mimeType: string;
      isHero?: boolean;
      displayOrder?: number;
    }> = [];

    if (contentType.includes("multipart/form-data") || contentType.includes("form-data")) {
      // Handle FormData
      const formData = await request.formData();
      name = formData.get("name") as string;
      slug = formData.get("slug") as string;
      tagline = (formData.get("tagline") as string) || "";
      description = formData.get("description") as string;
      isPublished = formData.get("isPublished") === "true";
      
      // Handle hero image file - upload to Supabase with size validation
      const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB per file
      const MAX_TOTAL_SIZE = 4.5 * 1024 * 1024; // 4.5MB total (Vercel limit)
      let totalFileSize = 0;
      
      const heroImageFile = formData.get("heroImage") as File | null;
      if (heroImageFile && heroImageFile instanceof File && heroImageFile.size > 0) {
        if (heroImageFile.size > MAX_FILE_SIZE) {
          return NextResponse.json({ 
            error: "File too large",
            details: `Hero image exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`
          }, { status: 400 });
        }
        totalFileSize += heroImageFile.size;
        
        try {
          heroImage = await uploadToSupabase("destinations", heroImageFile);
          const urlParts = heroImage.split(`/storage/v1/object/public/destinations/`);
          const filePath = urlParts.length > 1 ? urlParts[1] : heroImageFile.name;
          imagesMeta.push({
            url: heroImage,
            bucket: "destinations",
            filename: heroImageFile.name,
            filePath,
            fileSize: heroImageFile.size,
            mimeType: heroImageFile.type,
            isHero: true,
            displayOrder: 0,
          });
        } catch (uploadError) {
          console.error("Error uploading hero image:", uploadError);
          // Fallback to empty string if upload fails
          heroImage = "";
        }
      }
      
      // Handle additional images with size validation
      const imageFiles = formData.getAll("images") as File[];
      for (const imageFile of imageFiles) {
        if (imageFile instanceof File && imageFile.size > 0) {
          if (imageFile.size > MAX_FILE_SIZE) {
            return NextResponse.json({ 
              error: "File too large",
              details: `Image ${imageFile.name} exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`
            }, { status: 400 });
          }
          
          totalFileSize += imageFile.size;
          if (totalFileSize > MAX_TOTAL_SIZE) {
            return NextResponse.json({ 
              error: "Total file size too large",
              details: `Total image size exceeds ${MAX_TOTAL_SIZE / (1024 * 1024)}MB limit`
            }, { status: 400 });
          }
          
          try {
            const imageUrl = await uploadToSupabase("destinations", imageFile);
            uploadedImages.push(imageUrl);
            const urlParts = imageUrl.split(`/storage/v1/object/public/destinations/`);
            const filePath = urlParts.length > 1 ? urlParts[1] : imageFile.name;
            imagesMeta.push({
              url: imageUrl,
              bucket: "destinations",
              filename: imageFile.name,
              filePath,
              fileSize: imageFile.size,
              mimeType: imageFile.type,
              isHero: false,
              displayOrder: imagesMeta.length, // after hero (if any)
            });
          } catch (uploadError) {
            console.error("Error uploading additional image:", uploadError);
            // Continue with other images even if one fails
          }
        }
      }
    } else {
      // Handle JSON
      const body = await request.json();
      name = body.name;
      slug = body.slug;
      tagline = body.tagline || "";
      description = body.description;
      isPublished = body.isPublished ?? false;
      heroImage = body.heroImage || null;
      uploadedImages = body.images || [];
      // Prefer explicit image metadata from client (signed-upload flow)
      if (Array.isArray(body.imagesMeta)) {
        imagesMeta = body.imagesMeta
          .filter((img: any) => img && typeof img.url === "string")
          .map((img: any, index: number) => ({
            url: img.url,
            bucket: "destinations" as const,
            filename: String(img.filename || `image-${index}`),
            filePath: String(img.filePath || ""),
            fileSize: Number(img.fileSize || 0),
            mimeType: String(img.mimeType || "application/octet-stream"),
            isHero: Boolean(img.isHero),
            displayOrder: Number.isFinite(img.displayOrder) ? Number(img.displayOrder) : index,
          }));
      }
    }

    // Character limits to prevent 413 errors
    const MAX_DESCRIPTION_LENGTH = 5000;
    const MAX_NAME_LENGTH = 200;
    const MAX_SLUG_LENGTH = 100;
    const MAX_TAGLINE_LENGTH = 200;

    // Validate required fields
    if (!name || !slug || !description) {
      return NextResponse.json({ 
        error: "Missing required fields",
        details: "Name, slug, and description are required"
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

    if (tagline.length > MAX_TAGLINE_LENGTH) {
      return NextResponse.json({ 
        error: "Tagline too long",
        details: `Tagline must be less than ${MAX_TAGLINE_LENGTH} characters`
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
        details: "Slug must be lowercase alphanumeric with hyphens only (e.g., 'maasai-mara')"
      }, { status: 400 });
    }

    // Create destination with slug de-duplication (race-safe)
    const baseSlug = slug;
    let destination: any | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const trySlug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt}`;

    // Use hero image if provided, otherwise empty string (no default fallback)
    const heroImageUrl = heroImage || "";
    // Use uploaded images if any, otherwise empty array (no default fallback)
    const finalImages = uploadedImages.length > 0 ? uploadedImages : [];

    // Truncate fields to limits before saving
    const truncatedName = name.substring(0, MAX_NAME_LENGTH);
    const truncatedSlug = slug.substring(0, MAX_SLUG_LENGTH);
    const truncatedTagline = tagline.substring(0, MAX_TAGLINE_LENGTH);
    const truncatedDescription = description.substring(0, MAX_DESCRIPTION_LENGTH);

    try {
      destination = await prisma.destination.create({
        data: {
          name: truncatedName,
          slug: trySlug.substring(0, MAX_SLUG_LENGTH),
          tagline: truncatedTagline,
          description: truncatedDescription,
          heroImage: heroImageUrl,
          images: finalImages,
          location: {
            country: "Kenya",
            region: name,
            coordinates: { lat: 0, lng: 0 },
          },
          overview: {
            title: "Overview",
            content: truncatedDescription,
          },
          wildlife: {
            title: "Wildlife",
            description: "Discover amazing wildlife",
            animals: [],
          },
          bestTimeToVisit: {
            title: "Best Time to Visit",
            description: "Year-round destination",
            seasons: [],
          },
          thingsToKnow: {
            title: "Things to Know",
            items: [],
          },
          whatToPack: {
            title: "What to Pack",
            categories: [],
          },
          accommodation: {
            title: "Accommodation",
            description: "Various accommodation options available",
            types: [],
          },
          activities: {
            title: "Activities",
            list: [],
          },
          highlights: [],
          funFacts: [],
          isPublished,
          createdBy: session.user.id,
        },
      });

      // Create Image rows (best-effort). If missing metadata, we still keep legacy fields.
      if (destination?.id && imagesMeta.length > 0) {
        // Ensure destinationId set
        await createImages(
          imagesMeta.map((img, idx) => ({
            ...img,
            bucket: "destinations",
            destinationId: destination.id,
            isHero: img.isHero ?? idx === 0,
            displayOrder: img.displayOrder ?? idx,
          }))
        );
      }

      // success
      slug = destination.slug;
      break;
    } catch (dbError) {
      const code = (dbError as any)?.code;
      if (code === "P2002" && attempt < 4) {
        continue; // try next slug
      }
      if (dbError instanceof Error) {
        console.error("Prisma error creating destination:", dbError.message, dbError.stack);
      } else {
        console.error("Prisma error creating destination:", dbError);
      }
      return NextResponse.json(
        {
          error: code === "P2002" ? "Duplicate slug" : "Database error",
          details: dbError instanceof Error ? dbError.message : "Unknown error",
        },
        { status: code === "P2002" ? 409 : 500 }
      );
    }
    }

    if (!destination) {
      return NextResponse.json(
        { error: "Failed to create destination" },
        { status: 500 }
      );
    }

    // Revalidate cache
    revalidateTag('destinations');
    revalidateTag(`destination-${slug}`);

    return NextResponse.json({ success: true, destination }, { status: 201 });
  } catch (error) {
    // General error logging
    if (error instanceof Error) {
      console.error("Error creating destination:", error.message, error.stack);
    } else {
      console.error("Error creating destination:", error);
    }
    return NextResponse.json(
      { error: "Failed to create destination", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
