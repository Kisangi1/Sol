"use client";
import { motion } from "motion/react";
import Image from "next/image";
import {
  MissionIcon,
  SustainabilityIcon,
} from "@/components/shared/about-icons";
import CTASection from "@/components/shared/cta-section";

export function AboutClient() {
  return (
    <>
      {/* Header Section */}
      <div className="relative pt-32 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1400px] mx-auto">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 tracking-tight"
          >
            Discover Our
            <span className="text-orange-500"> Story</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            className="text-gray-400 text-lg max-w-2xl"
          >
            For over 15 years, we've been turning dreams into reality, one
            safari at a time.
          </motion.p>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative px-4 sm:px-6 lg:px-8 pb-20 space-y-24">
        <div className="max-w-[1400px] mx-auto space-y-24">
          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Large Feature - Spans 2 columns */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.7 }}
              className="md:col-span-2 bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden group"
            >
              <div className="relative h-[400px]">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  transition={{ duration: 0.6 }}
                  className="absolute inset-0"
                >
                  <Image
                    src="/images/our_story.png"
                    alt="Our Journey"
                    fill
                    sizes="(max-width: 768px) 100vw, 66vw"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/50 to-transparent" />
                </motion.div>
                <div className="relative h-full flex flex-col justify-end p-8 space-y-4">
                  <h3 className="text-3xl font-bold font-['Cal_Sans','Oswald',sans-serif]">
                    Our Story
                  </h3>
                  <p className="text-gray-300 leading-relaxed">
                    Born from a passion for Africa's untamed beauty, The Sol
                    began as a dream to share the continent's most breathtaking
                    experiences. Today, we're proud to be one of East Africa's
                    premier safari operators, creating memories that last a
                    lifetime.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Mission Card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-8 space-y-6"
            >
              <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center">
                <div className="w-8 h-8 text-orange-500">
                  <MissionIcon />
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="text-2xl font-bold font-['Cal_Sans','Oswald',sans-serif]">
                  Our Mission
                </h3>
                <p className="text-gray-400 leading-relaxed">
                  To deliver authentic, sustainable safari experiences that
                  connect travelers with Africa's wildlife and cultures.
                </p>
              </div>
            </motion.div>

            {/* Values Card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 space-y-6"
            >
              <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center">
                <div className="w-8 h-8 text-white">
                  <SustainabilityIcon />
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="text-2xl font-bold font-['Cal_Sans','Oswald',sans-serif]">
                  Sustainability
                </h3>
                <p className="text-gray-400 leading-relaxed">
                  We're committed to responsible tourism, supporting local
                  communities and wildlife conservation efforts.
                </p>
              </div>
            </motion.div>

            {/* Experience Card with Image */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="md:col-span-2 bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden group"
            >
              <div className="relative h-[300px]">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  transition={{ duration: 0.6 }}
                  className="absolute inset-0"
                >
                  <Image
                    src="/images/tour_guide.png"
                    alt="Our Expertise"
                    fill
                    sizes="(max-width: 768px) 100vw, 66vw"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/50 to-transparent" />
                </motion.div>
                <div className="relative h-full flex flex-col justify-end p-8 space-y-4">
                  <h3 className="text-3xl font-bold font-['Cal_Sans','Oswald',sans-serif]">
                    Expert Guidance
                  </h3>
                  <p className="text-gray-300 leading-relaxed">
                    Our team of experienced guides knows every trail, every
                    watering hole, and every hidden gem across East Africa's
                    most spectacular landscapes.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* SafariBookings (text link on About only) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl mx-auto px-2"
          >
            <p className="text-gray-400 text-base sm:text-lg leading-relaxed text-center">
              We also cooperate with other listing platforms and are represented
              on the online African tour marketplace{" "}
              <a
                href="https://www.safaribookings.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-500 hover:text-orange-400 underline underline-offset-2"
              >
                SafariBookings.com
              </a>
              .
            </p>
          </motion.div>
        </div>
      </div>

      {/* CTA Section */}
      <CTASection
        title="Start Your Journey"
        description="Ready to experience the magic of Africa? Let's create your perfect adventure together"
        image="/images/sol_car.jpg"
        buttonText="Chat with Michael Kisangi"
        buttonAction={() => {
          // Add your chat functionality here
          window.open("https://wa.me/+254768453819", "_blank");
        }}
      />
    </>
  );
}
