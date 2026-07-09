import "server-only";
import { Resend } from "resend";

const EMAIL_FROM = "VeraDoc <notificaciones@info.veradoc.pe>";

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  tags?: Array<{ name: string; value: string }>;
}

export interface SendEmailResult {
  id: string;
  status: string;
}

let resendInstance: Resend | null = null;

function getResend(): Resend | null {
  if (resendInstance) return resendInstance;
  const apiKey = process.env.EMAIL_API_KEY;
  if (!apiKey) return null;
  resendInstance = new Resend(apiKey);
  return resendInstance;
}

export async function sendEmail(
  params: SendEmailParams,
): Promise<SendEmailResult> {
  const resend = getResend();

  if (!resend) {
    console.warn("[email-service] EMAIL_API_KEY not configured — skipping send");
    return { id: "skipped", status: "not_configured" };
  }

  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: Array.isArray(params.to) ? params.to : [params.to],
    subject: params.subject,
    html: params.html,
    ...(params.replyTo ? { replyTo: [params.replyTo] } : {}),
    ...(params.tags ? { tags: params.tags } : {}),
  });

  if (error) {
    throw new Error(`Email send failed: ${error.message}`);
  }

  return { id: data!.id, status: "sent" };
}

export async function sendBatchEmails(
  emails: Array<{
    to: string;
    subject: string;
    html: string;
    tags?: Array<{ name: string; value: string }>;
  }>,
): Promise<{ ids: string[]; status: string }> {
  const resend = getResend();

  if (!resend) {
    console.warn("[email-service] EMAIL_API_KEY not configured — skipping batch send");
    return { ids: [], status: "not_configured" };
  }

  const { data, error } = await resend.batch.send(
    emails.map((e) => ({
      from: EMAIL_FROM,
      to: [e.to],
      subject: e.subject,
      html: e.html,
      ...(e.tags ? { tags: e.tags } : {}),
    })),
  );

  if (error) {
    throw new Error(`Batch email send failed: ${error.message}`);
  }

  return {
    ids: data!.data.map((d) => d.id),
    status: "sent",
  };
}
