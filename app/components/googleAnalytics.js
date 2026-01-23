import Script from "next/script";

const GoogleAnalytics = ({ gaId, nonce }) => {
  const safeNonce = nonce || undefined;
  return (
    <>
      <Script
        async
        nonce={safeNonce}
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
      ></Script>
      <Script id="google-analytics" nonce={safeNonce}>
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
