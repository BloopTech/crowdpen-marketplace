"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export default function ImageGalleryModal({ 
  images = [], 
  isOpen, 
  onClose, 
  initialIndex = 0,
  productTitle = ""
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // Update current index when initialIndex changes
  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowLeft":
          goToPrevious();
          break;
        case "ArrowRight":
          goToNext();
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, goToPrevious, goToNext]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);



  const goToImage = (index) => {
    setCurrentIndex(index);
  };

  if (!isOpen || images.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black bg-opacity-50 text-white hover:bg-opacity-70 transition-all"
        aria-label="Close gallery"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Navigation buttons */}
      {images.length > 1 && (
        <>
          <button
            onClick={goToPrevious}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-black bg-opacity-50 text-white hover:bg-opacity-70 transition-all"
            aria-label="Previous image"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={goToNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-black bg-opacity-50 text-white hover:bg-opacity-70 transition-all"
            aria-label="Next image"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      {/* Main image container */}
      <div className="relative w-full h-full max-w-4xl max-h-[80vh] mx-4">
        <div className="relative w-full h-full">
          <Image
            src={images[currentIndex] || "/placeholder.svg"}
            alt={`${productTitle} - Image ${currentIndex + 1}`}
            fill
            className="object-contain"
            priority
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 70vw"
          />
        </div>
      </div>

      {/* Image counter */}
      {images.length > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-full bg-black bg-opacity-50 text-white text-sm">
          {currentIndex + 1} / {images.length}
        </div>
      )}

      {/* Thumbnail navigation */}
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-2 max-w-full overflow-x-auto px-4">
          <div className="flex gap-2">
            {images.map((image, index) => (
              <button
                key={index}
                onClick={() => goToImage(index)}
                className={`relative w-16 h-16 rounded-md overflow-hidden border-2 flex-shrink-0 transition-all ${
                  currentIndex === index
                    ? "border-white"
                    : "border-gray-400 opacity-70 hover:opacity-100"
                }`}
              >
                <Image
                  src={image || "/placeholder.svg"}
                  alt={`${productTitle} thumbnail ${index + 1}`}
                  fill
                  className="object-cover"
                  sizes="64px"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Click outside to close */}
      <div
        className="absolute inset-0 -z-10"
        onClick={onClose}
        aria-label="Close gallery"
      />
    </div>
  );
}
