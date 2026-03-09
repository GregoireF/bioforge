// Notifications email transactionnelles pour les événements RGPD critiques.
// Utilise Resend (https://resend.com) — gratuit jusqu'à 3000 emails/mois.
// Env requis : RESEND_API_KEY

const FROM  = 'BioForge <noreply@bioforge.click>'
const BRAND = '#00ff9d'
const BG    = '#0a0a0a'

// Template HTML minimal — compatible tous clients email
function wrapEmail(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title></head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#111113;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="padding:28px 32px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
            <table width="100%"><tr>
              <td>
                <span style="font-size:18px;font-weight:700;color:${BRAND};">⚡ BioForge</span>
              </td>
              <td align="right">
                <span style="font-size:12px;color:rgba(255,255,255,0.3);">${new Date().toLocaleDateString('fr-FR')}</span>
              </td>
            </tr></table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:28px 32px;">
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#fff;">${title}</h1>
            ${body}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.06);">
            <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.25);line-height:1.6;">
              Cet email a été envoyé automatiquement par BioForge suite à une action sur votre compte.<br>
              Si vous n'êtes pas à l'origine de cette action, contactez-nous immédiatement à
              <a href="mailto:privacy@bioforge.click" style="color:${BRAND};text-decoration:none;">privacy@bioforge.click</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = import.meta.env?.RESEND_API_KEY ?? process.env?.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[email-notify] RESEND_API_KEY not set — email not sent:', subject)
    return
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[email-notify] Resend error:', res.status, err)
    }
  } catch (err) {
    console.error('[email-notify] fetch error:', err)
  }
}

// ─────────────────────────────────────────────────────────────
// Templates RGPD
// ─────────────────────────────────────────────────────────────

export async function notifyGdprExport(email: string, username: string): Promise<void> {
  const html = wrapEmail(
    'Votre export de données est prêt',
    `<p style="color:rgba(255,255,255,0.7);font-size:15px;line-height:1.7;margin:0 0 20px;">
      Bonjour <strong style="color:#fff;">@${username}</strong>,<br><br>
      Votre demande d'export de données personnelles (Art. 20 RGPD) a été traitée avec succès.
      Le fichier JSON a été téléchargé dans votre navigateur.
    </p>
    <div style="background:rgba(0,255,157,0.08);border:1px solid rgba(0,255,157,0.2);border-radius:12px;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.6);line-height:1.6;">
        <strong style="color:${BRAND};">Ce fichier contient :</strong><br>
        Profil · Blocs · Résumé analytics · Historique des consentements · Abonnements
      </p>
    </div>
    <p style="color:rgba(255,255,255,0.5);font-size:13px;line-height:1.6;margin:0;">
      Si vous n'avez pas effectué cette demande, contactez-nous immédiatement.
    </p>`
  )
  await sendEmail(email, 'Votre export de données BioForge — RGPD', html)
}

export async function notifyGdprDeletionConfirm(email: string, username: string): Promise<void> {
  const html = wrapEmail(
    'Confirmation de suppression de compte',
    `<p style="color:rgba(255,255,255,0.7);font-size:15px;line-height:1.7;margin:0 0 20px;">
      Bonjour <strong style="color:#fff;">@${username}</strong>,<br><br>
      Votre demande de suppression de compte et de toutes vos données personnelles (Art. 17 RGPD)
      a été traitée avec succès.
    </p>
    <div style="background:rgba(255,59,48,0.08);border:1px solid rgba(255,59,48,0.2);border-radius:12px;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.6);line-height:1.6;">
        <strong style="color:#ff3b30;">Données supprimées :</strong><br>
        Profil · Blocs · Analytics · Sessions · Abonnements actifs annulés
      </p>
    </div>
    <p style="color:rgba(255,255,255,0.5);font-size:13px;line-height:1.6;margin:0;">
      Conformément à la réglementation, les logs de demandes RGPD sont conservés 3 ans à des fins de preuve légale.
      Toutes les autres données ont été définitivement supprimées.
    </p>`
  )
  await sendEmail(email, 'Suppression de votre compte BioForge confirmée', html)
}

export async function notifyGdprDeletionRequest(email: string, username: string): Promise<void> {
  const html = wrapEmail(
    'Demande de suppression reçue',
    `<p style="color:rgba(255,255,255,0.7);font-size:15px;line-height:1.7;margin:0 0 20px;">
      Bonjour <strong style="color:#fff;">@${username}</strong>,<br><br>
      Nous avons bien reçu votre demande de suppression de compte. Votre compte et toutes vos données
      sont en cours de suppression.
    </p>
    <p style="color:rgba(255,255,255,0.5);font-size:13px;line-height:1.6;margin:0;">
      Si vous n'avez pas effectué cette demande, contactez-nous <strong>immédiatement</strong> à
      <a href="mailto:privacy@bioforge.click" style="color:${BRAND};">privacy@bioforge.click</a>
    </p>`
  )
  await sendEmail(email, '⚠️ Demande de suppression de compte BioForge', html)
}