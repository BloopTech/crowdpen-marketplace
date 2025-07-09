import React from "react";
import nodemailer from "nodemailer";
import { Html } from "@react-email/html";
import { Body } from "@react-email/body";
import { Container } from "@react-email/container";
import { Head } from "@react-email/head";
import { Preview } from "@react-email/preview";
import { Text } from "@react-email/text";
import { Heading } from "@react-email/heading";
import { Hr } from "@react-email/hr";
import { Img } from "@react-email/img";
import { Link } from "@react-email/link";
import { Section } from "@react-email/section";
import { Tailwind } from "@react-email/tailwind";
import { render } from "@react-email/render";
import { Button } from "@react-email/button";


export default async function sendVerificationRequest(params) {
  const { identifier, url, provider, theme } = params;

  const transport = nodemailer.createTransport({
    auth: {
      user: process.env.EMAIL_SERVER_USER,
      pass: process.env.EMAIL_SERVER_PASSWORD,
    },
    host: process.env.EMAIL_SERVER_HOST,
    port: process.env.EMAIL_SERVER_PORT,
    secure: true,
  });

  // const transport = nodemailer.createTransport(
  //   smtpTransport({
  //     auth: {
  //       user: "techsupport@crowdpen.xyz",
  //       pass: "BloCodet150584%",
  //       //pass: "Qov86682",
  //       // user: "godsonaddy@yahoo.co.uk",
  //       // pass: "tbwbcsgyknshgnty",
  //     },
  //     //service: "Yahoo",
  //     host: "mail.crowdpen.xyz",
  //     //host: "mi3-sr19.supercp.com",
  //     //service: "Office365",
  //     port: 465,
  //     tls: {
  //       ciphers: "TLSv1.2",
  //       rejectUnauthorized: true,
  //     },
  //     secure: true,
  //     debug: true,
  //     logger: true,
  //   })
  // );

  //console.log("transport...............................", transport);

  const html = await render(
    <CrowdpenMagicLinkEmail url={url} identifier={identifier} />,
    {
      pretty: true,
    }
  );

  const result = await transport.sendMail({
    to: identifier,
    from: `"Crowdpen" <${process.env.EMAIL_FROM}>`,
    subject: `Verify your Email`,
    text: text(),
    html,
  });

  const failed = result.rejected.concat(result.pending).filter(Boolean);

  if (failed.length) {
    throw new Error(`Email(s) (${failed.join(", ")}) could not be sent`);
  }

  //await ses.sendEmail(transport);
}

// export default async function sendVerificationRequest(params) {
//   const { identifier, url, provider, theme } = params;
//   try {
//     const msalConfig = {
//       auth: {
//         clientId: process.env.OFFICE365_CLIENT_ID,
//         clientSecret: process.env.OFFICE365_CLIENT_SECRET,
//         authority: `https://login.microsoftonline.com/${process.env.OFFICE365_TENANT_ID}`,
//       },
//     };

//     const tokenRequest = {
//       scopes: ["https://graph.microsoft.com" + "/.default"],
//     };

//     const cca = new ConfidentialClientApplication(msalConfig);
//     const tokenInfo = await cca.acquireTokenByClientCredential(tokenRequest);

//     const mail = {
//       subject: "Verify your Email",
//       from: {
//         emailAddress: {
//           address: process.env.OFFICE365_USERNAME,
//         },
//       },
//       toRecipients: [
//         {
//           emailAddress: {
//             address: identifier,
//           },
//         },
//       ],
//       body: {
//         content: render(CrowdpenMagicLinkEmail({ identifier, url })),
//         contentType: "html",
//       },
//     };

//     const headers = new fetch.Headers();
//     const bearer = `Bearer ${tokenInfo.accessToken}`;

//     headers.append("Authorization", bearer);
//     headers.append("Content-Type", "application/json");

//     const options = {
//       method: "POST",
//       headers,
//       body: JSON.stringify({ message: mail, saveToSentItems: false }),
//     };

//     await fetch(
//       "https://graph.microsoft.com" +
//         "/v1.0/users/support@crowdpen.co/sendMail",
//       options
//     );
//   } catch (error) {
//     console.error("An error occurred while sending verification email", error);
//     throw error;
//   }
// }

function html(params) {
  const { url, identifier, theme } = params;

  const escapedHost = identifier.replace(/\./g, "&#8203;.");

  const brandColor = "#346df1";
  const color = {
    background: "#f9f9f9",
    text: "#444",
    mainBackground: "#fff",
    buttonBackground: brandColor,
    buttonBorder: brandColor,
    buttonText: "#fff",
  };

  return `
  
  <body style="background: ${color.background};">
  <table width="100%" border="0" cellspacing="20" cellpadding="0"
    style="background: ${color.mainBackground}; max-width: 600px; margin: auto; border-radius: 10px;">
    <tr>
      <td align="flex-start"
        style="padding: 10px 0px; font-size: 22px; font-family: Helvetica, Arial, sans-serif; color: ${color.text};">
        Hi, <strong>${escapedHost}</strong>
      </td>
    </tr>
     <tr>
      <td align="flex-start"
        style="padding: 0px 0px 10px 0px; font-size: 16px; line-height: 22px; font-family: Helvetica, Arial, sans-serif; color: ${color.text};">
        You have successfully created Crowdpen account. Please click button below to verify your email address and complete your login.
      </td>
    </tr>
    <tr>
      <td align="flex-start" style="padding: 20px 0;">
        <table border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td align="flex-start" style="border-radius: 5px;" bgcolor="${color.buttonBackground}"><a href="${url}"
                target="_blank"
                style="font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${color.buttonText}; text-decoration: none; border-radius: 5px; padding: 10px 20px; border: 1px solid ${color.buttonBorder}; display: inline-block; font-weight: bold;">VERIFY YOUR EMAIL</a></td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td align="flex-start"
        style="padding: 0px 0px 10px 0px; font-size: 16px; line-height: 22px; font-family: Helvetica, Arial, sans-serif; color: ${color.text};">
        Having trouble? Click on the link below
      </td>
    </tr>
        <tr>
      <td align="flex-start" style="padding: 20px 0;">
        <table border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td align="flex-start"><a href="${url}"
                target="_blank"
                style="font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${color.buttonBorder}; font-weight: bold;">"${url}"</a></td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td align="flex-start"
        style="padding: 0px 0px 10px 0px; font-size: 16px; line-height: 22px; font-family: Helvetica, Arial, sans-serif; color: ${color.text};">
        If you did not request this email you can safely ignore it.
      </td>
    </tr>
  </table>
</body>
`;
}

function text() {
  return `Verify your Email \n\n`;
}

const CrowdpenMagicLinkEmail = (props) => {
  const { url, identifier } = props;
  return (
    <Html>
      <Head />
      <Preview>Sign In To Crowdpen</Preview>
      <Tailwind>
        <Body className="bg-white text-black my-0 mx-auto">
          <Container className="mx-auto pt-[20px] pb-[48px] px-[25px] max-w-[560px]">
            <Section className="mt-[32px]">
              <Img
                src="https://crowdpen.site/crowdpen_icon_logo.png"
                alt="Crowdpen Logo"
                width="85"
                height="85"
                className="-ml-[1.8rem]"
              />
            </Section>
            <Heading className="text-black text-[24px] font-normal p-0 my-[30px] mx-0 font-avenirbold">
              Magic Link Email
            </Heading>
            <Section className="flex flex-col mt-[32px] mb-[32px]">
              <Text className="text-xl leading-[26px] font-bold font-poynterroman">
                Welcome back to Crowdpen!
              </Text>
              <Text className="text-base leading-[26px] font-poynterroman">
                Click the button below to sign in to your Crowdpen account.
              </Text>
              <Section className="text-center w-full">
                <Button
                  className="cursor-pointer bg-[#000000] rounded-md text-white font-semibold no-underline text-center font-poynterroman block p-3 hover:bg-white border border-black hover:text-black"
                  href={url}
                >
                  Sign In To Crowdpen
                </Button>
              </Section>
            </Section>
            <Text className="text-black text-[14px] leading-[24px] font-poynterroman">
              Or copy and paste this link in your web browser:{" "}
            </Text>
            <Link
              href={url}
              className="text-black text-sm underline font-poynterroman break-all"
            >
              {url}
            </Link>
            <Text className="text-blacl/80 text-[14px] leading-[24px] font-poynterroman">
              If you did not make this request, ignore this email.
            </Text>
            <Text className="text-base leading-[26px] font-poynterroman">
              Edison Ade
              <br />
              CrowdPen Founder/CEO
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};
