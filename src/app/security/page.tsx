import type { Metadata } from "next";
import { LegalLayout, Section } from "@/components/legal/legal-layout";

export const metadata: Metadata = {
  title: "Security — Mailgeko",
};

export default function SecurityPage() {
  return (
    <LegalLayout title="Security" updated="August 2026">
      <p>
        This page describes the security controls available in Mailgeko and the practices we
        follow in the hosted deployment. If you self-host, these controls are in your hands.
      </p>
      <Section title="Authentication">
        <p>
          Accounts use password or OAuth sign-in (Google, GitHub). Passwords are stored as strong
          hashes and never in plain text. Two-factor authentication (TOTP) can be enabled per
          account. All active sessions are listed in the settings and can be revoked individually
          or all at once, which is useful if a device is lost or compromised.
        </p>
      </Section>
      <Section title="Access control">
        <p>
          Workspaces support multiple members with owner, admin, and member roles. API keys are
          scoped and can be revoked. Sensitive account actions require the account password or a
          2FA code where enabled.
        </p>
      </Section>
      <Section title="Data handling">
        <p>
          Traffic between your browser and the service is encrypted with TLS in production
          deployments. Emails are sent through Resend using a dedicated API key per deployment.
          Tracking links in outgoing mail are signed so they cannot be forged. We never expose
          secrets, tokens, or API keys in the client, and we do not sell or share your data.
        </p>
      </Section>
      <Section title="Network and transport">
        <p>
          The hosted service is deployed behind a managed platform (Render) which handles TLS and
          network isolation. Delivery webhooks from Resend can be verified with a signing secret.
          Contact import and export are available over the API using your authenticated session.
        </p>
      </Section>
      <Section title="Limitations">
        <p>
          No system is perfectly secure. You can reduce risk by enabling two-factor
          authentication, using strong unique passwords, reviewing active sessions, and keeping
          your own deployment's operating system and configuration up to date.
        </p>
      </Section>
      <Section title="Reporting a vulnerability">
        <p>
          If you find a security issue, please report it privately to hello@mailgeko.dev rather
          than in a public forum. We appreciate responsible disclosure.
        </p>
      </Section>
    </LegalLayout>
  );
}
