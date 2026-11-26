import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Milk } from 'lucide-react'
import { SUPPORT_EMAIL, WEBSITE } from '@/utils/contact'

// Public page at /terms (no sign-in), linked from the Play Store listing and both apps' About
// screens. English only, like the privacy policy. Update EFFECTIVE_DATE whenever the text changes.
const EFFECTIVE_DATE = '27 November 2026'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
      <div className="space-y-2 text-gray-700 dark:text-gray-300 leading-relaxed">{children}</div>
    </section>
  )
}

export function TermsPage() {
  const email = <a className="text-blue-600 dark:text-blue-400 underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
  const link = 'text-blue-600 dark:text-blue-400 underline'
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto px-5 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <Milk className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Milkmen Terms of Service</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Effective {EFFECTIVE_DATE}</p>
          </div>
        </div>

        <Section title="About these terms">
          <p>
            Milkmen is a milk collection and sales management service for milk businesses. It is run by
            Yuvaraj Semalaiyappan, Erode, Tamil Nadu, India ("we", "us"), and is available as an Android app
            and as a web app at <a className={link} href={WEBSITE}>{WEBSITE.replace('https://', '')}</a>.
            These terms apply to everyone who uses Milkmen. By creating an account or using the app, you
            agree to them. If you do not agree, please do not use Milkmen.
          </p>
        </Section>

        <Section title="Who can use Milkmen">
          <p>You must be at least 18 years old and able to make a binding agreement under Indian law. If you
            create an account for a business, you confirm that you are allowed to act for that business.</p>
        </Section>

        <Section title="Your account">
          <p>You sign in with your mobile number and a 4-digit PIN. Keep your PIN private and do not share
            it. You are responsible for everything done with your account, including by staff you add.</p>
          <p>Owners can add managers and staff to their business. The owner decides who has access and is
            responsible for removing people who should no longer have it.</p>
          <p>Give correct information when you register and keep it up to date.</p>
        </Section>

        <Section title="Plans and payment">
          <p>A new business gets a free trial of 30 days. After the trial, a paid plan (monthly, quarterly,
            half-yearly or annual) is needed to keep adding or changing records. The current price is shown
            in the app or told to you before you pay. Plans are paid to us directly, for example by UPI,
            cash or bank transfer, and are activated by us after payment.</p>
          <p>When a plan ends, you can still sign in and see all your records and reports, but you cannot
            save new entries or changes until you renew. Your records are not deleted when a plan ends.</p>
          <p>We may change plan prices. A price change does not affect a plan you have already paid for.</p>
        </Section>

        <Section title="No refunds">
          <p>All payments for Milkmen plans are final and non-refundable, including for any unused part of
            a plan. Please use the free trial to check that Milkmen suits your business before you pay.</p>
        </Section>

        <Section title="Your data">
          <p>The records you enter (farmers, customers, collections, deliveries, payments, rates, routes
            and map pins) belong to your business. We only use them to run Milkmen for you, as explained in
            our <Link className={link} to="/privacy">Privacy Policy</Link>.</p>
          <p>You are responsible for the records you enter being correct, and for having permission to
            enter the names, phone numbers, addresses and locations of the farmers and customers you work
            with.</p>
          <p>Milkmen calculates totals and balances from the entries you make. Please check important
            amounts before you pay or collect money. We are not responsible for losses caused by wrong or
            missing entries.</p>
        </Section>

        <Section title="Acceptable use">
          <p>Do not use Milkmen to break any law, to store information you have no right to keep, to send
            messages people have not agreed to receive, or to harm other people. Do not try to access
            another business's data, overload or attack the service, or copy or resell the app.</p>
          <p>Dues reminders sent by WhatsApp or SMS go from your own phone and number. You are responsible
            for the messages you choose to send.</p>
        </Section>

        <Section title="The service">
          <p>Milkmen needs an internet connection. We work to keep it available and your data safe, but we
            cannot promise that it will always be available, error-free or uninterrupted. We may change,
            add or remove features to improve the service.</p>
          <p>The Milkmen app, its name, logo and design belong to us. You may use the app for your business
            while your account is active.</p>
        </Section>

        <Section title="Limitation of liability">
          <p>Milkmen is provided "as is". To the extent allowed by Indian law, we are not liable for any
            indirect or consequential loss, such as lost profit, lost business or lost data, arising from
            your use of Milkmen. Our total liability for any claim is limited to the amount you paid us for
            Milkmen in the 3 months before the claim.</p>
        </Section>

        <Section title="Suspending or closing accounts">
          <p>We may suspend or close an account that breaks these terms or puts the service or other users
            at risk. Where we can, we will tell you first and give you a chance to fix the problem.</p>
          <p>You can stop using Milkmen at any time and ask us to delete your account from
            <strong> Settings → Delete account</strong> in the app or on
            the <Link className={link} to="/delete-account">account deletion page</Link>.</p>
        </Section>

        <Section title="Changes to these terms">
          <p>If we change these terms we will update this page and its effective date. For important
            changes we will also tell you in the app. Using Milkmen after a change means you accept the new
            terms.</p>
        </Section>

        <Section title="Law and disputes">
          <p>These terms are governed by the laws of India. Any dispute will be handled by the courts in
            Erode, Tamil Nadu. Please contact us first so we can try to sort out any problem.</p>
        </Section>

        <Section title="Contact">
          <p>Yuvaraj Semalaiyappan, Erode, Tamil Nadu, India. Email: {email}. We reply within 7 days.</p>
        </Section>
      </div>
    </div>
  )
}
