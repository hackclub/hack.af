import type { Handle } from "remix/component";
import QRCode from "qrcode";
import { qrPath, type QrMatrix } from "./public/qr-render.ts";

// Generated locally so slugs aren't sent to a third-party QR service
export function qrMatrix(value: string): QrMatrix {
  const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  let bits = "";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) bits += qr.modules.get(y, x) ? "1" : "0";
  }
  return { size, bits };
}

const PREVIEW_PADDING = 2;

export function QrCode(handle: Handle<{ matrix: QrMatrix; label: string }>) {
  return () => {
    const { matrix, label } = handle.props;
    const box = matrix.size + PREVIEW_PADDING * 2;
    return (
      <svg
        role="img"
        aria-label={label}
        viewBox={`${-PREVIEW_PADDING} ${-PREVIEW_PADDING} ${box} ${box}`}
        shape-rendering="crispEdges"
        style={{ display: "block", width: "100%", height: "auto", borderRadius: "8px" }}
      >
        <rect x={-PREVIEW_PADDING} y={-PREVIEW_PADDING} width={box} height={box} fill="#fff" />
        <path d={qrPath(matrix)} fill="#0e0e12" />
      </svg>
    );
  };
}
