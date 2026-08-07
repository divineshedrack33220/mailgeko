import type { Metadata } from "next";
import { LegalLayout, Section } from "@/components/legal/legal-layout";

export const metadata: Metadata = {
  title: "Terms of Service — Mailgeko",
};

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" updated="August 2026">
      <Section title="1. Agreement">
        <p>
          These terms govern your use of Mailgeko, a self-hostable email marketing platform. By
          creating an account or deploying the software you agree to these terms. If you do not
          agree, do not use the product.
        </p>
      </Section>
      <Section title="2. Acceptable use">
        <p>
          Mailgeko is for lawful marketing communications. You are responsible for the content you
          send and for complying with all applicable law, including consent and opt-out
          requirements such as CAN-SPAM, GDPR, and any local anti-spam legislation. You may not use
          Mailgeko to send unsolicited bulk mail, to email purchased or scraped lists, or to
          engage in any activity that damages the platform or its users.
        </p>
      </Section>
      <Section title="3. Your account">
        <p>
          You are responsible for safeguarding your account credentials and for all activity under
          your account. Notify us promptly at hello@mailgeko.dev if you believe your account has
          been compromised. Two-factor authentication is available and recommended.
        </p>
      </Section>
      <Section title="4. Plans, billing and limits">
        <p>
          Paid plans are billed monthly and can be cancelled at any time. Each plan has a hard
          contact limit and a monthly email limit; the product stops sending when a limit is
          reached. Refunds are provided at our discretion. Prices and plan details may change with
          notice.
        </p>
      </Section>
      <Section title="5. AI features">
        <p>
          AI-generated output is provided as a writing aid and may contain mistakes. You are
          responsible for reviewing output before sending. When an external AI provider is
          configured, your prompts are processed by that provider under their terms.
        </p>
      </Section>
      <Section title="6. Service availability">
        <p>
          We aim to keep the hosted service available, but we do not guarantee uninterrupted
          availability. The software is provided &quot;as is&quot; without warranties of any kind,
          express or implied, including merchantability or fitness for a particular purpose. To the
          maximum extent permitted by law, we are not liable for indirect, incidental, or
          consequential damages arising from your use of the product.
        </p>
      </Section>
      <Section title="7. Self-hosted deployments">
        <p>
          If you self-host Mailgeko, you are solely responsible for operating, securing, and
          backing up your own deployment, and these terms apply to you only insofar as you also use
          the hosted service. The software is proprietary; you may not redistribute or resell it
          without written permission.
        </p>
      </Section>
      <Section title="8. Termination">
        <p>
          You may stop using the service at any time. We may suspend or terminate access for
          violations of these terms, unlawful activity, or unpaid invoices. On termination your
          data will be deleted in accordance with the Privacy Policy.
        </p>
      </Section>
      <Section title="9. Contact">
        <p>Questions about these terms: hello@mailgeko.dev.</p>
      </Section>
    </LegalLayout>
  );
}
