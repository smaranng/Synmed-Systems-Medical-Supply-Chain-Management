import BlueSpinner from "./BlueSpinner";

export default function FullScreenLoader() {
  return (
    <div className="
      fixed inset-0 z-50
      flex flex-col items-center justify-center
      bg-gradient-to-br from-[#0A1D37] via-[#123B6B] to-[#4BA3C3]
    ">
      <BlueSpinner />
      <p className="mt-6 text-white font-medium tracking-widest animate-pulse uppercase">
        Loading Customer dashboard...
      </p>
    </div>
  );
}
