"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/admin/auth-guard";
import { toast } from "sonner";

// Character limits to prevent 413 errors
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_NAME_LENGTH = 200;
const MAX_SLUG_LENGTH = 100;

function AddPackageForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    packageType: "safari",
    description: "",
    pricing: "",
    daysOfTravel: "",
    isActive: true,
  });
  const [imageFiles, setImageFiles] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(false);

  const handleImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setImageFiles(e.target.files);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Validate required fields
      if (!formData.name.trim() || !formData.slug.trim() || !formData.description.trim() || !formData.pricing || !formData.daysOfTravel) {
        toast.error("Please fill in all required fields");
        setLoading(false);
        return;
      }

      // Validate character limits
      if (formData.name.length > MAX_NAME_LENGTH) {
        toast.error(`Name must be less than ${MAX_NAME_LENGTH} characters`);
        setLoading(false);
        return;
      }

      if (formData.slug.length > MAX_SLUG_LENGTH) {
        toast.error(`Slug must be less than ${MAX_SLUG_LENGTH} characters`);
        setLoading(false);
        return;
      }

      if (formData.description.length > MAX_DESCRIPTION_LENGTH) {
        toast.error(`Description must be less than ${MAX_DESCRIPTION_LENGTH} characters`);
        setLoading(false);
        return;
      }

      // Validate slug format
      const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
      if (!slugRegex.test(formData.slug)) {
        toast.error("Slug must be lowercase alphanumeric with hyphens only");
        setLoading(false);
        return;
      }

      // Validate pricing
      const pricing = parseFloat(formData.pricing);
      if (isNaN(pricing) || pricing <= 0) {
        toast.error("Pricing must be a positive number");
        setLoading(false);
        return;
      }

      // Validate days of travel
      const daysOfTravel = parseInt(formData.daysOfTravel);
      if (isNaN(daysOfTravel) || daysOfTravel < 1) {
        toast.error("Days of travel must be at least 1");
        setLoading(false);
        return;
      }

      // Validate file sizes - use for...of so return actually stops execution
      let totalFileSize = 0;
      const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB per file (Vercel limit safety)
      const MAX_TOTAL_SIZE = 4 * 1024 * 1024; // 4MB total (Vercel limit safety)

      if (imageFiles) {
        // Check each file individually first
        for (const file of Array.from(imageFiles)) {
          if (file.size > MAX_FILE_SIZE) {
            toast.error(`Image ${file.name} is too large (max 4MB per file)`);
            setLoading(false);
            return; // Stop execution immediately
          }
          totalFileSize += file.size;
        }
        // Check total size
        if (totalFileSize > MAX_TOTAL_SIZE) {
          toast.error("Total image size must be less than 4MB (Vercel limit)");
          setLoading(false);
          return; // Stop execution immediately
        }
      }

      // Use FormData instead of JSON to avoid base64 size issues
      const formDataToSend = new FormData();
      formDataToSend.append("name", formData.name.trim().substring(0, MAX_NAME_LENGTH));
      formDataToSend.append("slug", formData.slug.trim().toLowerCase().substring(0, MAX_SLUG_LENGTH));
      formDataToSend.append("packageType", formData.packageType);
      formDataToSend.append("description", formData.description.trim().substring(0, MAX_DESCRIPTION_LENGTH));
      formDataToSend.append("pricing", pricing.toString());
      formDataToSend.append("daysOfTravel", daysOfTravel.toString());
      formDataToSend.append("isActive", formData.isActive.toString());

      // Only append files that passed validation
      if (imageFiles) {
        for (const file of Array.from(imageFiles)) {
          if (file.size > 0 && file.size <= 5 * 1024 * 1024) {
            formDataToSend.append("images", file);
          }
        }
      }

      const response = await fetch("/api/packages", {
        method: "POST",
        body: formDataToSend,
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Package created successfully!");
        router.replace("/the-sol/dashboard/packages");
      } else {
        console.error("Error response:", data);
        if (response.status === 413) {
          toast.error("Request too large. Please reduce image sizes or description length.");
        } else {
          toast.error(data.error || data.details || "Failed to create package");
        }
      }
    } catch (error) {
      console.error("Error creating package:", error);
      toast.error("An error occurred while creating the package");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-white">Add New Package</h1>
      
      <form onSubmit={handleSubmit} className="space-y-6 bg-zinc-900 p-6 rounded-lg border border-zinc-800">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium text-gray-200">
              Package Name * ({formData.name.length}/{MAX_NAME_LENGTH})
            </Label>
            <Input
              value={formData.name}
              onChange={(e) => {
                const name = e.target.value;
                if (name.length <= MAX_NAME_LENGTH) {
                  setFormData({ ...formData, name });
                  // Auto-generate slug if slug is empty or matches the previous auto-generated slug
                  if (!formData.slug || formData.slug === formData.name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')) {
                    const slug = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
                    setFormData({ ...formData, name, slug });
                  }
                }
              }}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-gray-500"
              placeholder="Enter package name"
              maxLength={MAX_NAME_LENGTH}
              required
            />
          </div>
          
          <div>
            <Label className="text-sm font-medium text-gray-200">
              Slug * ({formData.slug.length}/{MAX_SLUG_LENGTH})
            </Label>
            <Input
              value={formData.slug}
              onChange={(e) => {
                const slug = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
                if (slug.length <= MAX_SLUG_LENGTH) {
                  setFormData({ ...formData, slug });
                }
              }}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-gray-500"
              placeholder="e.g., safari-adventure"
              maxLength={MAX_SLUG_LENGTH}
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Auto-formatted: lowercase with hyphens
            </p>
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium text-gray-200">Pricing ($) *</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={formData.pricing}
              onChange={(e) => setFormData({ ...formData, pricing: e.target.value })}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-gray-500"
              placeholder="e.g., 1500"
              required
            />
          </div>
          
          <div>
            <Label className="text-sm font-medium text-gray-200">Days of Travel *</Label>
            <Input
              type="number"
              min="1"
              value={formData.daysOfTravel}
              onChange={(e) => setFormData({ ...formData, daysOfTravel: e.target.value })}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-gray-500"
              placeholder="e.g., 5"
              required
            />
          </div>
        </div>

        <div>
          <Label className="text-sm font-medium text-gray-200">
            Description * ({formData.description.length}/{MAX_DESCRIPTION_LENGTH} characters)
          </Label>
          <Textarea
            value={formData.description}
            onChange={(e) => {
              const value = e.target.value;
              if (value.length <= MAX_DESCRIPTION_LENGTH) {
                setFormData({ ...formData, description: value });
              }
            }}
            className="bg-zinc-800 border-zinc-700 text-white placeholder:text-gray-500 resize-none min-h-[120px]"
            placeholder="Detailed description of the package"
            maxLength={MAX_DESCRIPTION_LENGTH}
            required
          />
          {formData.description.length > MAX_DESCRIPTION_LENGTH * 0.9 && (
            <p className="text-xs text-orange-500 mt-1">
              Warning: Approaching character limit
            </p>
          )}
        </div>

        <div>
          <Label className="text-sm font-medium text-gray-200">Package Images</Label>
          <Input
            type="file"
            multiple
            accept="image/*"
            onChange={handleImagesChange}
            className="bg-zinc-800 border-zinc-700 text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-orange-500 file:text-white hover:file:bg-orange-600"
          />
          <p className="text-xs text-gray-500 mt-1">
            {imageFiles 
              ? `${imageFiles.length} file(s) selected (max 4MB total)` 
              : "Select one or multiple images (max 4MB total)"}
          </p>
          {imageFiles && Array.from(imageFiles).some(f => f.size > 4 * 1024 * 1024) && (
            <p className="text-xs text-red-500 mt-1">
              ⚠️ Some files exceed 4MB limit
            </p>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="isActive"
            checked={formData.isActive}
            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
            className="w-4 h-4 rounded border-zinc-700 bg-zinc-800"
          />
          <Label htmlFor="isActive" className="text-gray-200">Active</Label>
        </div>

        <div className="flex gap-3 pt-2">
          <Button 
            type="submit" 
            className="bg-orange-500 hover:bg-orange-600 text-white" 
            disabled={loading}
          >
            {loading ? "Creating..." : "Create Package"}
          </Button>
          <Button 
            type="button" 
            variant="ghost" 
            onClick={() => router.back()}
            className="text-gray-300 hover:text-white"
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function AddPackagePage() {
  return (
    <AuthGuard>
      <AddPackageForm />
    </AuthGuard>
  );
}