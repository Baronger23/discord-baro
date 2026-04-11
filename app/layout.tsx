import type { Metadata } from 'next'
import './globals.css'
import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from '@clerk/nextjs'
import { QueryProvider } from '@/components/providers/query-provider'
import { Geist, Geist_Mono } from 'next/font/google'
import Script from 'next/script'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { cn } from '@/lib/utils'
import { ModalProvider } from '@/components/providers/modal-provider'
import { SocketProvider } from '@/components/providers/socket-provider'
import { IncomingCallModal } from '@/components/incoming-call-modal'
import { PresenceTracker } from '@/components/presence-tracker'
const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'VibeCord',
  description: 'A real-time chat application built with Next.js, Socket.IO, and Prisma ORM.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignInUrl="/"
      afterSignUpUrl="/"
    >
      <html lang="en" suppressHydrationWarning>
        <body
          suppressHydrationWarning
          className={cn(geistSans.className,
            "bg-white dark:bg-[#313338]"
          )}
        >
          <Script id="sanitize-extension-attrs" strategy="beforeInteractive">
            {`(function(){
              var removeInjectedAttrs = function () {
                var all = document.querySelectorAll('*');
                for (var i = 0; i < all.length; i++) {
                  var el = all[i];
                  var attrs = el.getAttributeNames ? el.getAttributeNames() : [];
                  for (var j = 0; j < attrs.length; j++) {
                    var name = attrs[j];
                    if (
                      name === 'bis_skin_checked' ||
                      name === 'bis_register' ||
                      name.indexOf('bis_') === 0 ||
                      name.indexOf('__processed_') === 0
                    ) {
                      el.removeAttribute(name);
                    }
                  }
                }
              };
              removeInjectedAttrs();
              document.addEventListener('DOMContentLoaded', removeInjectedAttrs);
            })();`}
          </Script>
          <ThemeProvider 
            attribute="class" 
            defaultTheme="dark" 
            enableSystem={false}
            disableTransitionOnChange
          >
            <SocketProvider>
              <PresenceTracker />
              <IncomingCallModal />
              <ModalProvider />
              <QueryProvider>
                {children}
              </QueryProvider>
            </SocketProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}