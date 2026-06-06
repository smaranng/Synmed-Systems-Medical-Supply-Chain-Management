import GreenSpinner from "./GreenSpinner";

export default function PharmacyFullScreenLoader() {
  return (
    <div
      className="
        fixed inset-0 z-[999]
        flex flex-col items-center justify-center
        bg-gradient-to-br from-[#064E3B] via-[#047857] to-[#10B981]
      "
    >
      <GreenSpinner />
      <p className="mt-8 text-white text-base font-medium tracking-widest animate-pulse uppercase">
        Loading Pharmacy dashboard...
      </p>
    </div>
  );
}