import type { User } from 'better-auth'
import { userPasswordResetTemplate, userVerificationTemplate, organizationInvitationTemplate, notificationTemplate, notificationDigestTemplate } from './emailTemplates'

export interface EmailOptions {
  from: string
  to: string | string[]
  subject: string
  html?: string
  text?: string
}
export interface EmailService {
  send: (emailOptions: EmailOptions) => Promise<void>
}

export const useMailgun = (): EmailService => {
  const MAILGUN_API_KEY = process.env.NUXT_MAILGUN_API_KEY
  const MAILGUN_DOMAIN = process.env.NUXT_MAILGUN_DOMAIN
  const MAILGUN_API_URL = `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`

  const send = async (emailOptions: EmailOptions): Promise<void> => {
    if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
      throw new Error('Mailgun API key or domain is missing')
    }

    const { to, from, subject, text, html } = emailOptions
    if (!to || !from || (!text && !html)) {
      throw new Error('Required email fields are missing')
    }

    const formData = new FormData()
    formData.append('from', from)
    formData.append('to', Array.isArray(to) ? to.join(',') : to)
    formData.append('subject', subject)
    if (text)
      formData.append('text', text)
    if (html)
      formData.append('html', html)

    try {
      const unencodedCredential = `api:${MAILGUN_API_KEY}`
      const encodedCredentials = typeof Buffer !== 'undefined'
        ? Buffer.from(unencodedCredential).toString('base64')
        // Use `btoa` in non-Node environments
        : btoa(unencodedCredential)

      await $fetch(MAILGUN_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${encodedCredentials}`
        },
        body: formData
      })
      log.info({ message: 'Email sent via Mailgun' })
    } catch (error) {
      log.error({ message: 'Failed to send email with Mailgun', error: String(error) })
      throw new Error('Email sending failed with Mailgun')
    }
  }

  return { send }
}

export const sendUserVerificationEmail = async (user: User, url: string) => {
  const emailMJML = await userVerificationTemplate(url, user)

  try {
    await useMailgun().send({
      from: process.env.NUXT_MAIL_FROM_EMAIL || 'no-reply@localhost.com',
      to: user.email,
      subject: 'Email Verification',
      html: emailMJML.html
    })
    log.info({ message: 'Email sent successfully' })
  } catch (error) {
    log.error({ message: 'Failed to send email', error: String(error) })
  }
}

export const sendUserPasswordResetEmail = async (url: string, user: User) => {
  const emailHTML = await userPasswordResetTemplate(url, user)
  try {
    await useMailgun().send({
      from: process.env.NUXT_MAIL_FROM_EMAIL || 'no-reply@localhost.com',
      to: user.email,
      subject: 'Password Reset',
      html: emailHTML.html
    })
    log.info({ message: 'Email sent successfully' })
  } catch (error) {
    log.error({ message: 'Failed to send email', error: String(error) })
  }
}

export const sendOrganizationInvitationEmail = async (email: string, url: string, inviterName: string, organizationName: string) => {
  const emailHTML = await organizationInvitationTemplate(url, inviterName, organizationName)
  try {
    await useMailgun().send({
      from: process.env.NUXT_MAIL_FROM_EMAIL || 'no-reply@localhost.com',
      to: email,
      subject: `You're invited to join ${organizationName}`,
      html: emailHTML.html
    })
    log.info({ message: 'Invitation email sent successfully' })
  } catch (error) {
    log.error({ message: 'Failed to send invitation email', error: String(error) })
  }
}

export const sendNotificationEmail = async (email: string, title: string, message: string, actionUrl?: string) => {
  const emailHTML = await notificationTemplate(title, message, actionUrl)
  try {
    await useMailgun().send({
      from: process.env.NUXT_MAIL_FROM_EMAIL || 'no-reply@localhost.com',
      to: email,
      subject: title,
      html: emailHTML.html
    })
    log.info({ message: 'Notification email sent successfully' })
  } catch (error) {
    log.error({ message: 'Failed to send notification email', error: String(error) })
    throw error
  }
}

export const sendNotificationDigestEmail = async (email: string, userName: string, items: { title: string; message: string; actionUrl?: string | null }[]) => {
  const emailHTML = await notificationDigestTemplate(userName, items)
  try {
    await useMailgun().send({
      from: process.env.NUXT_MAIL_FROM_EMAIL || 'no-reply@localhost.com',
      to: email,
      subject: `Your daily MagicSync digest (${items.length} unread)`,
      html: emailHTML.html
    })
    log.info({ message: 'Notification digest email sent successfully' })
  } catch (error) {
    log.error({ message: 'Failed to send notification digest email', error: String(error) })
    throw error
  }
}
