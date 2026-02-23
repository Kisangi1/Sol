"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/admin/auth-guard";

import { toast } from "sonner";
import { uploadFilesViaSignedUrls } from "@/lib/uploads/signedUploadClient";

function AddDestinationForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    tagline: "",
    description: "",
    isPublished: false,
  });
  const [heroImageFile, setHeroImageFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(false);

  // Constants for validation
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
  const MAX_TOTAL_SIZE = 30 * 1024 * 1024; // 30MB total (client-side UX limit)

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate file sizes
      let totalSize = 0;
      
      if (heroImageFile) {
        if (heroImageFile.size > MAX_FILE_SIZE) {
          toast.error(`Hero image is too large (max 10MB)`);
          setLoading(false);
          return;
        }
        totalSize += heroImageFile.size;
      }

      if (imageFiles) {
        for (const file of Array.from(imageFiles)) {
          if (file.size > MAX_FILE_SIZE) {
            toast.error(`Image ${file.name} is too large (max 10MB)`);
            setLoading(false);
            return;
          }
          totalSize += file.size;
        }
      }

      if (totalSize > MAX_TOTAL_SIZE) {
        toast.error(`Total image size exceeds 30MB limit. Please reduce image sizes or count.`);
        setLoading(false);
        return;
      }

      // Upload images directly to Supabase Storage via signed URLs (best practice on Vercel)
      const folder = `destinations/${formData.slug}`
        .replace(/[^a-z0-9/-]/gi, "-")
        .replace(/-+/g, "-");

      const heroUploads = heroImageFile
        ? await uploadFilesViaSignedUrls({
            bucket: "destinations",
            folder,
            files: [heroImageFile],
          })
        : [];

      const additionalUploads = imageFiles
        ? await uploadFilesViaSignedUrls({
            bucket: "destinations",
            folder,
            files: Array.from(imageFiles),
          })
        : [];

      const hero = heroUploads[0];

      const imagesMeta = [
        ...(hero
          ? [
              {
                url: hero.publicUrl,
                bucket: "destinations",
                filename: heroImageFile?.name || hero.filename,
                filePath: hero.path,
                fileSize: heroImageFile?.size || 0,
                mimeType: heroImageFile?.type || hero.contentType,
                isHero: true,
                displayOrder: 0,
              },
            ]
          : []),
        ...additionalUploads.map((u, idx) => {
          const f = imageFiles ? Array.from(imageFiles)[idx] : undefined;
          return {
            url: u.publicUrl,
            bucket: "destinations",
            filename: f?.name || u.filename,
            filePath: u.path,
            fileSize: f?.size || 0,
            mimeType: f?.type || u.contentType,
            isHero: false,
            displayOrder: (hero ? 1 : 0) + idx,
          };
        }),
      ];

      const response = await fetch("/api/destinations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          slug: formData.slug,
          tagline: formData.tagline,
          description: formData.description,
          isPublished: formData.isPublished,
          heroImage: hero?.publicUrl || "",
          images: additionalUploads.map((u) => u.publicUrl),
          imagesMeta,
        }),
      });
      
      if (response.ok) {
        toast.success("Destination created successfully");
        router.push("/the-sol/dashboard/destinations");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to create destination");
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto py-8 px-4">
      <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-white">Add New Destination</h2>
      <form onSubmit={handleSubmit} className="space-y-6 bg-zinc-900 p-6 rounded-lg border border-zinc-800">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium text-gray-200">Name *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-gray-500"
              placeholder="Enter destination name"
              required
            />
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-200">Slug *</Label>
            <Input
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-gray-500"
              placeholder="e.g., maasai-mara"
              required
            />
          </div>
        </div>
        <div>
          <Label className="text-sm font-medium text-gray-200">Tagline</Label>
          <Input
            value={formData.tagline}
            onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
            className="bg-zinc-800 border-zinc-700 text-white placeholder:text-gray-500"
            placeholder="Short catchy description"
          />
        </div>
        <div>
          <Label className="text-sm font-medium text-gray-200">Description *</Label>
          <Textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Detailed description of the destination"
            className="bg-zinc-800 border-zinc-700 text-white placeholder:text-gray-500 resize-none min-h-[120px]"
            required
          />
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
            {heroImageFile ? heroImageFile.name : "Select a hero image (max 10MB)"}
          </p>
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
            {imageFiles ? `${imageFiles.length} file(s) selected` : "Select one or multiple images (max 30MB total)"}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="isPublished"
            checked={formData.isPublished}
            onChange={(e) => setFormData({ ...formData, isPublished: e.target.checked })}
            className="w-4 h-4"
          />
          <Label htmlFor="isPublished">Published</Label>
        </div>
        <div className="flex gap-3 pt-2">
          <Button type="submit" className="bg-orange-500 hover:bg-orange-600" disabled={loading}>
            {loading ? "Creating..." : "Create Destination"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function AddDestinationPage() {
  return (
    <AuthGuard>
      <AddDestinationForm />
    </AuthGuard>
  );
}
