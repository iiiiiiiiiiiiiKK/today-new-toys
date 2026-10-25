import { useState } from 'react';
import { cx } from '../lib/utils';
import { assetUrl } from '../lib/asset';

interface CoverProps {
  src?: string | null;
  alt: string;
  ratio?: '16x10' | '4x3' | '1x1' | 'wide';
  label?: string;
  labelTone?: 'normal' | 'muted' | 'fake';
  name: string;
  /** Shown under the fallback title, e.g. "未取得可用截图". */
  fallbackNote?: string;
  className?: string;
}

/**
 * A cover with a real fallback: if the file 404s (missing screenshot, CDN hiccup,
 * offline demo), we render an obvious placeholder instead of a broken-image icon or
 * — worse — someone else's screenshot. The placeholder says so in words.
 *
 * `src` comes from the data file as a root-absolute path; assetUrl() prefixes the
 * deploy base so the same data works at "/" and at "/toys/".
 */
export function Cover({ src, alt, ratio = '16x10', label, labelTone = 'normal', name, fallbackNote, className }: CoverProps) {
  const [failed, setFailed] = useState(false);
  const resolved = assetUrl(src);
  const show = Boolean(resolved) && !failed;

  return (
    <div className={cx('cover', `cover--${ratio}`, className)}>
      {label ? <span className={cx('cover__badge', labelTone === 'muted' && 'cover__badge--muted', labelTone === 'fake' && 'cover__badge--fake')}>{label}</span> : null}
      {show ? (
        <img src={resolved as string} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} />
      ) : (
        <div className="cover__fallback" role="img" aria-label={`${name}：暂无可用截图`}>
          <strong>{name}</strong>
          <span>{fallbackNote || 'NO SCREENSHOT · 未取得可用截图'}</span>
        </div>
      )}
    </div>
  );
}
