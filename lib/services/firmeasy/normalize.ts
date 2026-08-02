/**
 * Parse a WhatsApp number stored as "+51XXXXXXXXX" into
 * the country_code and phone format FirmEasy expects.
 */
export function parseWhatsappForFirmEasy(whatsapp: string): {
  country_code: string;
  phone: string;
} {
  const cleaned = whatsapp.replace(/\s+/g, "");
  const match = cleaned.match(/^(\+\d{1,3})(\d{9,20})$/);
  if (!match) {
    throw new Error(`Invalid whatsapp format for FirmEasy: ${whatsapp}`);
  }
  return { country_code: match[1], phone: match[2] };
}
