import dns from "node:dns/promises";
import nodemailer from "nodemailer";

const smtpHostname =
  process.env.SMTP_HOST || "smtp.gmail.com";

const smtpPort = Number(
  process.env.SMTP_PORT || 587
);

/*
 * Resolve only IPv4 addresses.
 * This prevents Render from selecting an unreachable IPv6 address.
 */
const ipv4Addresses = await dns.resolve4(smtpHostname);

if (!ipv4Addresses.length) {
  throw new Error(
    `No IPv4 address was found for ${smtpHostname}.`
  );
}

const smtpIPv4 =
  ipv4Addresses[
    Math.floor(Math.random() * ipv4Addresses.length)
  ];

console.log(
  `SMTP configured using IPv4 ${smtpIPv4}:${smtpPort}`
);

const mailer = nodemailer.createTransport({
  /*
   * Connect directly to the resolved IPv4 address.
   */
  host: smtpIPv4,
  port: smtpPort,

  /*
   * Port 465 uses direct TLS.
   * Port 587 uses STARTTLS.
   */
  secure: smtpPort === 465,
  requireTLS: smtpPort === 587,

  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },

  /*
   * Keep the original hostname for TLS certificate validation.
   */
  tls: {
    servername: smtpHostname,
    minVersion: "TLSv1.2",
  },

  pool: true,
  maxConnections: 1,
  maxMessages: 20,

  connectionTimeout: 15000,
  greetingTimeout: 10000,
  socketTimeout: 30000,
});

mailer.on("error", (error) => {
  console.error("SMTP transport error:", {
    code: error.code,
    message: error.message,
    command: error.command,
    responseCode: error.responseCode,
    response: error.response,
  });
});

export default mailer;