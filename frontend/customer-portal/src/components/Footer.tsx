import { Link } from "react-router-dom";
import { Mail, Phone, MapPin } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-[#011f4a] text-slate-200 mt-auto">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">

          {/* About */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-white">
              SYNMED Systems
            </h3>
            <p className="text-blue-100 text-sm leading-relaxed">
              Your trusted platform to find medicines from verified nearby
              pharmacies and pick them up instantly.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-white">
              Quick Links
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/" className="text-white hover:text-[#60A5FA] transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/search" className="text-white hover:text-[#60A5FA] transition-colors">
                  Search Medicines
                </Link>
              </li>
              <li>
                <Link to="/orders" className="text-white hover:text-[#60A5FA] transition-colors">
                  Track Orders
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-white hover:text-[#60A5FA] transition-colors">
                  About Us
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-white">
              Support
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/help" className="text-white hover:text-[#60A5FA] transition-colors">
                  Help Center
                </Link>
              </li>
              <li>
                <Link to="/faq" className="text-white hover:text-[#60A5FA] transition-colors">
                  FAQ
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="text-white hover:text-[#60A5FA] transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-white hover:text-[#60A5FA] transition-colors">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-white">
              Contact Us
            </h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start space-x-2 text-white">
                <Mail className="w-5 h-5 mt-0.5 text-[#60A5FA]" />
                <span>support@medicalsupply.com</span>
              </li>
              <li className="flex items-start space-x-2 text-white">
                <Phone className="w-5 h-5 mt-0.5 text-[#60A5FA]" />
                <span>1-800-MEDICAL</span>
              </li>
              <li className="flex items-start space-x-2 text-white">
                <MapPin className="w-5 h-5 mt-0.5 text-[#60A5FA]" />
                <span>Healthcare City, India</span>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="border-t border-blue-600 mt-10 pt-6 text-center text-sm text-white">
          <p>
            &copy; {new Date().getFullYear()} SYNMED Systems. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
