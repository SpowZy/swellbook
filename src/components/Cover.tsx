import Image from "next/image";
import { CoverArt } from "./CoverArt";

/**
 * A listing's cover: the real photo when it has one, generated cover art
 * when it does not (listings created through the wizard, until photo
 * upload ships). The parent element must be position:relative.
 */
export function Cover({
  coverUrl,
  hue,
  alt,
  sizes,
  priority = false,
  className = "",
}: {
  coverUrl: string | null;
  hue: number;
  alt: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  if (coverUrl) {
    return (
      <Image
        src={coverUrl}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes ?? "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"}
        className={`object-cover ${className}`}
      />
    );
  }
  return <CoverArt hue={hue} className={className} />;
}
