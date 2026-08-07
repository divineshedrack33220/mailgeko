import type { Metadata } from "next";
import { LegalLayout, Section } from "@/components/legal/legal-layout";

export const metadata: Metadata = {
  title: "Privacy Policy — Mailgeko",
};

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated="August 2026">
      <Section title="1. Our position on your data">
        <p>
          Mailgeko is a self-hostable email marketing platform. In the hosted deployment, the
          people behind Mailgeko operate the servers that run the product you sign into. In a
          self-hosted deployment, you operate everything yourself.
        </p>
        <p>
          We do not sell your data. We do not run ad networks, ad trackers, or third-party
          advertising on your data. We do not use your contacts or campaign content to train
          external AI models.
        </p>
      </Section>
      <Section title="2. What we collect">
        <p>
          When you use Mailgeko we process: your account details (name, email address, avatar),
          the contacts, lists, segments, templates and campaigns you create, authentication
          credentials and session tokens, and usage data needed to operate the service.
        </p>
      </Section>
      <Section title="3. What we do with it">
        <p>
          Your data is used to deliver the features you asked for: storing and sending campaigns,
          recording opens and clicks, generating analytics, running the AI writing features, and
          billing for the plan you selected. Email delivery, open/click tracking, and bounce
          handling are provided by our delivery provider (Resend), which receives the recipient
          addresses and message content required to send and track mail on our behalf.
        </p>
      </Section>
      <Section title="4. AI features">
        <p>
          The AI writing tools generate copy from the prompts you provide and from your saved
          brand voice, if you set one. If you configure an AI provider API key, prompts are sent to
          that provider to generate output. When no AI provider is configured, the built-in
          deterministic generators run entirely inside your deployment and nothing is sent
          externally.
        </p>
      </Section>
      <Section title="5. Cookies and tracking">
        <p>
          The product uses authentication tokens stored in your browser. The emails you send
          through Mailgeko may contain tracking links and a tracking pixel to record opens and
          clicks for your campaigns. These are controlled by you, as the account holder, and are
          not used for advertising.
        </p>
      </Section>
      <Section title="6. Retention and deletion">
        <p>
          You can delete contacts, campaigns and other records at any time from within the product.
          Contact data can be exported as CSV. If you have an account and want it and its data
          removed, contact hello@mailgeko.dev and we will action the request within 30 days.
        </p>
      </Section>
      <Section title="7. Your rights">
        <p>
          Depending on where you are located you may have rights to access, correct, export, or
          delete your personal data. You can exercise most of these directly through the product;
          for anything else, contact us using the address above.
        </p>
      </Section>
      <Section title="8. Security">
        <p>
          Passwords are stored as hashes, sessions are revocable, and two-factor authentication is
          available. See the Security page for details. No transmission or storage method is
          perfectly secure, and we cannot guarantee absolute security.
        </p>
      </Section>
      <Section title="9. Changes to this policy">
        <p>
          We may update this policy as the product changes. Material changes will be noted at the
          top of this page with a new date.
        </p>
      </Section>
    </LegalLayout>
  );
}
