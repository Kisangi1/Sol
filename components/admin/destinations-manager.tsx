"use client";

import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Eye, EyeOff, X } from "lucide-react";
import { toast } from "sonner";
import { uploadFilesViaSignedUrls } from "@/lib/uploads/signedUploadClient";

interface Destination {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  heroImage: string;
  images: string[];
  isPublished: boolean;
}

interface DestinationsManagerProps {
  destinations: Destination[];
}

export default function DestinationsManager({
  destinations: initialDestinations,
}: DestinationsManagerProps) {
  const [destinations, setDestinations] = useState(initialDestinations);
  const [editingDestination, setEditingDestination] = useState<Destination | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [heroImageFile, setHeroImageFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<FileList | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    tagline: "",
    description: "",
    isPublished: false,
  });
  
  // Character limits
  const MAX_DESCRIPTION_LENGTH = 5000; // 5KB limit to prevent 413 errors
  const MAX_NAME_LENGTH = 200;
  const MAX_SLUG_LENGTH = 100;
  const MAX_TAGLINE_LENGTH = 200;

  const handleHeroImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setHeroImageFile(e.target.files[0]);
    }
  };

  const handleImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setImageFiles(e.target.files);
    }
  };

  const handleCreate = async () => {
    // Client-side validation
    if (!formData.name.trim() || !formData.slug.trim() || !formData.description.trim()) {
      toast.error("Please fill in all required fields (name, slug, description)");
      return;
    }

    if (formData.name.length > MAX_NAME_LENGTH) {
      toast.error(`Name must be less than ${MAX_NAME_LENGTH} characters`);
      return;
    }

    if (formData.slug.length > MAX_SLUG_LENGTH) {
      toast.error(`Slug must be less than ${MAX_SLUG_LENGTH} characters`);
      return;
    }

    if (formData.tagline.length > MAX_TAGLINE_LENGTH) {
      toast.error(`Tagline must be less than ${MAX_TAGLINE_LENGTH} characters`);
      return;
    }

    if (formData.description.length > MAX_DESCRIPTION_LENGTH) {
      toast.error(`Description must be less than ${MAX_DESCRIPTION_LENGTH} characters`);
      return;
    }

    // Validate slug format
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugRegex.test(formData.slug)) {
      toast.error("Slug must be lowercase alphanumeric with hyphens only (e.g., 'maasai-mara')");
      return;
    }

    // Require hero image for destinations (prevents blank destination cards)
    if (!heroImageFile) {
      toast.error("Please select a hero image");
      return;
    }

    // Validate file sizes (client UX only)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
    if (heroImageFile.size > MAX_FILE_SIZE) {
      toast.error("Hero image must be less than 10MB");
      return;
    }
    if (imageFiles) {
      for (const f of Array.from(imageFiles)) {
        if (f.size > MAX_FILE_SIZE) {
          toast.error(`Image ${f.name} is too large (max 10MB per file)`);
          return;
        }
      }
    }

    try {
      const folder = `destinations/${formData.slug}`
        .replace(/[^a-z0-9/-]/gi, "-")
        .replace(/-+/g, "-");

      const heroUploads = await uploadFilesViaSignedUrls({
        bucket: "destinations",
        folder,
        files: [heroImageFile],
      });
      const hero = heroUploads[0];

      const additionalFiles = imageFiles ? Array.from(imageFiles) : [];
      const additionalUploads =
        additionalFiles.length > 0
          ? await uploadFilesViaSignedUrls({
              bucket: "destinations",
              folder,
              files: additionalFiles,
            })
          : [];

      const imagesMeta = [
        {
          url: hero.publicUrl,
          bucket: "destinations",
          filename: heroImageFile.name,
          filePath: hero.path,
          fileSize: heroImageFile.size,
          mimeType: heroImageFile.type,
          isHero: true,
          displayOrder: 0,
        },
        ...additionalUploads.map((u, idx) => {
          const f = additionalFiles[idx];
          return {
            url: u.publicUrl,
            bucket: "destinations",
            filename: f?.name || u.filename,
            filePath: u.path,
            fileSize: f?.size || 0,
            mimeType: f?.type || u.contentType,
            isHero: false,
            displayOrder: 1 + idx,
          };
        }),
      ];

      const response = await fetch("/api/destinations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim().substring(0, MAX_NAME_LENGTH),
          slug: formData.slug.trim().toLowerCase().substring(0, MAX_SLUG_LENGTH),
          tagline: formData.tagline.trim().substring(0, MAX_TAGLINE_LENGTH),
          description: formData.description.trim().substring(0, MAX_DESCRIPTION_LENGTH),
          isPublished: formData.isPublished,
          heroImage: hero.publicUrl,
          images: additionalUploads.map((u) => u.publicUrl),
          imagesMeta,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const newDestination = result.destination || result;
        setDestinations([newDestination, ...destinations]);
        toast.success("Destination created successfully");
        resetForm();
      } else {
        const errorData = await response.json().catch(() => ({ error: "Failed to create destination" }));
        toast.error(errorData.error || errorData.details || "Failed to create destination");
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error(error instanceof Error ? error.message : "An error occurred");
    }
  };

  const handleEdit = async () => {
    if (!editingDestination) return;

    // Client-side validation
    if (!formData.name.trim() || !formData.slug.trim() || !formData.description.trim()) {
      toast.error("Please fill in all required fields (name, slug, description)");
      return;
    }

    if (formData.name.length > MAX_NAME_LENGTH) {
      toast.error(`Name must be less than ${MAX_NAME_LENGTH} characters`);
      return;
    }

    if (formData.slug.length > MAX_SLUG_LENGTH) {
      toast.error(`Slug must be less than ${MAX_SLUG_LENGTH} characters`);
      return;
    }

    if (formData.tagline.length > MAX_TAGLINE_LENGTH) {
      toast.error(`Tagline must be less than ${MAX_TAGLINE_LENGTH} characters`);
      return;
    }

    if (formData.description.length > MAX_DESCRIPTION_LENGTH) {
      toast.error(`Description must be less than ${MAX_DESCRIPTION_LENGTH} characters`);
      return;
    }

    // Validate slug format
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugRegex.test(formData.slug)) {
      toast.error("Slug must be lowercase alphanumeric with hyphens only (e.g., 'maasai-mara')");
      return;
    }

    // If hero/additional images are selected during edit, we replace destination images with the new set
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
    let heroImage: string | undefined;
    let images: string[] | undefined;
    let imagesMeta: any[] | undefined;

    const folder = `destinations/${formData.slug}`
      .replace(/[^a-z0-9/-]/gi, "-")
      .replace(/-+/g, "-");

    if (heroImageFile || (imageFiles && imageFiles.length > 0)) {
      // If you're changing images, require a new hero image so we can fully sync Image rows
      if (!heroImageFile) {
        toast.error("To change images, please select a new hero image (required)");
        return;
      }

      if (heroImageFile.size > MAX_FILE_SIZE) {
        toast.error("Hero image must be less than 10MB");
        return;
      }
      if (imageFiles) {
        for (const f of Array.from(imageFiles)) {
          if (f.size > MAX_FILE_SIZE) {
            toast.error(`Image ${f.name} is too large (max 10MB per file)`);
            return;
          }
        }
      }

      const heroUploads = await uploadFilesViaSignedUrls({
        bucket: "destinations",
        folder,
        files: [heroImageFile],
      });
      const hero = heroUploads[0];
      heroImage = hero.publicUrl;

      const additionalFiles = imageFiles ? Array.from(imageFiles) : [];
      const additionalUploads =
        additionalFiles.length > 0
          ? await uploadFilesViaSignedUrls({
              bucket: "destinations",
              folder,
              files: additionalFiles,
            })
          : [];

      images = additionalUploads.map((u) => u.publicUrl);

      imagesMeta = [
        {
          url: hero.publicUrl,
          bucket: "destinations",
          filename: heroImageFile.name,
          filePath: hero.path,
          fileSize: heroImageFile.size,
          mimeType: heroImageFile.type,
          isHero: true,
          displayOrder: 0,
        },
        ...additionalUploads.map((u, idx) => {
          const f = additionalFiles[idx];
          return {
            url: u.publicUrl,
            bucket: "destinations",
            filename: f?.name || u.filename,
            filePath: u.path,
            fileSize: f?.size || 0,
            mimeType: f?.type || u.contentType,
            isHero: false,
            displayOrder: 1 + idx,
          };
        }),
      ];
    }

    try {
      const response = await fetch(`/api/destinations/${editingDestination.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim().substring(0, MAX_NAME_LENGTH),
          slug: formData.slug.trim().toLowerCase().substring(0, MAX_SLUG_LENGTH),
          tagline: formData.tagline.trim().substring(0, MAX_TAGLINE_LENGTH),
          description: formData.description.trim().substring(0, MAX_DESCRIPTION_LENGTH),
          isPublished: formData.isPublished,
          ...(heroImage ? { heroImage } : {}),
          ...(images ? { images } : {}),
          ...(imagesMeta ? { imagesMeta } : {}),
        }),
      });

      if (response.ok) {
        const updatedDestination = await response.json();
        setDestinations((prev) =>
          prev.map((d) =>
            d.id === updatedDestination.id ? updatedDestination : d
          )
        );
        setEditingDestination(null);
        setIsEditDialogOpen(false);
        toast.success("Destination updated successfully");
        resetForm();
      } else {
        const errorData = await response.json().catch(() => ({ error: "Failed to update destination" }));
        toast.error(errorData.error || errorData.details || "Failed to update destination");
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("An error occurred");
    }
  };

  const openEditDialog = (destination: Destination) => {
    setEditingDestination(destination);
    setFormData({
      name: destination.name,
      slug: destination.slug,
      tagline: destination.tagline || "",
      description: destination.description,
      isPublished: destination.isPublished,
    });
    setHeroImageFile(null);
    setImageFiles(null);
    setIsEditDialogOpen(true);
  };

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("Are you sure you want to delete this destination?")) return;

    try {
      const response = await fetch(`/api/destinations/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setDestinations((prev) => prev.filter((d) => d.id !== id));
        toast.success("Destination deleted successfully");
      } else {
        toast.error("Failed to delete destination");
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("An error occurred");
    }
  }, []);

  const togglePublish = useCallback(async (destination: Destination) => {
    try {
      const response = await fetch(`/api/destinations/${destination.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...destination,
          isPublished: !destination.isPublished,
        }),
      });

      if (response.ok) {
        const updated = await response.json();
        setDestinations((prev) =>
          prev.map((d) => (d.id === updated.id ? updated : d))
        );
        toast.success(
          `Destination ${updated.isPublished ? "published" : "unpublished"}`
        );
      } else {
        toast.error("Failed to update destination");
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("An error occurred");
    }
  }, []);

  const resetForm = () => {
    setFormData({
      name: "",
      slug: "",
      tagline: "",
      description: "",
      isPublished: false,
    });
    setHeroImageFile(null);
    setImageFiles(null);
  };

  const FormFields = () => (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <Label className="text-sm font-medium text-gray-200">
          Name * ({formData.name.length}/{MAX_NAME_LENGTH})
        </Label>
        <Input
          value={formData.name}
          onChange={(e) => {
            const value = e.target.value;
            if (value.length <= MAX_NAME_LENGTH) {
              setFormData({ ...formData, name: value });
            }
          }}
          className="bg-zinc-800 border-zinc-700 text-white placeholder:text-gray-500"
          placeholder="Enter destination name"
          maxLength={MAX_NAME_LENGTH}
        />
      </div>
      <div>
        <Label className="text-sm font-medium text-gray-200">
          Slug * ({formData.slug.length}/{MAX_SLUG_LENGTH})
        </Label>
        <Input
          value={formData.slug}
          onChange={(e) => {
            const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
            if (value.length <= MAX_SLUG_LENGTH) {
              setFormData({ ...formData, slug: value });
            }
          }}
          className="bg-zinc-800 border-zinc-700 text-white placeholder:text-gray-500"
          placeholder="e.g., maasai-mara"
          maxLength={MAX_SLUG_LENGTH}
        />
      </div>
      </div>

      <div>
        <Label className="text-sm font-medium text-gray-200">
          Tagline ({formData.tagline.length}/{MAX_TAGLINE_LENGTH})
        </Label>
        <Input
          value={formData.tagline}
          onChange={(e) => {
            const value = e.target.value;
            if (value.length <= MAX_TAGLINE_LENGTH) {
              setFormData({ ...formData, tagline: value });
            }
          }}
          className="bg-zinc-800 border-zinc-700 text-white placeholder:text-gray-500"
          placeholder="Short catchy description"
          maxLength={MAX_TAGLINE_LENGTH}
        />
      </div>

      <div>
        <Label className="text-sm font-medium text-gray-200">
          Description * ({formData.description.length}/{MAX_DESCRIPTION_LENGTH} characters)
        </Label>
        <Textarea
          placeholder="Detailed description of the destination"
          className="bg-zinc-800 border-zinc-700 text-white placeholder:text-gray-500 resize-none min-h-[120px]"
          value={formData.description}
          onChange={(e) => {
            const value = e.target.value;
            if (value.length <= MAX_DESCRIPTION_LENGTH) {
              setFormData({ ...formData, description: value });
            }
          }}
          maxLength={MAX_DESCRIPTION_LENGTH}
        />
        {formData.description.length > MAX_DESCRIPTION_LENGTH * 0.9 && (
          <p className="text-xs text-orange-500 mt-1">
            Warning: Approaching character limit
          </p>
        )}
      </div>

      <div>
        <Label className="text-sm font-medium text-gray-200">Hero Image</Label>
        <Input
          type="file"
          accept="image/*"
          onChange={handleHeroImageChange}
          className="bg-zinc-800 border-zinc-700 text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-orange-500 file:text-white hover:file:bg-orange-600"
        />
        <p className="text-xs text-gray-500 mt-1">
          {heroImageFile 
            ? `${heroImageFile.name} (max 5MB)` 
            : "Select a hero image (max 5MB)"}
        </p>
        {heroImageFile && heroImageFile.size > 5 * 1024 * 1024 && (
          <p className="text-xs text-red-500 mt-1">
            ⚠️ File exceeds 5MB limit
          </p>
        )}
      </div>

      <div>
        <Label className="text-sm font-medium text-gray-200">Additional Images</Label>
        <Input
          type="file"
          multiple
          accept="image/*"
          onChange={handleImagesChange}
          className="bg-zinc-800 border-zinc-700 text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-orange-500 file:text-white hover:file:bg-orange-600"
        />
        <p className="text-xs text-gray-500 mt-1">
          {imageFiles 
            ? `${imageFiles.length} file(s) selected (max 5MB per file, 10MB total)` 
            : "Select one or multiple images (max 5MB per file, 10MB total)"}
        </p>
        {imageFiles && Array.from(imageFiles).some(f => f.size > 5 * 1024 * 1024) && (
          <p className="text-xs text-red-500 mt-1">
            ⚠️ Some files exceed 5MB limit
          </p>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="isPublished"
          checked={formData.isPublished}
          onChange={(e) =>
            setFormData({ ...formData, isPublished: e.target.checked })
          }
          className="w-4 h-4"
        />
        <Label htmlFor="isPublished">Published</Label>
      </div>
    </>
  );

  const router = useRouter();
  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 px-2 sm:px-4 md:px-6 lg:px-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 md:gap-8 py-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-white">Destinations</h2>
          <p className="text-sm text-gray-400 mt-1">Manage your travel destinations</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <a href="/the-sol/dashboard/destinations/add">
            <Button className="bg-orange-500 hover:bg-orange-600 w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Add New Destination
            </Button>
          </a>
        </div>
      </div>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {destinations.map((destination) => {
          // Memoize destination card to prevent unnecessary re-renders
          return (
          <div
            key={destination.id}
            className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 sm:p-6 hover:border-zinc-700 transition-colors flex flex-col justify-between min-h-[180px]"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <h3 className="text-xl font-bold">{destination.name}</h3>
                  {destination.isPublished ? (
                    <span className="px-2 py-1 bg-green-500/20 text-green-500 text-xs rounded">
                      Published
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-gray-500/20 text-gray-500 text-xs rounded">
                      Draft
                    </span>
                  )}
                </div>
                {destination.tagline && (
                  <p className="text-orange-500 italic mb-2 text-sm">
                    {destination.tagline}
                  </p>
                )}
                <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                  {destination.description}
                </p>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>Slug: {destination.slug}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4 sm:mt-0 ml-0 sm:ml-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => togglePublish(destination)}
                  className="text-gray-400 hover:text-orange-500"
                >
                  {destination.isPublished ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openEditDialog(destination)}
                  className="text-gray-400 hover:text-orange-500"
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(destination.id)}
                  className="text-gray-400 hover:text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
          );
        })}

        {destinations.length === 0 && (
          <div className="text-center py-12 text-gray-500 col-span-full">
            <p>No destinations yet. Create your first one!</p>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Destination</DialogTitle>
            <DialogDescription className="text-gray-400">
              Update destination details. Changes will be saved immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <FormFields />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setIsEditDialogOpen(false);
                setEditingDestination(null);
                resetForm();
              }}
              className="text-gray-300 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEdit}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}