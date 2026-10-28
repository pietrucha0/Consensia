import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

/** Pre-translated strings — templates stay locale-agnostic and testable. */
export type ActionEmailProps = {
  lang: string;
  preview: string;
  heading: string;
  greeting: string;
  body: string;
  buttonLabel: string;
  url: string;
  expires: string;
  ignore: string;
  linkFallback: string;
  footer: string;
};

// Brand palette (inline styles: email clients ignore stylesheets).
const colors = {
  primary: '#047857',
  ink: '#0F172A',
  muted: '#64748B',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  border: '#E2E8F0',
};

/** Single call-to-action email: verification, password reset, email change, notifications. */
export function ActionEmail(props: ActionEmailProps) {
  return (
    <Html lang={props.lang}>
      <Head />
      <Preview>{props.preview}</Preview>
      <Body style={{ backgroundColor: colors.background, fontFamily: 'Inter, Segoe UI, Helvetica, Arial, sans-serif', margin: 0, padding: '32px 0' }}>
        <Container style={{ maxWidth: 520, margin: '0 auto', padding: '0 16px' }}>
          <Text style={{ fontSize: 20, fontWeight: 700, color: colors.ink, margin: '0 0 16px' }}>
            Consensia
          </Text>
          <Section style={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 32 }}>
            <Heading as="h1" style={{ fontSize: 22, color: colors.ink, margin: '0 0 16px' }}>
              {props.heading}
            </Heading>
            <Text style={{ fontSize: 15, lineHeight: '24px', color: colors.ink }}>{props.greeting}</Text>
            <Text style={{ fontSize: 15, lineHeight: '24px', color: colors.ink }}>{props.body}</Text>
            <Section style={{ margin: '24px 0' }}>
              <Button
                href={props.url}
                style={{ backgroundColor: colors.primary, color: '#FFFFFF', borderRadius: 8, padding: '12px 20px', fontSize: 15, fontWeight: 600, textDecoration: 'none' }}
              >
                {props.buttonLabel}
              </Button>
            </Section>
            {props.expires && <Text style={{ fontSize: 14, color: colors.muted }}>{props.expires}</Text>}
            {props.ignore && <Text style={{ fontSize: 14, color: colors.muted }}>{props.ignore}</Text>}
            <Hr style={{ borderColor: colors.border, margin: '24px 0' }} />
            <Text style={{ fontSize: 12, color: colors.muted, margin: 0 }}>{props.linkFallback}</Text>
            <Link href={props.url} style={{ fontSize: 12, color: colors.primary, wordBreak: 'break-all' }}>
              {props.url}
            </Link>
          </Section>
          <Text style={{ fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 16 }}>{props.footer}</Text>
        </Container>
      </Body>
    </Html>
  );
}
