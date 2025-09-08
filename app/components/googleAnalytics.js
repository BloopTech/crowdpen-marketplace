import Script from "next/script";
import { headers } from "next/headers";

const GoogleAnalytics = ({ gaId }) => {
  const nonce = headers().get("x-csp-nonce") || headers().get("x-nonce") || undefined;
  return (
    <>
      <Script
        async
        nonce={nonce}
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
      ></Script>
      <Script id="google-analytics" nonce={nonce}>
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag() { dataLayer.push(arguments); }
          gtag('js', new Date());
          gtag('config', '${gaId}');
        `}
      </Script>
    </>
  );
};
export default GoogleAnalytics;
