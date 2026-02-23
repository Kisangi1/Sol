"use client";

import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Eye, EyeOff, X, Upload } from "lucide-react";
import { toast } from "sonner";
import { uploadFilesViaSignedUrls } from "@/lib/uploads/signedUploadClient";

interface Package {
  id: string;
  name: string;
  slug: string;
  packageType: string;
  description: string;
  pricing: number;
  daysOfTravel: number;
  images: string[];
  isActive: boolean;
    createdAt?: string; // Optional for backward compatibility
    updatedAt?: string; // Optional for backward compatibility
    admin?: { // Optional for backward compatibility
      name?: string; // Optional for backward compatibility
      email?: string; // Optional for backward compatibility
    };
}

interface PackagesManagerProps {
  packages: Package[];
}

export default function PackagesManager({
  packages: initialPackages,
}: PackagesManagerProps) {
  const [packages, setPackages] = useState(initialPackages);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [imageFiles, setImageFiles] = useState<FileList | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    packageType: "safari",
    description: "",
    pricing: 0,
    daysOfTravel: 1,
    isActive: true,
  });
  
  // Character limits
  const MAX_DESCRIPTION_LENGTH = 5000; // 5KB limit to prevent 413 errors
  const MAX_NAME_LENGTH = 200;
  const MAX_SLUG_LENGTH = 100;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    if (formData.description.length > MAX_DESCRIPTION_LENGTH) {
      toast.error(`Description must be less than ${MAX_DESCRIPTION_LENGTH} characters`);
      return;
    }

    if (formData.pricing <= 0) {
      toast.error("Pricing must be greater than 0");
      return;
    }

    if (formData.daysOfTravel < 1) {
      toast.error("Days of travel must be at least 1");
      return;
    }

    // Validate slug format
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugRegex.test(formData.slug)) {
      toast.error("Slug must be lowercase alphanumeric with hyphens only (e.g., 'ultimate-safari')");
      return;
    }

    // Require at least 1 image for packages
    if (!imageFiles || imageFiles.length === 0) {
      toast.error("Please add at least one package image");
      return;
    }

    // Validate file sizes (client UX only; actual uploads go directly to Supabase)
    const files = Array.from(imageFiles);
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
    for (const f of files) {
      if (f.size > MAX_FILE_SIZE) {
        toast.error(`Image ${f.name} is too large (max 10MB per file)`);
        return;
      }
    }

    try {
      const folder = `packages/${formData.slug}`
        .replace(/[^a-z0-9/-]/gi, "-")
        .replace(/-+/g, "-");
      const uploads = await uploadFilesViaSignedUrls({
        bucket: "packages",
        folder,
        files,
      });

      const imagesMeta = uploads.map((u, idx) => {
        const f = files[idx];
        return {
          url: u.publicUrl,
          bucket: "packages",
          filename: f?.name || u.filename,
          filePath: u.path,
          fileSize: f?.size || 0,
          mimeType: f?.type || u.contentType,
          isHero: idx === 0,
          displayOrder: idx,
        };
      });

      const response = await fetch("/api/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim().substring(0, MAX_NAME_LENGTH),
          slug: formData.slug.trim().toLowerCase().substring(0, MAX_SLUG_LENGTH),
          packageType: formData.packageType,
          description: formData.description.trim().substring(0, MAX_DESCRIPTION_LENGTH),
          pricing: formData.pricing,
          daysOfTravel: formData.daysOfTravel,
          isActive: formData.isActive,
          images: uploads.map((u) => u.publicUrl),
          imagesMeta,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const newPackage = result.package || result;
        setPackages([newPackage, ...packages]);
        toast.success("Package created successfully");
        resetForm();
      } else {
        const errorData = await response.json().catch(() => ({ error: "Failed to create package" }));
        toast.error(errorData.error || errorData.details || "Failed to create package");
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error(error instanceof Error ? error.message : "An error occurred");
    }
  };

  const handleEdit = async () => {
    if (!editingPackage) return;

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

    if (formData.description.length > MAX_DESCRIPTION_LENGTH) {
      toast.error(`Description must be less than ${MAX_DESCRIPTION_LENGTH} characters`);
      return;
    }

    if (formData.pricing <= 0) {
      toast.error("Pricing must be greater than 0");
      return;
    }

    if (formData.daysOfTravel < 1) {
      toast.error("Days of travel must be at least 1");
      return;
    }

    // Validate slug format
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugRegex.test(formData.slug)) {
      toast.error("Slug must be lowercase alphanumeric with hyphens only (e.g., 'ultimate-safari')");
      return;
    }

    // If images are selected during edit, we replace package images with the new set
    let images: string[] | undefined;
    let imagesMeta: any[] | undefined;

    if (imageFiles && imageFiles.length > 0) {
      const files = Array.from(imageFiles);
      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
      for (const f of files) {
        if (f.size > MAX_FILE_SIZE) {
          toast.error(`Image ${f.name} is too large (max 10MB per file)`);
          return;
        }
      }

      const folder = `packages/${formData.slug}`
        .replace(/[^a-z0-9/-]/gi, "-")
        .replace(/-+/g, "-");
      const uploads = await uploadFilesViaSignedUrls({
        bucket: "packages",
        folder,
        files,
      });
      images = uploads.map((u) => u.publicUrl);
      imagesMeta = uploads.map((u, idx) => {
        const f = files[idx];
        return {
          url: u.publicUrl,
          bucket: "packages",
          filename: f?.name || u.filename,
          filePath: u.path,
          fileSize: f?.size || 0,
          mimeType: f?.type || u.contentType,
          isHero: idx === 0,
          displayOrder: idx,
        };
      });
    }

    try {
      const response = await fetch(`/api/packages/${editingPackage.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim().substring(0, MAX_NAME_LENGTH),
          slug: formData.slug.trim().toLowerCase().substring(0, MAX_SLUG_LENGTH),
          packageType: formData.packageType,
          description: formData.description.trim().substring(0, MAX_DESCRIPTION_LENGTH),
          pricing: formData.pricing,
          daysOfTravel: formData.daysOfTravel,
          isActive: formData.isActive,
          ...(images ? { images } : {}),
          ...(imagesMeta ? { imagesMeta } : {}),
        }),
      });

      if (response.ok) {
        const updatedPackage = await response.json();
        setPackages(
          packages.map((p) => (p.id === updatedPackage.id ? updatedPackage : p))
        );
        setEditingPackage(null);
        setIsEditDialogOpen(false);
        toast.success("Package updated successfully");
        resetForm();
      } else {
        const errorData = await response.json().catch(() => ({ error: "Failed to update package" }));
        toast.error(errorData.error || errorData.details || "Failed to update package");
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("An error occurred");
    }
  };

  const openEditDialog = (pkg: Package) => {
    setEditingPackage(pkg);
    setFormData({
      name: pkg.name,
      slug: pkg.slug,
      packageType: pkg.packageType,
      description: pkg.description,
      pricing: pkg.pricing,
      daysOfTravel: pkg.daysOfTravel,
      isActive: pkg.isActive,
    });
    setImageFiles(null);
    setIsEditDialogOpen(true);
  };

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("Are you sure you want to delete this package?")) return;

    try {
      const response = await fetch(`/api/packages/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setPackages((prev) => prev.filter((p) => p.id !== id));
        toast.success("Package deleted successfully");
      } else {
        toast.error("Failed to delete package");
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("An error occurred");
    }
  }, []);

  const toggleActive = useCallback(async (pkg: Package) => {
    try {
      const response = await fetch(`/api/packages/${pkg.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...pkg,
          isActive: !pkg.isActive,
        }),
      });

      if (response.ok) {
        const updated = await response.json();
        setPackages((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        toast.success(
          `Package ${updated.isActive ? "activated" : "deactivated"}`
        );
      } else {
        toast.error("Failed to update package");
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
      packageType: "safari",
      description: "",
      pricing: 0,
      daysOfTravel: 1,
      isActive: true,
    });
    setImageFiles(null);
  };

  const FormFields = () => (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-medium text-gray-200">
            Package Name * ({formData.name.length}/{MAX_NAME_LENGTH})
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
            placeholder="Enter package name"
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
            placeholder="e.g., ultimate-safari-experience"
            maxLength={MAX_SLUG_LENGTH}
          />
        </div>
      </div>
      
      <div>
        <Label className="text-sm font-medium text-gray-200">Package Type *</Label>
        <Select
          value={formData.packageType}
          onValueChange={(value) =>
            setFormData({ ...formData, packageType: value })
          }
        >
          <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
            <SelectValue placeholder="Select package type" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
            <SelectItem value="safari">Safari</SelectItem>
            <SelectItem value="beach">Beach</SelectItem>
            <SelectItem value="cultural">Cultural</SelectItem>
            <SelectItem value="adventure">Adventure</SelectItem>
            <SelectItem value="luxury">Luxury</SelectItem>
            <SelectItem value="mixed">Mixed</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <Label className="text-sm font-medium text-gray-200">
          Description * ({formData.description.length}/{MAX_DESCRIPTION_LENGTH} characters)
        </Label>
        <Textarea
          placeholder="Detailed description of the package"
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
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-medium text-gray-200">Pricing ($) *</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={formData.pricing}
            onChange={(e) =>
              setFormData({
                ...formData,
                pricing: Number(e.target.value),
              })
            }
            className="bg-zinc-800 border-zinc-700 text-white placeholder:text-gray-500"
            placeholder="0.00"
          />
        </div>
        <div>
          <Label className="text-sm font-medium text-gray-200">Days of Travel *</Label>
          <Input
            type="number"
            min="1"
            value={formData.daysOfTravel}
            onChange={(e) =>
              setFormData({
                ...formData,
                daysOfTravel: Number(e.target.value),
              })
            }
            className="bg-zinc-800 border-zinc-700 text-white placeholder:text-gray-500"
            placeholder="1"
          />
        </div>
      </div>
      
      <div>
        <Label className="text-sm font-medium text-gray-200">Package Images</Label>
        <div className="relative">
          <Input
            type="file"
            multiple
            accept="image/*"
            onChange={handleImageChange}
            className="bg-zinc-800 border-zinc-700 text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-orange-500 file:text-white hover:file:bg-orange-600"
          />
        </div>
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
          id="isActive"
          checked={formData.isActive}
          onChange={(e) =>
            setFormData({ ...formData, isActive: e.target.checked })
          }
          className="w-4 h-4"
        />
        <Label htmlFor="isActive">Active</Label>
      </div>
    </>
  );

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 px-2 sm:px-4 md:px-6 lg:px-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 md:gap-8 py-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-white">Packages</h2>
          <p className="text-sm text-gray-400 mt-1">Manage your tour packages</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Link href="/the-sol/dashboard/packages/add">
            <Button className="bg-orange-500 hover:bg-orange-600 w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Add New Package 
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {packages.map((pkg) => (
          <div
            key={pkg.id}
            className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 sm:p-6 hover:border-zinc-700 transition-colors flex flex-col justify-between min-h-[180px]"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <h3 className="text-xl font-bold">{pkg.name}</h3>
                  <span className="px-2 py-1 bg-orange-500/20 text-orange-500 text-xs rounded uppercase">
                    {pkg.packageType}
                  </span>
                  {pkg.isActive ? (
                    <span className="px-2 py-1 bg-green-500/20 text-green-500 text-xs rounded">
                      Active
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-gray-500/20 text-gray-500 text-xs rounded">
                      Inactive
                    </span>
                  )}
                </div>
                <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                  {pkg.description}
                </p>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-orange-500 font-bold">
                    ${pkg.pricing}
                  </span>
                  <span className="text-gray-500">•</span>
                  <span className="text-gray-400">{pkg.daysOfTravel} days</span>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4 sm:mt-0 ml-0 sm:ml-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleActive(pkg)}
                  className="text-gray-400 hover:text-orange-500"
                >
                  {pkg.isActive ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openEditDialog(pkg)}
                  className="text-gray-400 hover:text-orange-500"
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(pkg.id)}
                  className="text-gray-400 hover:text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}

        {packages.length === 0 && (
          <div className="text-center py-12 text-gray-500 col-span-full">
            <p>No packages yet. Create your first one!</p>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Package</DialogTitle>
            <DialogDescription className="text-gray-400">
              Update package details. Changes will be saved immediately.
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
                setEditingPackage(null);
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