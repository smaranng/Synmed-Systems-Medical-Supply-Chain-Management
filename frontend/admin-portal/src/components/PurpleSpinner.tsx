export default function PurpleSpinner() {
  return (
    <div className="relative w-[65px] aspect-square">
      {/* Light Purple Inner Ring */}
      <span className="absolute rounded-[50px] animate-loaderAnim shadow-[inset_0_0_0_3px] shadow-purple-100/50" />
      {/* Fuchsia Action Ring */}
      <span className="absolute rounded-[50px] animate-loaderAnim animation-delay shadow-[inset_0_0_0_3px] shadow-fuchsia-400" />

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