import { ImageResponse } from "next/og";
import { IconArt } from "../../icon-art";

// Manifest icons: /icons/192 and /icons/512.
export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const n = Number((await params).size);
  const size = n === 512 ? 512 : 192;
  return new ImageResponse(<IconArt size={size} />, { width: size, height: size });
}
