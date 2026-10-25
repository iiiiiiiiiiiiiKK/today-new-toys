import { useEffect, useRef, useState } from 'react';
import type { Project } from '../data/types';
import { useToast } from '../context/ToastContext';
import { copyToClipboard, shareText } from '../lib/share';
import { downloadCanvas, drawShareCard, RATIOS, type Ratio } from '../lib/shareCard';
import { issueFor } from '../lib/issue';
import { assetUrl } from '../lib/asset';

export function ShareDialog({ project, onClose }: { project: Project; onClose: () => void }) {
  const [ratio, setRatio] = useState<Ratio>('1:1');
  const [rendering, setRendering] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const { show } = useToast();
  const issue = issueFor(project.slug);

  useEffect(() => {
    let alive = true;
    setRendering(true);
    setError(null);
    const run = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      try {
        await drawShareCard(canvas, {
          project,
          ratio,
          screenshotUrl: assetUrl(project.screenshots[0]?.src),
          kicker: `${issue.id} · ${issue.phrase}`,
        });
        if (alive) setRendering(false);
      } catch (err) {
        if (alive) {
          setError(err instanceof Error ? err.message : String(err));
          setRendering(false);
        }
      }
    };
    void run();
    return () => {
      alive = false;
    };
  }, [project, ratio, issue.id, issue.phrase]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const text = shareText(project);

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="share-title" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal__panel">
        <header className="modal__head">
          <div>
            <p className="eyebrow">Share · 分享这份玩具</p>
            <h2 className="modal__title" id="share-title">
              {project.name}
            </h2>
          </div>
          <button className="modal__close" onClick={onClose} aria-label="关闭分享窗口" type="button">
            ✕
          </button>
        </header>

        <div className="share">
          <div className="share__preview">
            <canvas ref={canvasRef} className="share__canvas" aria-label={`${project.name} 分享卡片预览`} />
            {rendering ? <p className="share__status mono">正在生成图片…</p> : null}
            {error ? <p className="share__status share__status--err mono">生成失败：{error}</p> : null}
          </div>

          <div className="share__side">
            <div className="share__ratios" role="group" aria-label="选择分享图比例">
              {RATIOS.map((r) => (
                <button key={r.id} type="button" className={`ratio ${ratio === r.id ? 'is-on' : ''}`} onClick={() => setRatio(r.id)} aria-pressed={ratio === r.id}>
                  <span className="ratio__box" data-ratio={r.id} aria-hidden="true" />
                  <span className="ratio__label mono">{r.label}</span>
                  <span className="ratio__hint">{r.hint}</span>
                </button>
              ))}
            </div>

            <div className="share__actions">
              <button
                className="btn btn--ink btn--sm"
                type="button"
                disabled={rendering || Boolean(error)}
                onClick={() => {
                  const canvas = canvasRef.current;
                  if (!canvas) return;
                  downloadCanvas(canvas, `newtoy-${project.slug}-${ratio.replace(':', 'x')}.png`);
                  show('分享图已开始下载');
                }}
              >
                下载 {ratio} 分享图
              </button>
              <button
                className="btn btn--sm"
                type="button"
                onClick={async () => {
                  // copy what the editor actually sees — the textarea is editable on purpose
                  const value = textRef.current?.value ?? text;
                  const ok = await copyToClipboard(value);
                  show(ok ? '中文分享文案已复制' : '复制失败，请手动选择文本', ok ? 'ok' : 'warn');
                }}
              >
                复制中文文案
              </button>
            </div>

            <label className="share__textlabel mono" htmlFor="share-text">
              分享文案（可编辑后再复制）
            </label>
            <textarea id="share-text" ref={textRef} className="share__text" defaultValue={text} rows={11} readOnly={false} />

            <p className="share__note">
              分享图由浏览器本地绘制，不上传任何图片。截图来自项目官方站点；没有截图的项目会画成带标注的占位图，不会伪造界面。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
