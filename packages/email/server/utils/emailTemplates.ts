import mjml2html from 'mjml'

const options = {
  minify: true
}

const BRAND_NAME = 'MagicSync'
const PRIMARY_COLOR = '#F97316'
const BG_COLOR = '#f5f5f0'
const SURFACE_COLOR = '#ffffff'
const TEXT_COLOR = '#4a4a4a'
const HEADER_COLOR = '#262626'
const LOGO_URL = 'https://magicsync.dev/img/logo.png'
const BASE_URL = 'https://magicsync.dev'

const SOCIAL_LINKS = [
  { name: 'Twitter', icon: 'https://cdn-icons-png.flaticon.com/24/733/733579.png', url: '#' },
  { name: 'Facebook', icon: 'https://cdn-icons-png.flaticon.com/24/733/733547.png', url: '#' },
  { name: 'Instagram', icon: 'https://cdn-icons-png.flaticon.com/24/733/733614.png', url: '#' },
  { name: 'LinkedIn', icon: 'https://cdn-icons-png.flaticon.com/24/733/733561.png', url: '#' },
  { name: 'YouTube', icon: 'https://cdn-icons-png.flaticon.com/24/1384/1384060.png', url: '#' },
]

const FOOTER_LINKS = [
  { label: 'Pricing', url: `${BASE_URL}/pricing` },
  { label: 'Documentation', url: `${BASE_URL}/documentation` },
  { label: 'Blog', url: `${BASE_URL}/blog` },
  { label: 'About Us', url: `${BASE_URL}/about-us` },
  { label: 'Privacy Policy', url: `${BASE_URL}/privacy-policy` },
  { label: 'Terms of Service', url: `${BASE_URL}/terms-of-use` },
]

interface BaseEmailProps {
  title: string
  bodyContent: string
  button?: {
    text: string
    url: string
  }
  secondaryButton?: {
    text: string
    url: string
  }
  footerContent?: string
}

const socialRow = SOCIAL_LINKS.map(s => `
  <mj-column width="20%" padding="2px">
    <mj-image src="${s.icon}" alt="${s.name}" width="24" height="24" href="${s.url}" padding="0" />
  </mj-column>
`).join('')

const footerLinkColumns = `
  <mj-column width="100%" padding="0 25px">
    <mj-text align="center" font-size="12px" color="#999999" padding="0">
      ${FOOTER_LINKS.map(l => `<a href="${l.url}" style="color: #999999; text-decoration: underline; margin: 0 6px;">${l.label}</a>`).join(' | ')}
    </mj-text>
  </mj-column>
`

function baseHeader(): string {
  return `
    <mj-section background-color="${PRIMARY_COLOR}" padding="12px 0">
      <mj-column width="100%">
        <mj-image src="${LOGO_URL}" alt="${BRAND_NAME}" width="140" padding="0" />
      </mj-column>
    </mj-section>
    <mj-section background-color="${HEADER_COLOR}" padding="8px 0">
      <mj-column width="100%">
        <mj-text align="center" font-size="11px" color="#cccccc" font-family="Arial, sans-serif" padding="0">
          Social Media Management Platform
        </mj-text>
      </mj-column>
    </mj-section>
  `
}

function baseFooter(): string {
  return `
    <mj-section background-color="${HEADER_COLOR}" padding="20px 0 10px 0">
      ${footerLinkColumns}
    </mj-section>
    <mj-section background-color="${HEADER_COLOR}" padding="10px 0">
      <mj-column width="100%">
        <mj-table padding="0">
          <tr style="border-bottom:0; text-align:center;">
            ${SOCIAL_LINKS.map(s => `<td style="padding: 4px 8px;"><a href="${s.url}"><img src="${s.icon}" width="22" height="22" alt="${s.name}" style="display:block;" /></a></td>`).join('')}
          </tr>
        </mj-table>
      </mj-column>
    </mj-section>
    <mj-section background-color="${HEADER_COLOR}" padding="5px 0 20px 0">
      <mj-column width="100%">
        <mj-text align="center" font-size="11px" color="#888888" font-family="Arial, sans-serif" padding="0 25px">
          &copy; ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.
          <br />
          This email was sent to you as a registered user of ${BRAND_NAME}.
          <br />
          <a href="${BASE_URL}/unsubscribe" style="color: #888888; text-decoration: underline;">Unsubscribe</a>
        </mj-text>
      </mj-column>
    </mj-section>
  `
}

function baseTemplate({ title, bodyContent, button, secondaryButton, footerContent }: BaseEmailProps): string {
  return `
    <mjml>
      <mj-head>
        <mj-attributes>
          <mj-all padding="0px" />
          <mj-text font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" padding="0 25px" font-size="15px" line-height="1.5" />
          <mj-section background-color="${SURFACE_COLOR}" />
        </mj-attributes>
        <mj-style inline="inline">
          a { text-decoration: none; }
          .hover-primary:hover { color: ${PRIMARY_COLOR} !important; }
        </mj-style>
      </mj-head>
      <mj-body background-color="${BG_COLOR}" width="600px">
        ${baseHeader()}
        <mj-section background-color="${SURFACE_COLOR}" padding-top="30px" padding-bottom="20px">
          <mj-column>
            <mj-text align="center" padding="0 25px 15px 25px" font-size="22px" color="${HEADER_COLOR}" font-weight="700">
              ${title}
            </mj-text>
            <mj-divider border-width="2px" border-color="${PRIMARY_COLOR}" width="40px" padding="0 0 15px 0" />
            <mj-text align="left" font-size="15px" color="${TEXT_COLOR}" padding="0 25px">
              ${bodyContent}
            </mj-text>
            ${button ? `
            <mj-button background-color="${PRIMARY_COLOR}" color="#FFFFFF" href="${button.url}" align="center" font-family="Arial, sans-serif" padding="25px 0 5px 0" font-weight="bold" font-size="15px" border-radius="8px" inner-padding="14px 32px">
              ${button.text}
            </mj-button>
            ` : ''}
            ${secondaryButton ? `
            <mj-text align="center" font-size="13px" color="#999999" padding="15px 25px 0 25px">
              <a href="${secondaryButton.url}" style="color: ${PRIMARY_COLOR}; text-decoration: underline;">${secondaryButton.text}</a>
            </mj-text>
            ` : ''}
          </mj-column>
        </mj-section>
        <mj-section background-color="${SURFACE_COLOR}" padding="0 0 25px 0">
          <mj-column>
            <mj-text align="center" color="${TEXT_COLOR}" font-size="13px" font-family="Arial, sans-serif" padding="0 25px">
              ${footerContent || `Best regards,<br /><strong>The ${BRAND_NAME} Team</strong>`}
            </mj-text>
          </mj-column>
        </mj-section>
        ${baseFooter()}
      </mj-body>
    </mjml>
  `
}

export const userVerificationTemplate = async (url: string, user: { name?: string | null }) => {
  const htmlOutput = await mjml2html(baseTemplate({
    title: `Welcome to ${BRAND_NAME}, ${user.name}!`,
    bodyContent: `
      <p>Thank you for joining ${BRAND_NAME}, your all-in-one platform for managing social media, Google My Business, and content creation.</p>
      <p>To complete your registration and get started, please verify your email address by clicking the button below.</p>
    `,
    button: {
      text: 'Verify Your Email',
      url
    }
  }), options)

  return htmlOutput
}

export const userPasswordResetTemplate = async (url: string, user: { name?: string | null }) => {
  const htmlOutput = await mjml2html(baseTemplate({
    title: `Password Reset Request`,
    bodyContent: `
      <p>We received a request to reset your password for your ${BRAND_NAME} account.</p>
      <p>If you did not request a password reset, please ignore this email. No changes have been made to your account.</p>
      <p style="font-size: 13px; color: #888888;">This link will expire in a few hours.</p>
    `,
    button: {
      text: 'Reset Your Password',
      url
    }
  }), options)

  return htmlOutput
}

export const organizationInvitationTemplate = async (url: string, inviterName: string, organizationName: string) => {
  const baseUrl = url.split('/accept-invitation')[0] || BASE_URL
  const invitationId = url.includes('?id=') ? url.split('?id=')[1] : ''
  const registrationUrl = `${baseUrl}/register?redirect=/accept-invitation%3Fid%3D${invitationId}`
  const htmlOutput = await mjml2html(baseTemplate({
    title: `You're Invited to Join ${organizationName}!`,
    bodyContent: `
      <p><strong style="color: ${HEADER_COLOR};">${inviterName}</strong> has invited you to join <strong style="color: ${PRIMARY_COLOR};">${organizationName}</strong> on ${BRAND_NAME}.</p>
      <p>${organizationName} uses ${BRAND_NAME} to manage their social media, Google My Business, and content creation. As a team member, you'll be able to collaborate on posts, schedule content, and manage your social presence together.</p>
      <p>To get started, click the button below to accept the invitation:</p>
    `,
    button: {
      text: 'Accept Invitation',
      url
    },
    secondaryButton: {
      text: "Don't have an account? Register here →",
      url: registrationUrl
    },
    footerContent: `
      This invitation will expire in a few days. If you have any questions, please contact the person who invited you.
      <br /><br />
      Best regards,<br /><strong>The ${BRAND_NAME} Team</strong>
    `
  }), options)

  return htmlOutput
}

export const newGoogleReviewAlertTemplate = async (businessName: string, reviewContent: string, reviewerName: string, reviewUrl: string) => {
  const htmlOutput = await mjml2html(baseTemplate({
    title: `New Google Review for ${businessName}!`,
    bodyContent: `
      <p>You have received a new review on Google My Business for <strong>${businessName}</strong>.</p>
      <table style="width: 100%; border: 1px solid #e0e0e0; border-radius: 8px; margin: 15px 0; background: #fafafa;">
        <tr>
          <td style="padding: 15px;">
            <p style="font-size: 13px; color: #888888; margin: 0 0 5px 0;">Reviewer: <strong style="color: ${HEADER_COLOR};">${reviewerName}</strong></p>
            <p style="font-size: 14px; color: ${HEADER_COLOR}; font-style: italic; margin: 0;">&ldquo;${reviewContent}&rdquo;</p>
          </td>
        </tr>
      </table>
      <p>You can view and respond to this review by clicking the button below.</p>
    `,
    button: {
      text: 'View & Respond to Review',
      url: reviewUrl
    }
  }), options)

  return htmlOutput.html
}
