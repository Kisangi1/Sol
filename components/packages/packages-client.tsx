"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import { PackageCard } from "@/components/shared/package-card";
import {
  PackageFilters,
  type FilterOptions,
} from "@/components/shared/package-filters";
import { Pagination } from "@/components/shared/pagination";
import GrainOverlay from "@/components/shared/grain-overlay";

interface PackagesClientProps {
  packages: any[];
}

export function PackagesClient({ packages: initialPackages }: PackagesClientProps) {
  const [packages, setPackages] = useState(initialPackages || []);
  const [loading, setLoading] = useState((initialPackages || []).length === 0);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<FilterOptions>({
    category: "all",
    priceRange: "all",
    duration: "all",
    sortBy: "popular",
  });

  // Update packages when initialPackages prop changes
  useEffect(() => {
    if (initialPackages && initialPackages.length > 0) {
      setPackages(initialPackages);
      setLoading(false);
    } else if (initialPackages.length === 0 && !loading) {
      // Only fetch if no initial packages provided (fallback for client-side navigation)
      setLoading(true);
      fetch('/api/packages')
        .then(res => {
          if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
          }
          return res.json();
        })
        .then(data => {
          // Ensure data is an array
          if (Array.isArray(data)) {
            setPackages(data);
          } else {
            console.error('Invalid data format received:', data);
            setPackages([]);
          }
        })
        .catch(err => {
          console.error('Failed to fetch packages:', err);
          setPackages([]);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [initialPackages, loading]);

  const packagesPerPage = 9;

  // Memoize filtered packages to avoid recalculating on every render
  const filteredPackages = useMemo(() => {
    const result = packages.filter((pkg) => {
      // Ensure package has required fields
      if (!pkg || !pkg.id || !pkg.name) {
        return false;
      }
      // Category filter
      if (filters.category !== "all") {
        const categoryMap: Record<string, string[]> = {
          wildlife: ["safari"],
          beach: ["beach"],
          adventure: ["adventure"],
          cultural: ["cultural"],
          luxury: ["luxury", "mixed"],
        };

        const allowedTypes = categoryMap[filters.category] || [
          filters.category,
        ];
        if (!allowedTypes.includes(pkg.packageType)) return false;
      }

      // Price range filter
      if (filters.priceRange !== "all") {
        const [min, max] = filters.priceRange.split("-").map(Number);
        if (max) {
          if (pkg.pricing < min || pkg.pricing > max) return false;
        } else {
          if (pkg.pricing < min) return false;
        }
      }

      // Duration filter
      if (filters.duration !== "all") {
        if (filters.duration.includes("+")) {
          const minDays = Number.parseInt(filters.duration, 10);
          if (pkg.daysOfTravel < minDays) return false;
        } else {
          const [minDays, maxDays] = filters.duration.split("-").map(Number);
          if (pkg.daysOfTravel < minDays || pkg.daysOfTravel > maxDays)
            return false;
        }
      }

      return true;
    });

    // Sort packages
    switch (filters.sortBy) {
      case "price-low":
        result.sort((a, b) => a.pricing - b.pricing);
        break;
      case "price-high":
        result.sort((a, b) => b.pricing - a.pricing);
        break;
      case "newest":
        result.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        break;
      case "popular":
      default:
        result.sort((a, b) => (b.currentBookings || 0) - (a.currentBookings || 0));
        break;
    }

    return result;
  }, [packages, filters]);

  // Memoize pagination calculations
  const paginationData = useMemo(() => {
    const totalPages = Math.ceil(filteredPackages.length / packagesPerPage);
    const startIndex = (currentPage - 1) * packagesPerPage;
    const endIndex = startIndex + packagesPerPage;
    const currentPackages = filteredPackages.slice(startIndex, endIndex);
    return { totalPages, startIndex, endIndex, currentPackages };
  }, [filteredPackages, currentPage, packagesPerPage]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleFilterChange = useCallback((newFilters: FilterOptions) => {
    setFilters(newFilters);
    setCurrentPage(1);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white relative overflow-hidden">
        <GrainOverlay />
        <div className="container mx-auto px-4 py-32">
          <div className="animate-pulse space-y-8">
            <div className="h-12 bg-zinc-800 rounded w-1/3"></div>
            <div className="h-6 bg-zinc-800 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!packages || packages.length === 0) {
    return (
      <div className="min-h-screen bg-black text-white relative overflow-hidden">
        <GrainOverlay />
        <div className="container mx-auto px-4 py-32">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">No Packages Found</h1>
            <p className="text-gray-400">Check back soon for amazing tour packages.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Filters Section */}
      <div className="relative px-4 sm:px-6 lg:px-8 pb-8">
        <div className="max-w-[1400px] mx-auto">
          <PackageFilters onFilterChange={handleFilterChange} />
        </div>
      </div>

      {/* Main Content */}
      <div className="relative px-4 sm:px-6 lg:px-8 pb-20">
        <div className="max-w-[1400px] mx-auto space-y-8">
          {/* Results Info */}
          <div className="flex items-center justify-between">
            <p className="text-gray-400">
              Showing{" "}
              <span className="text-white font-semibold">
                {paginationData.currentPackages.length > 0 ? paginationData.startIndex + 1 : 0}-
                {Math.min(paginationData.endIndex, filteredPackages.length)}
              </span>{" "}
              of{" "}
              <span className="text-white font-semibold">
                {filteredPackages.length}
              </span>{" "}
              packages
            </p>
          </div>

          {/* Package Cards Grid */}
          {paginationData.currentPackages.length > 0 ? (
            <div
              key={currentPage}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {paginationData.currentPackages.map((pkg) => (
                <PackageCard key={pkg.id} package={pkg} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-orange-500/10 mb-6">
                <svg
                  className="w-10 h-10 text-orange-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <title>No packages</title>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                No packages found
              </h3>
              <p className="text-gray-400 text-lg">
                Try adjusting your filters
              </p>
            </div>
          )}

          {/* Pagination */}
          {paginationData.totalPages > 1 && (
            <div className="pt-8">
              <Pagination
                currentPage={currentPage}
                totalPages={paginationData.totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}