"use client";
import Image from "next/image";
import { motion } from "motion/react";
import { experiences } from "@/data/visual";

const FeaturedExperiences = () => {
  return (
    <section className="relative py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-[1400px] mx-auto">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 tracking-tight">
            Experiences That
            <span className="text-orange-500"> Matter</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Unforgettable journeys across Africa's most breathtaking landscapes.
            From wildlife encounters to cultural immersion.
          </p>
        </motion.div>

        {/* Gallery Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {experiences.map((experience, index) => (
            <motion.div
              key={experience.id}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
            >
              <div className="block">
                {/* Image Container - 1st and 3rd are tall, 2nd and 4th are short */}
                <motion.div
                  whileHover={{ y: -8 }}
                  transition={{ duration: 0.3 }}
                  className={`relative overflow-hidden mb-3 sm:mb-4 rounded ${
                    index === 0 || index === 2 ? "aspect-3/4" : "aspect-4/3"
                  }`}
                >
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    transition={{ duration: 0.6 }}
                    className="w-full h-full"
                  >
                    <Image
                      src={experience.image}
                      alt={experience.title}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </motion.div>
                </motion.div>

                {/* Text Content Below Image */}
                <div className="space-y-1.5 sm:space-y-2">
                  {/* Category */}
                  <p className="text-orange-500 text-xs font-semibold uppercase tracking-wider">
                    {experience.category}
                  </p>

                  {/* Title */}
                  <h3 className="text-white text-xl font-bold leading-tight">
                    {experience.title}
                  </h3>

                  {/* Description */}
                  <p className="text-gray-400 text-sm leading-relaxed">
                    {experience.description}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturedExperiences;
