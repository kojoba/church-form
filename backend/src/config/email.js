const BREVO_EMAIL_URL =
  "https://api.brevo.com/v3/smtp/email";

export async function sendTransactionalEmail({
  to,
  toName,
  subject,
  text,
}) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.MAIL_FROM_EMAIL;
  const senderName =
    process.env.MAIL_FROM_NAME ||
    "Future Generation Conference";

  if (!apiKey || !senderEmail) {
    const error = new Error(
      "Brevo email configuration is incomplete."
    );

    error.code = "EMAIL_CONFIGURATION_ERROR";
    throw error;
  }

  const response = await fetch(BREVO_EMAIL_URL, {
    method: "POST",

    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": apiKey,
    },

    body: JSON.stringify({
      sender: {
        name: senderName,
        email: senderEmail,
      },

      to: [
        {
          email: to,
          name: toName,
        },
      ],

      replyTo: {
        email: senderEmail,
        name: senderName,
      },

      subject,
      textContent: text,
    }),

    signal: AbortSignal.timeout(20000),
  });

  const responseText = await response.text();

  let payload = {};

  try {
    payload = responseText
      ? JSON.parse(responseText)
      : {};
  } catch {
    payload = {
      message: responseText,
    };
  }

  if (!response.ok) {
    const error = new Error(
      payload.message ||
        "The email provider rejected the request."
    );

    error.code = "BREVO_API_ERROR";
    error.status = response.status;
    error.details = payload;

    throw error;
  }

  return payload;
}