import type { Project } from '../data/types';

/**
 * Share cards, drawn on a <canvas> — no html2canvas, no server, no upload.
 *
 * Three ratios, one design language: paper background, hairline frame, the project's
 * real screenshot as the hero, serif Chinese title, and a footer that repeats the
 * "unknown stays unknown" rule. If no screenshot exists we draw a labelled
 * placeholder rather than a fake product image.
 */
export type Ratio = '1:1' | '3:4' | '16:9';

export const RATIOS: Array<{ id: Ratio; label: string; hint: string; w: number; h: number }> = [
  { id: '1:1', label: '1:1', hint: '朋友圈 / 小红书', w: 1080, h: 1080 },
  { id: '3:4', label: '3:4', hint: '竖版海报', w: 1080, h: 1440 },
  { id: '16:9', label: '16:9', hint: '公众号封面 / PPT', w: 1600, h: 900 },
];

const C = {
  paper: '#f4efe3',
  paper2: '#ece5d5',
  ink: '#191712',
  inkSoft: '#4b4538',
  mute: '#7b7362',
  rule: 'rgba(25,23,18,0.9)',
  hair: 'rgba(25,23,18,0.22)',
  vermilion: '#c8402a',
  white: '#fffdf8',
};

const SERIF = '"Noto Serif SC", "Songti SC", "SimSun", serif';
const MONO = '"JetBrains Mono", ui-monospace, Consolas, monospace';

export async function ensureFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const specs = [`600 64px "Noto Serif SC"`, `400 28px "Noto Serif SC"`, `400 40px "Instrument Serif"`, `400 22px "JetBrains Mono"`];
  await Promise.all(specs.map((s) => document.fonts.load(s).catch(() => undefined)));
  await document.fonts.ready;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const ch of text) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = ch;
      if (lines.length === maxLines) break;
    } else {
      line = test;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines) {
    const joined = lines.join('');
    if (joined.length < text.length) {
      let last = lines[maxLines - 1];
      while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
      lines[maxLines - 1] = `${last}…`;
    }
  }
  return lines;
}

function drawCoverFallback(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, name: string) {
  ctx.save();
  ctx.fillStyle = C.paper2;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(25,23,18,0.08)';
  ctx.lineWidth = 2;
  for (let i = -h; i < w; i += 26) {
    ctx.beginPath();
    ctx.moveTo(x + i, y + h);
    ctx.lineTo(x + i + h, y);
    ctx.stroke();
  }
  ctx.fillStyle = C.mute;
  ctx.textAlign = 'center';
  ctx.font = `400 22px ${MONO}`;
  ctx.fillText('NO SCREENSHOT', x + w / 2, y + h / 2 - 10);
  ctx.font = `600 34px ${SERIF}`;
  ctx.fillStyle = C.inkSoft;
  ctx.fillText(name, x + w / 2, y + h / 2 + 36);
  ctx.restore();
}

function drawFrame(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = C.hair;
  ctx.lineWidth = 2;
  ctx.strokeRect(28, 28, w - 56, h - 56);
}

export interface CardOptions {
  project: Project;
  ratio: Ratio;
  screenshotUrl: string | null;
  /** e.g. "E287 · 今日推荐" */
  kicker?: string;
  index?: number;
}

export async function drawShareCard(canvas: HTMLCanvasElement, opts: CardOptions): Promise<void> {
  const spec = RATIOS.find((r) => r.id === opts.ratio) ?? RATIOS[0];
  const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
  canvas.width = spec.w * dpr;
  canvas.height = spec.h * dpr;
  canvas.style.aspectRatio = `${spec.w} / ${spec.h}`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  await ensureFonts();
  const { project } = opts;
  const W = spec.w;
  const H = spec.h;
  const pad = 64;

  drawFrame(ctx, W, H);

  // header
  ctx.textAlign = 'left';
  ctx.fillStyle = C.vermilion;
  ctx.font = `400 22px ${MONO}`;
  ctx.fillText(opts.kicker || '今天又有什么新玩具', pad, pad + 18);

  ctx.textAlign = 'right';
  ctx.fillStyle = C.mute;
  ctx.fillText(`${opts.ratio} · ${new Date().getFullYear()}`, W - pad, pad + 18);

  ctx.strokeStyle = C.rule;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad, pad + 36);
  ctx.lineTo(W - pad, pad + 36);
  ctx.stroke();

  const img = opts.screenshotUrl ? await loadImage(opts.screenshotUrl) : null;

  if (opts.ratio === '16:9') {
    // image right, copy left
    const imgW = Math.round(W * 0.46);
    const imgH = Math.round(imgW * 0.66);
    const imgX = W - pad - imgW;
    const imgY = pad + 80;
    ctx.save();
    ctx.fillStyle = C.white;
    ctx.fillRect(imgX - 10, imgY - 10, imgW + 20, imgH + 20);
    if (img) {
      const scale = Math.max(imgW / img.width, imgH / img.height);
      const sw = imgW / scale;
      const sh = imgH / scale;
      ctx.beginPath();
      ctx.rect(imgX, imgY, imgW, imgH);
      ctx.clip();
      ctx.drawImage(img, (img.width - sw) / 2, 0, sw, sh, imgX, imgY, imgW, imgH);
    } else {
      drawCoverFallback(ctx, imgX, imgY, imgW, imgH, project.name);
    }
    ctx.strokeStyle = C.hair;
    ctx.strokeRect(imgX, imgY, imgW, imgH);
    ctx.restore();

    const colW = W - pad * 2 - imgW - 48;
    ctx.textAlign = 'left';
    ctx.fillStyle = C.mute;
    ctx.font = `400 20px ${MONO}`;
    ctx.fillText((project.categoryName ?? project.category).toUpperCase(), pad, pad + 86);
    ctx.fillStyle = C.ink;
    ctx.font = `600 62px ${SERIF}`;
    const titleLines = wrap(ctx, project.name, colW, 2);
    titleLines.forEach((line, i) => ctx.fillText(line, pad, pad + 158 + i * 72));

    ctx.fillStyle = C.vermilion;
    ctx.font = `400 30px ${SERIF}`;
    const tagLines = wrap(ctx, project.tagline, colW, 3);
    tagLines.forEach((line, i) => ctx.fillText(line, pad, pad + 158 + titleLines.length * 72 + 30 + i * 46));

    ctx.fillStyle = C.inkSoft;
    ctx.font = `400 20px ${MONO}`;
    ctx.fillText(`门槛 ${project.setup.effort} · 面向 ${project.audience}`, pad, H - pad - 54);
    ctx.fillText(`许可证 ${project.license.spdx ?? '未知'}`, pad, H - pad - 24);
  } else {
    // stacked: header, image, title, tagline, footer
    const imgH = Math.round(H * (opts.ratio === '3:4' ? 0.42 : 0.42));
    const imgW = W - pad * 2;
    const imgY = pad + 68;
    ctx.save();
    if (img) {
      const scale = Math.max(imgW / img.width, imgH / img.height);
      const sw = imgW / scale;
      const sh = imgH / scale;
      ctx.beginPath();
      ctx.rect(pad, imgY, imgW, imgH);
      ctx.clip();
      ctx.drawImage(img, (img.width - sw) / 2, 0, sw, sh, pad, imgY, imgW, imgH);
    } else {
      drawCoverFallback(ctx, pad, imgY, imgW, imgH, project.name);
    }
    ctx.restore();
    ctx.strokeStyle = C.hair;
    ctx.lineWidth = 2;
    ctx.strokeRect(pad, imgY, imgW, imgH);

    let y = imgY + imgH + (opts.ratio === '3:4' ? 92 : 78);
    ctx.textAlign = 'left';
    ctx.fillStyle = C.mute;
    ctx.font = `400 20px ${MONO}`;
    ctx.fillText(`${(project.categoryName ?? project.category).toUpperCase()} · ${project.setup.effort}`, pad, y);
    y += 62;
    ctx.fillStyle = C.ink;
    ctx.font = `600 ${opts.ratio === '3:4' ? 72 : 64}px ${SERIF}`;
    const titleLines = wrap(ctx, project.name, imgW, 2);
    titleLines.forEach((line) => {
      ctx.fillText(line, pad, y);
      y += opts.ratio === '3:4' ? 84 : 74;
    });

    y += 8;
    ctx.fillStyle = C.vermilion;
    ctx.font = `400 ${opts.ratio === '3:4' ? 34 : 30}px ${SERIF}`;
    const tagLines = wrap(ctx, project.tagline, imgW, opts.ratio === '3:4' ? 3 : 2);
    tagLines.forEach((line) => {
      ctx.fillText(line, pad, y);
      y += opts.ratio === '3:4' ? 52 : 46;
    });

    if (opts.ratio === '3:4') {
      y += 18;
      ctx.fillStyle = C.inkSoft;
      ctx.font = `400 24px ${SERIF}`;
      const sumLines = wrap(ctx, project.summary, imgW, 3);
      sumLines.forEach((line) => {
        ctx.fillText(line, pad, y);
        y += 40;
      });
    } else {
      // 1:1 has room for two lines of summary; without it the lower third looks empty.
      y += 14;
      ctx.fillStyle = C.inkSoft;
      ctx.font = `400 24px ${SERIF}`;
      const sumLines = wrap(ctx, project.summary, imgW, 2);
      sumLines.forEach((line) => {
        ctx.fillText(line, pad, y);
        y += 40;
      });
    }

    // footer
    ctx.strokeStyle = C.rule;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pad, H - pad - 52);
    ctx.lineTo(W - pad, H - pad - 52);
    ctx.stroke();
    ctx.fillStyle = C.ink;
    ctx.font = `600 26px ${SERIF}`;
    ctx.textAlign = 'left';
    ctx.fillText('今天又有什么新玩具', pad, H - pad - 14);
    ctx.textAlign = 'right';
    ctx.fillStyle = C.mute;
    ctx.font = `400 18px ${MONO}`;
    ctx.fillText(project.repo.stars === null ? '★ 未知' : `★ ${project.repo.stars.toLocaleString('en-US')}`, W - pad, H - pad - 14);
  }

  // Bottom-left source note on 16:9 (stacked layouts already have the wordmark)
  if (opts.ratio === '16:9') {
    ctx.textAlign = 'left';
    ctx.fillStyle = C.mute;
    ctx.font = `400 17px ${MONO}`;
    ctx.fillText('今天又有什么新玩具 · 数据来自公开仓库，未知项不虚构', pad, H - pad - 0);
  }
}

export function downloadCanvas(canvas: HTMLCanvasElement, filename: string): void {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }, 'image/png');
}
