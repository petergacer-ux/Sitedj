import type { Metadata, Viewport } from "next";
import { Unbounded, Manrope } from "next/font/google";
import "./globals.css";
import { tokensToCss, colors } from "@/styles/tokens";
import { entreprise } from "@/content/site";
import { siteUrl } from "@/lib/seo";
import { Providers } from "@/components/Providers";
import { SmoothScroll } from "@/components/SmoothScroll";
import { Cursor } from "@/components/Cursor";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const display = Unbounded({ subsets: ["latin"], variable: "--font-display", weight: ["300", "400", "500", "600", "700"], display: "swap" });
const body = Manrope({ subsets: ["latin"], variable: "--font-body", display: "swap" });

const description = `${entreprise.nom} — DJ animateur à ${entreprise.adresse.ville} (${entreprise.adresse.departement}). ${entreprise.metiers.join(", ")} pour mariages, anniversaires, soirées d'entreprise et cocktails. Demandez votre devis.`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${entreprise.nom} · DJ mariage & événements dans le Val-d'Oise`,
    template: `%s · ${entreprise.nom}`,
  },
  description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: entreprise.nom,
    title: `${entreprise.nom} — ${entreprise.slogan}`,
    description,
  },
  twitter: { card: "summary_large_image" },
  formatDetection: { telephone: true },
};

export const viewport: Viewport = {
  themeColor: colors.night950,
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${display.variable} ${body.variable}`}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: tokensToCss() }} />
      </head>
      <body>
        <Providers>
          <SmoothScroll />
          <Cursor />
          <Header />
          <main id="contenu">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
