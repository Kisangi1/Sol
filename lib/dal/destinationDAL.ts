import { prisma } from "@/lib/prisma";
import { Destination, Prisma } from "@prisma/client";

/**
 * Get all destinations optimized for list view
 * Only fetches essential fields for fast loading
 */
export async function getAllDestinations() {
  try {
    return await prisma.destination.findMany({
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
        destinationImages: {
          orderBy: [{ isHero: "desc" }, { displayOrder: "asc" }],
          select: { url: true, isHero: true, displayOrder: true },
        },
        location: true,
        highlights: true,
        isPublished: true,
        // Exclude: overview, wildlife, bestTimeToVisit, thingsToKnow, whatToPack, accommodation, activities, funFacts, createdAt, updatedAt
      },
    });
  } catch (error) {
    console.error("Error fetching destinations:", error);
    return [];
  }
}

export async function getDestinationById(id: string) {
  try {
    return await prisma.destination.findUnique({ where: { id } });
  } catch (error) {
    console.error("Error fetching destination by id:", error);
    return null;
  }
}

export async function createDestination(data: Prisma.DestinationCreateInput) {
  try {
    return await prisma.destination.create({ data });
  } catch (error) {
    console.error("Error creating destination:", error);
    throw error;
  }
}

export async function updateDestination(id: string, data: Prisma.DestinationUpdateInput) {
  try {
    return await prisma.destination.update({ where: { id }, data });
  } catch (error) {
    console.error("Error updating destination:", error);
    throw error;
  }
}

export async function deleteDestination(id: string) {
  try {
    return await prisma.destination.delete({ where: { id } });
  } catch (error) {
    console.error("Error deleting destination:", error);
    throw error;
  }
}
