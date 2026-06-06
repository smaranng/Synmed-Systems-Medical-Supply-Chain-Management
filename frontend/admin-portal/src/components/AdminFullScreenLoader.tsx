import PurpleSpinner from "./PurpleSpinner";

export default function AdminFullScreenLoader() {
  return (
    <div
      className="
        fixed inset-0 z-50
        flex flex-col items-center justify-center
        bg-gradient-to-br from-[#2A044A] via-[#4A0F73] to-[#7A1E96]
      "
    >
      <PurpleSpinner />
      <p className="mt-6 text-white font-medium tracking-widest animate-pulse uppercase">
        Loading Admin Dashboard...
      </p>
    </div>
  );
}