import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import {
  Package,
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card, CardContent } from "../components/ui/Card";
import Header from "../components/Header";
import Footer from "../components/Footer";


interface StepCardProps {
  step: number;
  text: string;
}
interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  desc: string;
}
const lazyStyles = `
/* ---------- Section Reveal ---------- */
[data-lazy] {
  opacity: 0;
  transform: translateY(16px);
  transition:
    opacity 700ms ease,
    transform 800ms cubic-bezier(0.22, 1, 0.36, 1);
}

[data-lazy].lazy-visible {
  opacity: 1;
  transform: translateY(0);
}

/* ---------- Hero refinement ---------- */
[data-lazy].hero {
  transform: scale(0.96);
}
[data-lazy].hero.lazy-visible {
  transform: scale(1);
}

/* ---------- Child items ---------- */
.lazy-child {
  opacity: 0;
  transform: translateY(8px);
  transition:
    opacity 500ms ease,
    transform 600ms cubic-bezier(0.22, 1, 0.36, 1);
}

.lazy-child.lazy-child-visible {
  opacity: 1;
  transform: translateY(0);
}

/* ---------- Reduced motion support ---------- */
@media (prefers-reduced-motion: reduce) {
  [data-lazy],
  .lazy-child {
    transition: none !important;
    transform: none !important;
    opacity: 1 !important;
  }
}
`;
export default function CustomerLandingPage() {
  const navigate = useNavigate();

useEffect(() => {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const section = entry.target as HTMLElement;

        const children = Array.from(
          section.querySelectorAll(".lazy-child")
        ) as HTMLElement[];

        if (entry.isIntersecting) {
          section.classList.add("lazy-visible");
          children.forEach((child, i) => {
            child.style.transitionDelay = `${i * 80}ms`;
            child.classList.add("lazy-child-visible");
          });
        } else {
          section.classList.remove("lazy-visible");
          children.forEach((child) => {
            child.style.transitionDelay = "0ms";
            child.classList.remove("lazy-child-visible");
          });
        }
      });
    },
    { threshold: 0.35, rootMargin: "0px 0px -80px 0px" }
  );

  document.querySelectorAll("[data-lazy]").forEach((el) => io.observe(el));
  return () => io.disconnect();
}, []);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <style>{lazyStyles}</style>

      {/* Hero Section */}
      <section data-lazy className="hero lazy-section bg-gradient-to-r from-[#0A1D37] to-[#2563EB] text-white py-20">
        <div className="container mx-auto px-6 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Easy Medicine Pickup from Nearby Pharmacies
          </h1>
          <p className="text-lg md:text-xl max-w-3xl mx-auto mb-8 text-blue-200">
            Search medicines, choose a nearby pharmacy, generate your bill
            online or at a kiosk, and pick up instantly — no delivery required.
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section data-lazy className="lazy-section py-20 bg-gray-50">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12 text-[#0A1D37]">
            Designed for Walk-In & Kiosk Customers
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Package className="h-10 w-10 text-blue-600" />}
              title="Live Pharmacy Availability"
              desc="See which nearby pharmacy has all required medicines in stock."
            />
            <FeatureCard
              icon={<AlertTriangle className="h-10 w-10 text-yellow-500" />}
              title="Expiry-Safe Billing (FEFO)"
              desc="Medicines are billed using First-Expiry-First-Out to ensure safety."
            />
            <FeatureCard
              icon={<TrendingUp className="h-10 w-10 text-green-600" />}
              title="Instant Stock Update"
              desc="Stock is reduced automatically the moment your bill is generated."
            />
            <FeatureCard
              icon={<Package className="h-10 w-10 text-indigo-600" />}
              title="No Ordering. No Waiting."
              desc="Generate your bill and collect medicines instantly from the pharmacy."
            />
            <FeatureCard
              icon={<ShieldCheck className="h-10 w-10 text-teal-600" />}
              title="Secure & Transparent"
              desc="Accurate billing, verified batches, and secure transaction records."
            />
            <FeatureCard
              icon={<Package className="h-10 w-10 text-purple-600" />}
              title="Portal & Kiosk Support"
              desc="Use mobile portal or in-store kiosk for a self-service experience."
            />
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section data-lazy className="lazy-section py-16 bg-[#bedbfe]">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-6 text-[#1c388d]">
            How It Works
          </h2>
          <p className="text-[#0d2239] max-w-2xl mx-auto mb-10">
            A simple, automated workflow built around your pharmacy.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 justify-items-center">
            {[
              "Search medicines near you",
              "Select pharmacy with full availability",
              "Generate bill via portal or kiosk",
              "Pick up medicines instantly",
            ].map((text, index) => (
              <StepCard
                key={index}
                step={index + 1}
                text={text}
                index={index}
              />
            ))}
          </div>

        </div>
      </section>

      {/* CTA Section */}
      <section data-lazy className="lazy-section py-16 bg-[#2563EB] text-center">
        <h2 className="text-3xl font-bold mb-4 text-white">
          Search Medicines, Instant Pickup.
        </h2>

        <p className="mb-6 text-blue-100">
          No queues, no uncertainty — just smart pharmacy access.
        </p>

        <Button
          className="bg-[#3e92eb] hover:bg-[#3c7fc6]
"

          onClick={() => navigate("/customer/register")}
        >
          Get Started
        </Button>
      </section>
      <Footer />
    </div>
  );
}

/* ---------- Reusable Components ---------- */

const FeatureCard = ({ icon, title, desc }: FeatureCardProps) => (
  <Card className="hover:shadow-lg transition lazy-child">
    <CardContent className="p-6 text-center">
      <div className="flex justify-center mb-4">{icon}</div>
      <h3 className="font-semibold text-lg mb-2 text-black">{title}</h3>
      <p className="text-gray-600 text-sm">{desc}</p>
    </CardContent>
  </Card>
);

const StepCard = ({ step, text, index }) => {
  const flapClass = index % 2 === 0 ? "flap-top" : "flap-bottom";

  return (
    <div
      className="relative flex flex-col items-center lazy-child"
      style={{ animationDelay: `${index * 0.8}s` }}
    >
      {/* Nail */}
      <div className="z-10 w-12 h-12 rounded-full bg-[#0b49a0] text-white flex items-center justify-center font-bold text-lg shadow-lg">
        {step}
      </div>

      {/* Hanging Card */}
      <div
        className={`mt-[-6px] ${flapClass}`}
        style={{ animationDelay: `${index * 0.8}s` }}
      >
        <Card className="w-64">
          <CardContent className="p-6 text-center bg-[#ffffff] rounded-xl shadow-md">
            <p className="text-gray-800 font-medium">{text}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
