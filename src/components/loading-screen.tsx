export function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-void">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/vyral-icon-square.png" alt="" className="w-16 h-16 object-contain animate-pulse" />
      <div className="text-center">
        <div className="text-sm font-semibold tracking-[0.2em]">VYRAL</div>
        <div className="text-xs text-steel mt-1">Your world. Connected.</div>
      </div>
    </div>
  );
}
