"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import BookingDrawer from "./booking-drawer";

const Footer = () => {
  const [email, setEmail] = useState("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleSubmit = () => {
    if (email?.includes("@")) {
      toast.success("Successfully subscribed!", {
        description:
          "You will receive exclusive safari deals and travel inspiration.",
      });
      setEmail("");
    } else {
      toast.error("Please enter a valid email address");
    }
  };

  return (
    <footer className="relative">
      {/* CTA Hero Section with Sidebar */}
      <div className="relative flex flex-col md:flex-row">
        {/* Left Sidebar - Footer Links */}
        <div className="bg-white text-gray-800 w-full md:w-80 lg:w-96 p-8 lg:p-12 order-2 md:order-1">
          {/* Logo */}
          <div className="mb-8">
            <Link href="/" className="inline-block">
              <div
                className="font-bold tracking-[0.2em] text-base text-gray-900"
                style={{ fontFamily: "Georgia, serif" }}
              >
                THE SOL <span className="text-orange-500">OF AFRICAN</span>
              </div>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-4 mb-12">
            <Link
              href="/"
              className="block text-sm text-gray-600 hover:text-orange-500 transition-colors"
            >
              Home
            </Link>
            <Link
              href="/about"
              className="block text-sm text-gray-600 hover:text-orange-500 transition-colors"
            >
              About
            </Link>
            <Link
              href="/destinations"
              className="block text-sm text-gray-600 hover:text-orange-500 transition-colors"
            >
              Destinations
            </Link>
            <Link
              href="/packages"
              className="block text-sm text-gray-600 hover:text-orange-500 transition-colors"
            >
              Packages
            </Link>
            <Link
              href="/gallery"
              className="block text-sm text-gray-600 hover:text-orange-500 transition-colors"
            >
              Gallery
            </Link>
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="block text-sm text-gray-600 hover:text-orange-500 transition-colors text-left"
            >
              Contact
            </button>
          </nav>

          {/* Divider */}
          <div className="border-t border-gray-200 mb-8"></div>

          {/* Legal Links */}
          <div className="space-y-3 mb-12">
            <Link
              href="/privacy"
              className="block text-xs text-gray-500 hover:text-orange-500 transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="block text-xs text-gray-500 hover:text-orange-500 transition-colors"
            >
              Terms of Service
            </Link>
          </div>

          {/* Social Links */}
          <div className="space-y-3 mb-12">
            <a
              href="https://www.instagram.com/sol_of_african"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-xs text-gray-500 hover:text-orange-500 transition-colors"
            >
              Instagram
            </a>
            <a
              href="https://www.facebook.com/Sol.of.African.Tours?mibextid=LQQJ4d&rdid=p8l68MNu8DTmfZRl&share_url=https%3A%2F%2Fwww.facebook.com%2Fshare%2FxJYd3ocdUWag4jsW%2F%3Fmibextid%3DLQQJ4d#"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-xs text-gray-500 hover:text-orange-500 transition-colors"
            >
              Facebook
            </a>
            <a
              href="https://www.tiktok.com/@the_sol_of_african"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-xs text-gray-500 hover:text-orange-500 transition-colors"
            >
              TikTok
            </a>
          </div>

          {/* Copyright */}
          <p className="text-[10px] text-gray-600 mb-3">
            thesolofafrican.com 2025. All rights reserved.
          </p>

          {/* Crafted By */}
          <a
            href="https://www.crowstudios.tech"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-gray-900 hover:text-orange-500 transition-colors inline-flex items-center gap-1"
          >
            Crafted by 🐦‍⬛ Crow Studios
          </a>
        </div>

        {/* Right - Hero CTA */}
        <div className="relative flex-1 min-h-[500px] md:min-h-[600px] order-1 md:order-2">
          {/* Background Image */}
          <Image
            src="/images/gallery/ambolife.jpg"
            alt="African Safari Landscape"
            fill
            className="object-cover"
          />

          {/* Dark Overlay */}
          <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/40 to-black/60"></div>

          {/* Content */}
          <div className="relative h-full flex flex-col justify-between p-8 lg:p-16">
            {/* Top Heading */}
            <div>
              <h2 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-white leading-tight mb-4">
                Start Your African
                <br />
                Adventure Today.
              </h2>
            </div>

            {/* Bottom CTA - Right Aligned */}
            <div className="flex justify-end">
              <div className="max-w-2xl w-full">
                <div className="flex gap-2 flex-col sm:flex-row">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleSubmit();
                      }
                    }}
                    placeholder="Subscribe to our newsletter"
                    className="flex-1 px-6 py-4 bg-white/95 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                  />
                  <Button
                    onClick={handleSubmit}
                    className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 h-auto flex items-center justify-center gap-2 transition-all hover:shadow-xl whitespace-nowrap"
                  >
                    Subscribe
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </div>
                <p className="text-gray-300 text-xs mt-3">
                  Get exclusive safari deals and travel inspiration delivered to
                  your inbox.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Booking Drawer */}
      <BookingDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </footer>
  );
};

export default Footer;
