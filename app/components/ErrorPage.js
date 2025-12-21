"use client";
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Home, RefreshCw, ArrowLeft, ShoppingBag } from 'lucide-react';

export default function ErrorPage({ 
  statusCode, 
  translationKey, 
  imageSrc = '/images/error-illustration.svg',
  redirectPath = '/',
  isRefresh = false
}) {
  const router = useRouter();
  
  const handleAction = () => {
    if (isRefresh) {
      window.location.reload();
    } else {
      router.push(redirectPath);
    }
  };

  const errorPages = {
    "notFound": {
      "title": "Page Not Found",
      "description": "Oops! The page you're looking for seems to have wandered off. It might have been moved, deleted, or never existed.",
      "button": "Back to Home",
      "icon": Home
    },
    "serverError": {
      "title": "Server Error",
      "description": "We're experiencing some technical difficulties. Our team has been notified and is working on it.",
      "button": "Try Again",
      "icon": RefreshCw
    },
    "forbidden": {
      "title": "Access Denied",
      "description": "You don't have permission to access this page. Please check your credentials or contact support.",
      "button": "Go Back",
      "icon": ArrowLeft
    }
  };

  const currentError = errorPages[translationKey] || errorPages.notFound;
  const ButtonIcon = currentError.icon;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 px-4 py-16">
      <div className="text-center max-w-lg">
        {/* Illustration */}
        <div className="flex justify-center mb-8">
          <div className="relative w-72 h-56 sm:w-80 sm:h-64">
            {imageSrc && (
              <Image
                src={imageSrc}
                alt={currentError.title}
                fill
                priority
                className="object-contain drop-shadow-sm"
                sizes="(max-width: 640px) 288px, 320px"
              />
            )}
          </div>
        </div>
        
        {/* Status Code Badge */}
        <div className="inline-flex items-center justify-center mb-4">
          <span className="px-4 py-1.5 text-sm font-semibold text-tertiary dark:text-primary bg-tertiary/10 dark:bg-primary/10 rounded-full">
            Error {statusCode}
          </span>
        </div>
        
        {/* Title */}
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-3">
          {currentError.title}
        </h1>
        
        {/* Description */}
        <p className="text-gray-600 dark:text-gray-400 mb-8 text-base sm:text-lg leading-relaxed max-w-md mx-auto">
          {currentError.description}
        </p>
        
        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={handleAction}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-tertiary hover:bg-tertiary/90 dark:bg-primary dark:hover:bg-primary/90 text-white font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-tertiary dark:focus:ring-primary focus:ring-offset-2 shadow-lg shadow-tertiary/20 dark:shadow-primary/20 hover:shadow-xl hover:-translate-y-0.5 cursor-pointer"
          >
            <ButtonIcon className="w-5 h-5" />
            {currentError.button}
          </button>
          
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600 focus:ring-offset-2"
          >
            <ShoppingBag className="w-5 h-5" />
            Browse Products
          </Link>
        </div>
        
        {/* Help text */}
        <p className="mt-8 text-sm text-gray-500 dark:text-gray-500">
          Need help?{' '}
          <Link href="/contact" className="text-tertiary dark:text-primary hover:underline font-medium">
            Contact Support
          </Link>
        </p>
      </div>
    </div>
  );
}
