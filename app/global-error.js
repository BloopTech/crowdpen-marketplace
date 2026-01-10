"use client";

import { useEffect } from "react";
import ErrorPage from './components/ErrorPage';
import { reportClientError } from './lib/observability/reportClientError';

export default function GlobalError({ error }) {
  useEffect(() => {
    (async () => {
      await reportClientError(error, { tag: "global_error_boundary" });
    })();
  }, [error]);
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