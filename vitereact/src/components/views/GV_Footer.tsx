import React from 'react';
import { Link } from 'react-router-dom';

// --- Define the static content with types ---
interface FooterLink {
  label: string;
  url: string;
}

const policy_links: FooterLink[] = [
  { label: "Terms", url: "/terms" },
  { label: "Privacy", url: "/privacy" },
  { label: "Refund", url: "/refund-policy" },
  { label: "Contact", url: "/contact" },
];

const social_links: FooterLink[] = [
  { label: "Instagram", url: "https://instagram.com/aiocart" },
  { label: "Twitter", url: "https://twitter.com/aiocart" },
];

const support_note = "Need help? Contact us at support@aiocart.com";

const GV_Footer: React.FC = () => {
  return (
    <>
      <footer
        className="w-full bg-gray-50 border-t border-gray-200 text-gray-600 text-sm mt-auto"
        role="contentinfo"
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-y-6 md:gap-y-0 px-4 py-6 sm:px-6 lg:px-8">
          {/* Branding and short note */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-2 md:mb-0">
            <span className="text-lg font-bold text-gray-900" aria-label="AIOCart Home">
              <Link to="/" className="hover:text-blue-600 transition-colors">AIOCart</Link>
            </span>
            <span className="hidden sm:inline" aria-hidden="true">&middot;</span>
            <span className="text-gray-500">
              Empowering e-commerce with AI &amp; real-time experience
            </span>
          </div>

          {/* Policy/info links */}
          <nav
            aria-label="Footer Navigation"
            className="flex flex-wrap gap-x-5 gap-y-2 items-center"
          >
            {policy_links.map((link) =>
              link.url.startsWith('http') ? (
                // In case any link is ever changed to an http url (defensive)
                <a
                  key={link.label}
                  href={link.url}
                  className="hover:text-blue-600 underline transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                  tabIndex={0}
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.label}
                  to={link.url}
                  className="hover:text-blue-600 underline transition-colors"
                  tabIndex={0}
                >
                  {link.label}
                </Link>
              )
            )}
          </nav>

          {/* Social and support */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs md:text-sm">
            {/* Social Media */}
            <div className="flex flex-row items-center gap-x-4">
              {social_links.map((link) => (
                <a
                  key={link.label}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={link.label}
                  className="flex items-center group hover:text-blue-600 transition-colors"
                  tabIndex={0}
                >
                  {/* Unicode Emoji "Icons" */}
                  <span
                    className="text-lg mr-1 select-none"
                    aria-hidden="true"
                  >
                    {link.label === 'Instagram' ? '📸' : link.label === 'Twitter' ? '🐦' : '🔗'}
                  </span>
                  <span className="underline group-hover:text-blue-600">{link.label}</span>
                </a>
              ))}
            </div>
            {/* Support Note */}
            <span className="block sm:ml-4 text-gray-400" aria-live="polite">
              {support_note}
            </span>
          </div>
        </div>
      </footer>
    </>
  );
};

export default GV_Footer;