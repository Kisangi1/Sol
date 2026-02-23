// Ensure this file is treated as a module
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { deleteFromSupabase } from "@/lib/supabase";
import { createImages } from "@/lib/dal/images";
import { revalidateTag } from "next/cache";

// GET single destination by ID

export async function GET(request: NextRequest, context: any) {
  try {
    const params = context?.params ? await context.params : {};
    const destination = await prisma.destination.findUnique({
      where: { id: params.id },
    });

    if (!destination) {
      return NextResponse.json(
        { error: "Destination not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(destination);
  } catch (error) {
    console.error("Error fetching destination:", error);
    return NextResponse.json(
      { error: "Failed to fetch destination" },
      { status: 500 }
    );
  }
}

// PUT update destination (admin only)

export async function PUT(request: NextRequest, context: any) {
  try {
    const params = context?.params ? await context.params : {};
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

    // Get existing destination
    const existingDestination = await prisma.destination.findUnique({
      where: { id: params.id },
    });

    if (!existingDestination) {
      return NextResponse.json({ error: "Destination not found" }, { status: 404 });
    }

    const contentType = request.headers.get("content-type");
    
    if (!contentType?.includes("application/json")) {
      return NextResponse.json(
        { error: "Unsupported content type", details: "Use JSON + signed uploads" },
        { status: 415 }
      );
    }

    const body = await request.json();
    const keys = Object.keys(body || {});
    const isToggleOnly =
      keys.length === 1 && typeof body.isPublished === "boolean";

    if (isToggleOnly) {
      const destination = await prisma.destination.update({
        where: { id: params.id },
        data: { isPublished: body.isPublished },
      });

      // Revalidate cache
      revalidateTag('destinations');
      revalidateTag(`destination-${destination.slug}`);

      return NextResponse.json(destination);
    }

    // Full update (expects images already uploaded to Supabase)
    const name = (body.name ?? existingDestination.name) as string;
    const slug = (body.slug ?? existingDestination.slug) as string;
    const tagline = (body.tagline ?? existingDestination.tagline) as string;
    const description = (body.description ?? existingDestination.description) as string;
    const isPublished = Boolean(body.isPublished ?? existingDestination.isPublished);
    const heroImage = String(body.heroImage ?? existingDestination.heroImage ?? "");
    const images = Array.isArray(body.images) ? body.images : existingDestination.images;
    const imagesMeta = Array.isArray(body.imagesMeta) ? body.imagesMeta : null;

    // Attempt slug update with de-duplication if needed
    const baseSlug = slug;
    let updated: any | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const trySlug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt}`;
      try {
        updated = await prisma.destination.update({
          where: { id: params.id },
          data: {
            name,
            slug: trySlug,
            tagline,
            description,
            heroImage,
            images,
            isPublished,
            // Keep existing complex fields
            location: existingDestination.location as any,
            overview: { title: "Overview", content: description } as any,
            wildlife: existingDestination.wildlife as any,
            bestTimeToVisit: existingDestination.bestTimeToVisit as any,
            thingsToKnow: existingDestination.thingsToKnow as any,
            whatToPack: existingDestination.whatToPack as any,
            accommodation: existingDestination.accommodation as any,
            activities: existingDestination.activities as any,
            highlights: existingDestination.highlights,
            funFacts: existingDestination.funFacts,
          },
        });
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

    if (!updated) {
      return NextResponse.json(
        { error: "Failed to update destination" },
        { status: 500 }
      );
    }

    if (imagesMeta) {
      try {
        await prisma.image.deleteMany({ where: { destinationId: params.id } });
        await createImages(
          imagesMeta.map((img: any, idx: number) => ({
            url: String(img.url),
            bucket: "destinations",
            filename: String(img.filename || `image-${idx}`),
            filePath: String(img.filePath || ""),
            fileSize: Number(img.fileSize || 0),
            mimeType: String(img.mimeType || "application/octet-stream"),
            isHero: Boolean(img.isHero ?? idx === 0),
            displayOrder: Number.isFinite(img.displayOrder)
              ? Number(img.displayOrder)
              : idx,
            destinationId: params.id,
          }))
        );
      } catch (e) {
        console.error("Error syncing destination image records:", e);
      }
    }

    // Revalidate cache
    revalidateTag("destinations");
    revalidateTag(`destination-${updated.slug}`);

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating destination:", error);
    return NextResponse.json(
      { error: "Failed to update destination", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// DELETE destination (admin only)

export async function DELETE(request: NextRequest, context: any) {
  try {
    const params = context?.params ? await context.params : {};
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

    // Get destination to delete images
    const destination = await prisma.destination.findUnique({
      where: { id: params.id },
    });

    if (destination) {
      // Delete images from Supabase
      try {
        // Delete hero image
        if (destination.heroImage && destination.heroImage.includes('supabase.co')) {
          const heroImagePath = destination.heroImage.split('/storage/v1/object/public/destinations/')[1];
          if (heroImagePath) {
            await deleteFromSupabase("destinations", heroImagePath);
          }
        }
        
        // Delete additional images
        if (destination.images && Array.isArray(destination.images)) {
          for (const imageUrl of destination.images) {
            if (imageUrl && imageUrl.includes('supabase.co')) {
              const imagePath = imageUrl.split('/storage/v1/object/public/destinations/')[1];
              if (imagePath) {
                try {
                  await deleteFromSupabase("destinations", imagePath);
                } catch (deleteError) {
                  console.error("Error deleting image:", deleteError);
                  // Continue deleting other images
                }
              }
            }
          }
        }
      } catch (imageDeleteError) {
        console.error("Error deleting destination images:", imageDeleteError);
        // Continue with database deletion even if image deletion fails
      }
    }

    await prisma.destination.delete({
      where: { id: params.id },
    });

    // Revalidate cache
    revalidateTag('destinations');
    if (destination) {
      revalidateTag(`destination-${destination.slug}`);
    }

    return NextResponse.json({ message: "Destination deleted" });
  } catch (error) {
    console.error("Error deleting destination:", error);
    return NextResponse.json(
      { error: "Failed to delete destination" },
      { status: 500 }
    );
  }
}
