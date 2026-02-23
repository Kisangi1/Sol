import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { deleteFromSupabase } from "@/lib/supabase";
import { createImages } from "@/lib/dal/images";
import { revalidateTag } from "next/cache";

// GET single package by ID
export async function GET(request: NextRequest, context: any) {
  try {
    const params = context?.params ? await context.params : {};
    const packageData = await prisma.package.findUnique({
      where: { id: params.id },
    });

    if (!packageData) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }

    return NextResponse.json(packageData);
  } catch (error) {
    console.error("Error fetching package:", error);
    return NextResponse.json(
      { error: "Failed to fetch package" },
      { status: 500 }
    );
  }
}

// PUT update package (admin only)
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

    // Get existing package
    const existingPackage = await prisma.package.findUnique({
      where: { id: params.id },
    });

    if (!existingPackage) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
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
      keys.length === 1 && typeof body.isActive === "boolean";

    if (isToggleOnly) {
      const packageData = await prisma.package.update({
        where: { id: params.id },
        data: { isActive: body.isActive },
      });

      // Revalidate cache
      revalidateTag('packages');
      revalidateTag(`package-${packageData.slug}`);

      return NextResponse.json(packageData);
    }

    // Full update (expects images already uploaded to Supabase)
    const name = (body.name ?? existingPackage.name) as string;
    const slug = (body.slug ?? existingPackage.slug) as string;
    const packageType = (body.packageType ?? existingPackage.packageType) as string;
    const description = (body.description ?? existingPackage.description) as string;
    const pricing = Number(body.pricing ?? existingPackage.pricing);
    const daysOfTravel = Number(body.daysOfTravel ?? existingPackage.daysOfTravel);
    const isActive = Boolean(body.isActive ?? existingPackage.isActive);

    const images = Array.isArray(body.images) ? body.images : existingPackage.images;

    // Optional imagesMeta: if provided, we replace Image rows for this package
    const imagesMeta = Array.isArray(body.imagesMeta) ? body.imagesMeta : null;

    // Attempt slug update with de-duplication if slug changed
    const baseSlug = slug;
    let updated: any | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const trySlug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt}`;
      try {
        updated = await prisma.package.update({
          where: { id: params.id },
          data: {
            name,
            slug: trySlug,
            packageType,
            description,
            pricing,
            daysOfTravel,
            images,
            isActive,
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
        { error: "Failed to update package" },
        { status: 500 }
      );
    }

    if (imagesMeta) {
      try {
        await prisma.image.deleteMany({ where: { packageId: params.id } });
        await createImages(
          imagesMeta.map((img: any, idx: number) => ({
            url: String(img.url),
            bucket: "packages",
            filename: String(img.filename || `image-${idx}`),
            filePath: String(img.filePath || ""),
            fileSize: Number(img.fileSize || 0),
            mimeType: String(img.mimeType || "application/octet-stream"),
            isHero: Boolean(img.isHero ?? idx === 0),
            displayOrder: Number.isFinite(img.displayOrder)
              ? Number(img.displayOrder)
              : idx,
            packageId: params.id,
          }))
        );
      } catch (e) {
        console.error("Error syncing package image records:", e);
      }
    }

    // Revalidate cache
    revalidateTag("packages");
    revalidateTag(`package-${updated.slug}`);

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating package:", error);
    return NextResponse.json(
      { error: "Failed to update package", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// DELETE package (admin only)
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

    // Get package to delete images
    const packageData = await prisma.package.findUnique({
      where: { id: params.id },
    });

    if (packageData) {
      // Delete images from Supabase
      try {
        if (packageData.images && Array.isArray(packageData.images)) {
          for (const imageUrl of packageData.images) {
            if (imageUrl && imageUrl.includes('supabase.co')) {
              const imagePath = imageUrl.split('/storage/v1/object/public/packages/')[1];
              if (imagePath) {
                try {
                  await deleteFromSupabase("packages", imagePath);
                } catch (deleteError) {
                  console.error("Error deleting package image:", deleteError);
                  // Continue deleting other images
                }
              }
            }
          }
        }
      } catch (imageDeleteError) {
        console.error("Error deleting package images:", imageDeleteError);
        // Continue with database deletion even if image deletion fails
      }
    }

    await prisma.package.delete({
      where: { id: params.id },
    });

    // Revalidate cache
    revalidateTag('packages');
    if (packageData) {
      revalidateTag(`package-${packageData.slug}`);
    }

    return NextResponse.json({ message: "Package deleted" });
  } catch (error) {
    console.error("Error deleting package:", error);
    return NextResponse.json(
      { error: "Failed to delete package" },
      { status: 500 }
    );
  }
}
