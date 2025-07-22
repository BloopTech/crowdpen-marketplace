"use client";

import ErrorPage from './components/ErrorPage';

export default function GlobalError({ error }) {
  console.error(error);
  return (
    <html>
      <body>
        <ErrorPage 
          statusCode="500" 
          translationKey="serverError" 
          imageSrc="/images/500-illustration.svg"
          isRefresh={true}
        />
      </body>
    </html>
  );
}