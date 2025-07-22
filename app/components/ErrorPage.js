"use client";
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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
        "description": "The page you are looking for doesn't exist or has been moved.",
        "button": "Back to Home"
      },
      "serverError": {
        "title": "Server Error",
        "description": "Something went wrong on our servers. Please try again later.",
        "button": "Refresh Page"
      },
      "forbidden": {
        "title": "Access Denied",
        "description": "You don't have permission to access this page.",
        "button": "Back to Dashboard"
      }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950 px-4 py-16">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-6">
          <div className="relative w-64 h-64">
            {imageSrc && (
              <Image
                src={imageSrc}
                alt={errorPages[translationKey].title}
                fill
                priority
                className="object-contain"
              />
            )}
          </div>
        </div>
        
        <h1 className="text-6xl font-bold text-tertiary dark:text-primary mb-2">
          {statusCode}
        </h1>
        
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
          {errorPages[translationKey].title}
        </h2>
        
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          {errorPages[translationKey].description}
        </p>
        
        <button
          onClick={handleAction}
          className="cursor-pointer px-6 py-3 bg-tertiary hover:bg-primary text-white rounded-lg transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50"
        >
          {errorPages[translationKey].button}
        </button>
      </div>
    </div>
  );
}
