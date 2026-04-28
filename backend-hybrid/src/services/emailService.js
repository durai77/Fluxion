const { Resend } = require("resend");
const logger = require("../config/logger");

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

async function sendFileReceivedEmail({ receiverEmail, senderEmail, fileName }) {
  if (!resend) {
    return;
  }

  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM || "Fluxion <noreply@example.com>",
      to: receiverEmail,
      subject: "You have a new secure file",
      html: `<p>${senderEmail} sent you an encrypted file: <strong>${fileName}</strong></p>
        <p><a href="${process.env.FRONTEND_URL}/inbox">Open Fluxion to download it securely</a></p>
        <p><em>Only you can decrypt this file.</em></p>`,
    });
  } catch (err) {
    logger.warn({ errorMessage: err.message }, "File notification email failed");
  }
}

module.exports = { sendFileReceivedEmail };
