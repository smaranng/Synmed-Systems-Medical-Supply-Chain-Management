import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import {
  Package,
  TrendingUp,
  AlertTriangle,
  Truck,
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

export default function DistributorLandingPage() {
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
      <section data-lazy className="hero lazy-section bg-gradient-to-r from-[#c13c08] to-[#cd7605] text-white py-20">
        <div className="container mx-auto px-6 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Intelligent Supply Management for Medicine Distributors
          </h1>

          <p className="text-lg md:text-xl max-w-3xl mx-auto mb-8 text-orange-200">
            Manage bulk orders, streamline pharmacy fulfillment, track inventory movement,
            and optimize distribution — all from one unified distributor platform.
          </p>


        </div>
      </section>

      {/* Features Section */}
      <section data-lazy className="lazy-section py-20 bg-gray-50">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12 text-[#0A1D37]">
            Designed for Distributor Operations
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Package className="h-10 w-10 text-blue-600" />}
              title="Bulk Inventory Management"
              desc="Manage large-scale medicine inventory with batch, expiry, and quantity tracking."
            />

            <FeatureCard
              icon={<Truck className="h-10 w-10 text-indigo-600" />}
              title="Pharmacy Order Fulfillment"
              desc="Receive, process, and dispatch pharmacy orders efficiently with real-time status updates."
            />

            <FeatureCard
              icon={<TrendingUp className="h-10 w-10 text-green-600" />}
              title="Demand & Sales Insights"
              desc="Analyze pharmacy demand trends to plan stock, pricing, and distribution strategies."
            />

            <FeatureCard
              icon={<AlertTriangle className="h-10 w-10 text-orange-500" />}
              title="Expiry Risk Monitoring"
              desc="Identify slow-moving and near-expiry stock early to reduce losses."
            />

            <FeatureCard
              icon={<ShieldCheck className="h-10 w-10 text-teal-600" />}
              title="Compliance & Audit Ready"
              desc="Maintain regulatory compliance with logs, reports, and controlled access."
            />

            <FeatureCard
              icon={<Package className="h-10 w-10 text-purple-600" />}
              title="Multi-Pharmacy Integration"
              desc="Serve multiple pharmacies and hubs from a single centralized dashboard."
            />

          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section data-lazy className="lazy-section py-16 bg-[#f8d8c0]">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-6 text-[#5c2e13]">
            How It Works
          </h2>
          <p className="text-[#2a1810] max-w-2xl mx-auto mb-10">
            A simple, automated workflow built around your pharmacy.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 justify-items-center">
            {[
              "Maintain centralized distributor inventory",
              "Receive pharmacy purchase orders",
              "Process, pack, and dispatch medicines",
              "Track delivery and settlement status",
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
      <section data-lazy className="lazy-section py-16 bg-[#b03e0e] text-center">

        <h2 className="text-3xl font-bold mb-4 text-white">
          Empower Your Medicine Distribution Network
        </h2>

        <p className="text-orange-300 mb-6">
          Serve pharmacies faster, reduce wastage, and scale your operations intelligently.
        </p>

        <Button
          className="bg-[#de5b10] hover:bg-[#b94a0a] text-white"
          onClick={() => navigate("/distributor/register")}
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
      <div className="z-10 w-12 h-12 rounded-full bg-[#ac3c0c] text-white flex items-center justify-center font-bold text-lg shadow-lg">
        {step}
      </div>

      {/* Hanging Card */}
      <div
        className={`mt-[-6px] ${flapClass}`}
        style={{ animationDelay: `${index * 0.8}s` }}
      >
        <Card className="w-64">
          <CardContent className="p-6 text-center bg-[#fdf4ff] rounded-xl shadow-md">
            <p className="text-gray-800 font-medium">{text}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};


