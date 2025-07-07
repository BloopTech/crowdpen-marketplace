"use client";
import React, { useEffect } from "react";
import Script from "next/script";



const GoogleAnalytics = ({ gaId }) => (
  <>
    <Script
      async
      src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
    ></Script>
    <Script id="google-analytics">
      {`
        window.dataLayer = window.dataLayer || [];
        function gtag() { dataLayer.push(arguments); }
        gtag('js', new Date());
        gtag('config', '${gaId}');
      `}
    </Script>
  </>
);
export default GoogleAnalytics;
