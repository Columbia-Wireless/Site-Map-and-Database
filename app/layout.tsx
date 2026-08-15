import type { Metadata } from 'next'
import './globals.css'
import LayoutWrapper from '@/components/layout/LayoutWrapper'
import { OrgLabelProvider } from '@/contexts/OrgLabelContext'
import { getProfile } from '@/lib/profile'

export const metadata: Metadata = {
  title: 'Columbia Wireless Site Asset Management',
  description: 'Telecom site asset management platform — powered by VeriPura',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile()
  const labels = {
    ownerSingular: profile?.owner_label_singular ?? 'Owner',
    ownerPlural: profile?.owner_label_plural ?? 'Owners',
  }

  return (
    <html lang="en">
      <body>
        <OrgLabelProvider labels={labels}>
          <LayoutWrapper>{children}</LayoutWrapper>
        </OrgLabelProvider>
      </body>
    </html>
  )
}
