import qrcode from "qrcode-generator";

/** SVG QR code for a upi://pay link. */
export function UpiQr({ uri, size = 96, className }: { uri: string; size?: number; className?: string }) {
  const qr = qrcode(0, "M");
  qr.addData(uri);
  qr.make();
  const n = qr.getModuleCount();
  const cells: string[] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) cells.push(`M${c + 1} ${r + 1}h1v1h-1z`);
  return (
    <svg viewBox={`0 0 ${n + 2} ${n + 2}`} width={size} height={size} className={className} role="img" aria-label="UPI payment QR code" shapeRendering="crispEdges">
      <rect width={n + 2} height={n + 2} fill="white" />
      <path d={cells.join("")} fill="black" />
    </svg>
  );
}
