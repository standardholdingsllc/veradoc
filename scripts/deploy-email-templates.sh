#!/usr/bin/env bash
#
# Deploy VeraDoc-branded email templates + Resend SMTP config to Supabase.
#
# Prerequisites:
#   1. Generate a Supabase access token at https://supabase.com/dashboard/account/tokens
#   2. Run: SUPABASE_ACCESS_TOKEN="sbp_..." bash scripts/deploy-email-templates.sh
#
# This script:
#   - Configures Resend as the custom SMTP provider
#   - Updates invite, magic-link, recovery, and confirmation email templates
#
set -euo pipefail

PROJECT_REF="fyfcslzgahfbyezsnpxl"
API="https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth"

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "ERROR: Set SUPABASE_ACCESS_TOKEN before running this script."
  echo "  Get one at https://supabase.com/dashboard/account/tokens"
  exit 1
fi

if [ -z "${RESEND_API_KEY:-}" ]; then
  RESEND_API_KEY="${EMAIL_API_KEY:-}"
fi

if [ -z "${RESEND_API_KEY:-}" ]; then
  echo "ERROR: Set RESEND_API_KEY (or EMAIL_API_KEY) before running this script."
  exit 1
fi

# ---------- Step 1: Configure Resend SMTP ----------
echo "→ Configuring Resend SMTP on Supabase project ${PROJECT_REF}..."

curl -sf -X PATCH "${API}" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"external_email_enabled\": true,
    \"smtp_admin_email\": \"notificaciones@info.veradoc.pe\",
    \"smtp_host\": \"smtp.resend.com\",
    \"smtp_port\": \"465\",
    \"smtp_user\": \"resend\",
    \"smtp_pass\": \"${RESEND_API_KEY}\",
    \"smtp_sender_name\": \"VeraDoc\"
  }" > /dev/null

echo "  ✓ SMTP configured"

# ---------- Step 2: Read template HTML files ----------
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TMPL_DIR="${SCRIPT_DIR}/../supabase/templates"

read_template() {
  local file="${TMPL_DIR}/$1"
  if [ ! -f "$file" ]; then
    echo "ERROR: Template file not found: $file" >&2
    exit 1
  fi
  # Escape for JSON embedding
  python3 -c "import sys,json; print(json.dumps(open(sys.argv[1]).read()))" "$file"
}

INVITE_HTML=$(read_template "invite.html")
MAGIC_LINK_HTML=$(read_template "magic-link.html")
RECOVERY_HTML=$(read_template "recovery.html")
CONFIRMATION_HTML=$(read_template "confirmation.html")

# ---------- Step 3: Deploy templates ----------
echo "→ Deploying email templates..."

curl -sf -X PATCH "${API}" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"mailer_subjects_invite\": \"Te han invitado a VeraDoc\",
    \"mailer_templates_invite_content\": ${INVITE_HTML},
    \"mailer_subjects_magic_link\": \"Tu enlace de acceso a VeraDoc\",
    \"mailer_templates_magic_link_content\": ${MAGIC_LINK_HTML},
    \"mailer_subjects_recovery\": \"Restablecer tu contraseña de VeraDoc\",
    \"mailer_templates_recovery_content\": ${RECOVERY_HTML},
    \"mailer_subjects_confirmation\": \"Confirma tu correo en VeraDoc\",
    \"mailer_templates_confirmation_content\": ${CONFIRMATION_HTML}
  }" > /dev/null

echo "  ✓ Email templates deployed"
echo ""
echo "Done. Verify at:"
echo "  SMTP:      https://supabase.com/dashboard/project/${PROJECT_REF}/auth/smtp"
echo "  Templates: https://supabase.com/dashboard/project/${PROJECT_REF}/auth/templates"
