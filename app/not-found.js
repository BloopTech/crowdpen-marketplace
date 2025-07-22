"use client";
import ErrorPage from './components/ErrorPage';

export default function NotFound() {
  return (
    <ErrorPage 
      statusCode="404" 
      translationKey="notFound" 
      imageSrc="/images/404-illustration.svg"
      redirectPath="/"
    />
  );
}