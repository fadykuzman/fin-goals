import { Resend } from "resend";
import logger from "../logger.js";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

export async function sendFamilyInviteEmail(
  toEmail: string,
  inviterName: string,
  familyName: string
): Promise<void> {
  logger.info({ to: toEmail, inviterName, familyName }, "Sending family invite email");

  const { data, error } = await resend.emails.send({
    from: `FinGoals <${FROM_EMAIL}>`,
    to: toEmail,
    subject: `${inviterName} invited you to join "${familyName}" on FinGoals`,
    html: `
      <h2>You've been invited!</h2>
      <p><strong>${inviterName}</strong> has invited you to join the family <strong>"${familyName}"</strong> on FinGoals.</p>
      <p>Open the FinGoals app to accept or decline this invitation.</p>
      <p>If you don't have an account yet, sign up with this email address (<strong>${toEmail}</strong>) to see the invite.</p>
      <br/>
      <p style="color: #888; font-size: 12px;">This invitation will expire in 7 days.</p>
    `,
  });

  if (error) {
    logger.error({ err: error, to: toEmail }, "Resend API returned an error");
    throw error;
  }

  logger.info({ to: toEmail, emailId: data?.id }, "Family invite email sent successfully");
}
