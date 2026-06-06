import { Link } from "react-router-dom";
import { Mail, Phone, MapPin } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-[#27082b] text-purple-100 mt-auto">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">

          {/* About */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-white">
              SYNMED Systems
            </h3>
            <p className="text-sm leading-relaxed">
              Centralized administrative platform to govern distributors,
              pharmacies, logistics, and compliance across the medical
              supply chain.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-white">
              Quick Links
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/" className="hover:text-[#C026D3] transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/orders" className="hover:text-[#C026D3] transition-colors">
                  Order Monitoring
                </Link>
              </li>
              <li>
                <Link to="/analytics" className="hover:text-[#C026D3] transition-colors">
                  Analytics
                </Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-[#C026D3] transition-colors">
                  About System
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
                <Link to="/help" className="hover:text-[#C026D3] transition-colors">
                  Help Center
                </Link>
              </li>
              <li>
                <Link to="/faq" className="hover:text-[#C026D3] transition-colors">
                  FAQ
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="hover:text-[#C026D3] transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-[#C026D3] transition-colors">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-white">
              Contact
            </h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start space-x-2">
                <Mail className="w-5 h-5 mt-0.5 text-[#C026D3]" />
                <span>admin-support@synmedsystems.com</span>
              </li>
              <li className="flex items-start space-x-2">
                <Phone className="w-5 h-5 mt-0.5 text-[#C026D3]" />
                <span>1-800-MED-ADMIN</span>
              </li>
              <li className="flex items-start space-x-2">
                <MapPin className="w-5 h-5 mt-0.5 text-[#C026D3]" />
                <span>Bengaluru, India</span>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="border-t border-[#8a0691] mt-10 pt-6 text-center text-sm">
          <p>
            &copy; {new Date().getFullYear()} SYNMED Systems. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
