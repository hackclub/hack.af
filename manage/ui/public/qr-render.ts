// Turns a QR module matrix into SVG markup or pixels. Shared by the server-rendered
// preview and the export dialog, which renders in the browser.

export type QrMatrix = { size: number; bits: string };

export type QrRenderOptions = {
  // Quiet zone around the code, in modules. Scanners want at least 2; the spec says 4.
  padding: number;
  // A CSS color, or "transparent"
  background: string;
  foreground?: string;
};

export function isDark(matrix: QrMatrix, x: number, y: number) {
  return matrix.bits[y * matrix.size + x] === "1";
}

export function qrPath(matrix: QrMatrix, offset = 0) {
  let path = "";
  for (let y = 0; y < matrix.size; y++) {
    for (let x = 0; x < matrix.size; x++) {
      if (isDark(matrix, x, y)) path += `M${x + offset} ${y + offset}h1v1h-1z`;
    }
  }
  return path;
}

export function qrSvg(matrix: QrMatrix, options: QrRenderOptions & { pixels?: number }) {
  const box = matrix.size + options.padding * 2;
  const pixels = options.pixels ?? box * 16;
  const background =
    options.background === "transparent"
      ? ""
      : `<rect width="${box}" height="${box}" fill="${options.background}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${box} ${box}" width="${pixels}" height="${pixels}" shape-rendering="crispEdges">${background}<path d="${qrPath(matrix, options.padding)}" fill="${options.foreground ?? "#000"}"/></svg>`;
}

// Drawn module by module with rounded edges so every square lands on whole pixels:
// no blurry seams at sizes that don't divide evenly
export function qrCanvas(matrix: QrMatrix, options: QrRenderOptions & { pixels: number }) {
  const canvas = document.createElement("canvas");
  canvas.width = options.pixels;
  canvas.height = options.pixels;
  const ctx = canvas.getContext("2d")!;
  const scale = options.pixels / (matrix.size + options.padding * 2);

  if (options.background !== "transparent") {
    ctx.fillStyle = options.background;
    ctx.fillRect(0, 0, options.pixels, options.pixels);
  }
  ctx.fillStyle = options.foreground ?? "#000";
  for (let y = 0; y < matrix.size; y++) {
    for (let x = 0; x < matrix.size; x++) {
      if (!isDark(matrix, x, y)) continue;
      const left = Math.round((x + options.padding) * scale);
      const top = Math.round((y + options.padding) * scale);
      const right = Math.round((x + options.padding + 1) * scale);
      const bottom = Math.round((y + options.padding + 1) * scale);
      ctx.fillRect(left, top, right - left, bottom - top);
    }
  }
  return canvas;
}

// Relative luminance of a hex color, 0 (black) to 1 (white)
export function luminance(hex: string) {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!match) return 1;
  const value = Number.parseInt(match[1]!, 16);
  const channel = (shift: number) => {
    const c = ((value >> shift) & 255) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
}
