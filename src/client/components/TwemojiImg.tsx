import { useState } from "react";
import { emojiToTwemojiPngUrl } from "../../shared/animals";

interface TwemojiImgProps {
  emoji: string;
  /** CSS pixel box (image is scaled; use 72 asset for clarity). */
  displaySize: number;
  className?: string;
  /** Source asset resolution from Twemoji CDN */
  assetSize?: 36 | 72;
  title?: string;
}

/**
 * Renders a Unicode emoji as a Twemoji PNG (reliable where system fonts show tofu boxes).
 */
export function TwemojiImg({
  emoji,
  displaySize,
  className = "",
  assetSize = 72,
  title,
}: TwemojiImgProps) {
  const [broken, setBroken] = useState(false);
  const url = emojiToTwemojiPngUrl(emoji, assetSize);

  if (!emoji.trim() || !url || broken) return null;

  return (
    <img
      src={url}
      alt=""
      title={title}
      width={displaySize}
      height={displaySize}
      draggable={false}
      loading="lazy"
      decoding="async"
      className={className}
      style={{ objectFit: "contain", verticalAlign: "middle" }}
      onError={() => setBroken(true)}
    />
  );
}
