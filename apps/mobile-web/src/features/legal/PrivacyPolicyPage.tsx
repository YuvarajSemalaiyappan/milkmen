import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Milk } from 'lucide-react'
import { SUPPORT_EMAIL, WEBSITE } from '@/utils/contact'

// Public page at /privacy (no sign-in), linked from the Play Store listing, both apps and the
// delete-account pages. English only. Update EFFECTIVE_DATE whenever the text changes.
const EFFECTIVE_DATE = '25 November 2026'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
      <div className="space-y-2 text-gray-700 dark:text-gray-300 leading-relaxed">{children}</div>
    </section>
  )
}

export function PrivacyPolicyPage() {
  const email = <a className="text-blue-600 dark:text-blue-400 underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto px-5 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <Milk className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Milkmen Privacy Policy</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Effective {EFFECTIVE_DATE}</p>
          </div>
        </div>

        <Section title="Who we are">
          <p>
            Milkmen is a milk collection and sales management service for milk businesses, made by Yuvaraj
            Semalaiyappan, Erode, Tamil Nadu, India. It is available as an Android app and as a web app
            at <a className="text-blue-600 dark:text-blue-400 underline" href={WEBSITE}>{WEBSITE.replace('https://', '')}</a>.
            This policy explains what information Milkmen keeps, why, and the choices you have.
            Questions: {email}.
          </p>
        </Section>

        <Section title="Information we keep">
          <p><strong>Your account.</strong> Your name, mobile number, role (owner, manager or staff) and a
            scrambled (hashed) copy of your 4-digit PIN. We never store the PIN itself. For owners we also
            keep the business name, phone number and address you enter.</p>
          <p><strong>Business records you enter.</strong> Names, phone numbers, villages or addresses of the
            farmers and customers you work with; milk collections and deliveries (date, shift, quantity,
            fat, rate, amount); payments; rates; routes and areas; and the order you visit people in.</p>
          <p><strong>Map pins.</strong> If you pin a farmer's or customer's house in the phone app, we keep that
            location, a landmark, how accurate the pin was, and who set it and when.</p>
          <p><strong>Plan details.</strong> Your plan, its dates and the payments recorded for it.</p>
          <p><strong>Technical logs.</strong> When a request to our server fails or is slow, we log the address
            called, the result, the time taken, the time, and your user and business ID, so we can fix
            problems. These logs are deleted after 90 days.</p>
        </Section>

        <Section title="Information that stays on your phone">
          <p><strong>Location.</strong> The phone app asks for your location only while you use a map or pin a
            house, never in the background. Your location is sent to our server only when you save a pin. The
            route you travelled today is shown on the map but is kept only in the phone's memory and is never
            sent to us.</p>
          <p><strong>Fingerprint.</strong> App lock uses Android's own fingerprint check. Milkmen never sees or
            stores your fingerprint.</p>
          <p><strong>Reminders.</strong> Plan-expiry and dues reminders are scheduled on your phone. We do not
            use push notification services.</p>
          <p><strong>Messages and files.</strong> Dues reminders by WhatsApp or SMS open in your own WhatsApp or
            messaging app, and you choose whether to send them. Excel reports are created on your phone and
            shared only where you choose.</p>
        </Section>

        <Section title="How we use it">
          <p>Only to run Milkmen for your business: to show your records and reports, keep balances correct,
            let your staff work on the same data, manage your plan, contact you about your account, and keep
            the service working and secure.</p>
          <p>We do not sell your information, we do not show ads, and we do not use analytics or tracking
            tools.</p>
        </Section>

        <Section title="Who we share it with">
          <p><strong>People in your business.</strong> Owners, managers and staff of the same business can see
            the business's records, according to their role.</p>
          <p><strong>Service providers.</strong> Our server runs on Render and our database on Neon. They store
            the data for us and may keep it on servers outside India.</p>
          <p><strong>Google Maps.</strong> Maps in the phone app are provided by Google. When a map is open,
            Google receives the map area being shown, and the "Navigate" button opens the Google Maps app.
            Google's use of this is covered by Google's privacy policy.</p>
          <p><strong>The law.</strong> We will share information if Indian law requires it.</p>
        </Section>

        <Section title="Farmers' and customers' details">
          <p>Businesses enter details of their farmers and customers. The business decides what to enter and
            is responsible for having their permission. If you are a farmer or customer and want your details
            corrected or removed, ask the business, or email us at {email} and we will pass it on.</p>
        </Section>

        <Section title="Security">
          <p>Data is sent over encrypted connections (HTTPS). PINs are stored only as hashes. Each business's
            records are kept separate and can only be read by signed-in users of that business. No system is
            perfectly secure, so please keep your PIN private.</p>
        </Section>

        <Section title="How long we keep it">
          <p>We keep your records while your account exists, including after a plan ends, so you don't lose
            them if you renew. When an account is deleted, its records are removed from our database. Copies
            may stay in our database provider's short-term backups for a few days, and technical logs are
            removed after 90 days. We keep a short note of the deletion request itself (name, phone number,
            date) as a record that we handled it.</p>
        </Section>

        <Section title="Deleting your account">
          <p>In either app, open <strong>Settings → Delete account</strong>, or use
            the <Link className="text-blue-600 dark:text-blue-400 underline" to="/delete-account">account deletion page</Link> without
            signing in. We check each request (we may call you first) and delete the data within 30 days.
            If the owner's account is deleted, the whole business is deleted, including its staff logins. If
            a staff member's account is deleted, only that login is removed and the business's records stay
            with the owner.</p>
        </Section>

        <Section title="Your choices">
          <p>You can see and correct your records in the app at any time, and owners can download reports.
            To get a copy of your information, correct something you can't change in the app, or delete your
            account, email {email}.</p>
        </Section>

        <Section title="Children">
          <p>Milkmen is a business tool for adults. It is not meant for anyone under 18.</p>
        </Section>

        <Section title="Changes to this policy">
          <p>If we change this policy we will update this page and its effective date. For important changes
            we will also tell you in the app.</p>
        </Section>

        <Section title="Contact and grievances">
          <p>Yuvaraj Semalaiyappan, Erode, Tamil Nadu, India. Email: {email}. We reply within 7 days.</p>
        </Section>
      </div>
    </div>
  )
}
