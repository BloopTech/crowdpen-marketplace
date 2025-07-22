"use client";

import ErrorPage from './components/ErrorPage';

export default function Error() {
  return (
    <ErrorPage 
      statusCode="500" 
      translationKey="serverError" 
      imageSrc="/images/500-illustration.svg"
      isRefresh={true}
    />
  );
}