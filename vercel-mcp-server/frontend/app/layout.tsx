import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Vercel MCP Server',
  description: 'Model Context Protocol Server deployed on Vercel',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
} 