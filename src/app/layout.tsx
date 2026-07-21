import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Roadmap Recall", template: "%s · Roadmap Recall" },
  description: "A calm learning and spaced-revision companion for anything you want to remember.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script id="theme-init" dangerouslySetInnerHTML={{ __html: `
          try {
            const saved = localStorage.getItem('roadmap-recall-theme');
            const theme = saved || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
            document.documentElement.dataset.theme = theme;
          } catch (_) {}
        ` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
