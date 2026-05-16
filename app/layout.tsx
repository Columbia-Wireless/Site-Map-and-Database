import type { Metadata } from 'next'
import './globals.css'
import LayoutWrapper from '@/components/layout/LayoutWrapper'

export const metadata: Metadata = {
  title: 'Columbia Wireless Facilities — Site Management',
  description: 'Telecom site asset management platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <LayoutWrapper>{children}</LayoutWrapper>
      </body>
    </html>
  )
}
