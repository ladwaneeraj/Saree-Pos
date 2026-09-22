import { barRects, code128B } from "@/lib/barcode";

/** SVG Code 128 barcode for a SKU. Encodes the SKU only. */
export function Barcode({ value, height = 44, moduleWidth = 1.6, className }: { value: string; height?: number; moduleWidth?: number; className?: string }) {
  const pattern = code128B(value);
  const quiet = 10;
  const width = (pattern.length + quiet * 2) * moduleWidth;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className={className} role="img" aria-label={`Barcode ${value}`} shapeRendering="crispEdges">
      <rect width={width} height={height} fill="white" />
      {barRects(pattern).map(([x, w]) => (
        <rect key={x} x={(x + quiet) * moduleWidth} y={0} width={w * moduleWidth} height={height} fill="black" />
      ))}
    </svg>
  );
}
