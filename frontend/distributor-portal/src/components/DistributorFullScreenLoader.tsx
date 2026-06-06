import OrangeSpinner from "./OrangeSpinner";

export default function DistributorFullScreenLoader() {
  return (
    <div
      className="
        fixed inset-0 z-[999]
        flex flex-col items-center justify-center
        bg-gradient-to-br from-[#C2410C] to-[#f69c3c]
      "
    >
      <OrangeSpinner />
      <p className="mt-8 text-white font-medium text-base tracking-widest animate-pulse uppercase">
        Loading distributor dashboard...
      </p>
    </div>
  );
}
