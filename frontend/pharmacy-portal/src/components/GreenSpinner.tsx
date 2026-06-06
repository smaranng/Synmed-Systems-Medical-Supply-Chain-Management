export default function GreenSpinner() {
  return (
    <div className="relative w-[65px] aspect-square">
      {/* Light Emerald Background Ring */}
      <span className="absolute rounded-[50px] animate-loaderAnim bg-white/10 shadow-[inset_0_0_0_3px] shadow-emerald-200" />
      {/* Deep Green Action Ring */}
      <span className="absolute rounded-[50px] animate-loaderAnim animation-delay bg-white/10 shadow-[inset_0_0_0_3px] shadow-teal-400" />

      <style>{`
        @keyframes loaderAnim {
          0% { inset: 0 35px 35px 0; }
          12.5% { inset: 0 35px 0 0; }
          25% { inset: 35px 35px 0 0; }
          37.5% { inset: 35px 0 0 0; }
          50% { inset: 35px 0 0 35px; }
          62.5% { inset: 0 0 0 35px; }
          75% { inset: 0 0 35px 35px; }
          87.5% { inset: 0 0 35px 0; }
          100% { inset: 0 35px 35px 0; }
        }
        .animate-loaderAnim {
          animation: loaderAnim 2.5s infinite ease-in-out;
        }
        .animation-delay {
          animation-delay: -1.25s;
        }
      `}</style>
    </div>
  );
}