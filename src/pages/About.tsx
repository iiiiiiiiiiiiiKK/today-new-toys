import { Link } from 'react-router-dom';
import { DataGate } from '../components/DataGate';
import { useDataReady } from '../context/DataContext';
import { fmtDate } from '../lib/utils';

export function AboutPage() {
  return (
    <DataGate label="正在展开说明…">
      <AboutInner />
    </DataGate>
  );
}

function AboutInner() {
  const data = useDataReady();
  const total = data.projects.length;
  const withShot = data.projects.filter((p) => p.screenshots.length).length;
  const withLicense = data.projects.filter((p) => p.license.spdx).length;
  const withStars = data.projects.filter((p) => p.repo.stars !== null).length;

  return (
    <div className="about">
      <header className="pagehead">
        <p className="eyebrow">About · 关于这份清单</p>
        <h1 className="pagehead__title about__title">我们只写能核实的事。</h1>
        <p className="pagehead__lede">
          这是一个中文的开源项目与互联网工具发现站。它不是排行榜，也不是导航站收录表，而是一份有人读过 README、打开过官网、然后写下来的清单。
        </p>
      </header>

      <div className="about__grid">
        <section className="prose" id="how">
          <h2>怎么选的</h2>
          <p>
            选题没有算法。判断标准就三条：它是否解决了一个具体问题；现在是否还能跑起来；中文读者是否有必要知道它。
            热门不是入选理由，冷门也不是。每个项目的「编辑备注」写的都是我们自己会怎么用它。
          </p>
          <p>
            我们不接受付费收录，也不把 Star 数当成质量分。站内没有埋点，「本周热门」只看两件事：仓库 Star 规模与最近推送时间——算法写在
            <code>scripts/build-data.mjs</code> 里，可以复核。
          </p>
        </section>

        <section className="prose" id="data">
          <h2>数据从哪来</h2>
          <ul className="about__list">
            <li>
              <strong>仓库元信息</strong>：GitHub REST API 抓取的公开数据（Star、Fork、许可证、最近推送、Topics），每条记录都带抓取时间。
            </li>
            <li>
              <strong>中文介绍</strong>：编辑在读完 README 后手写，<code>contentBasis</code> 字段会写明依据的是 README 的哪部分、读了多少字。
            </li>
            <li>
              <strong>截图</strong>：用无头浏览器从项目官网或演示站实时抓取，页面底部标注抓取日期。抓不到就用带标注的占位图，不拿别的图冒充。
            </li>
            <li>
              <strong>未知项</strong>：许可证未声明、Star 取不到、演示链接不存在——一律显示「未知」，并在详情页说明原因。
            </li>
          </ul>
          <p className="about__statline mono">
            当前清单：{total} 个项目 / {withShot} 个有真实截图 / {withLicense} 个许可证已确认 / {withStars} 个有 Star 数据 · 快照 {data.snapshotDate}
          </p>
        </section>

        <section className="prose" id="license">
          <h2>许可证与署名</h2>
          <p>
            每个项目的代码、文档、名称与商标归其作者所有。本站只摘录公开 README 的内容并注明来源，不复制源码，也不代表作者背书。
            转载本站的中文介绍请保留项目名、原作者与原始仓库链接。
          </p>
          <p>
            若你是项目作者，希望修改或移除某条介绍，请按<Link to="/about#contribute">贡献流程</Link>提交，我们会在下一期处理。
          </p>
        </section>

        <section className="prose" id="contribute">
          <h2>怎么贡献</h2>
          <p>这个站点的内容全部是纯文本数据文件，改动一个 JSON 就能提 PR：</p>
          <ol className="about__steps">
            <li>
              推荐一个项目：在 <code>data/sources.json</code> 里加一行 <code>{'{ "slug", "repo", "category" }'}</code>，运行 <code>npm run data:fetch -- &lt;slug&gt;</code>。
            </li>
            <li>
              补全中文介绍：复制 <code>data/projects/_template.json</code>，按 README 填写 <code>features</code>、<code>audienceFor</code>、
              <code>setup</code>，并在 <code>contentBasis</code> 里写明依据。
            </li>
            <li>
              跑 <code>npm run data:check</code> 与 <code>npm run build</code>，两个都过了再提 PR。
            </li>
          </ol>
          <p>
            详细步骤、导入脚本、更新与部署说明都在{' '}
            <a href="https://github.com/iiiiiiiiiiiiiKK/today-new-toys#readme" target="_blank" rel="noopener noreferrer">
              仓库 README
            </a>{' '}
            的「内容维护」「数据更新」「部署」三节。也可以直接在{' '}
            <a href="https://github.com/iiiiiiiiiiiiiKK/today-new-toys/issues" target="_blank" rel="noopener noreferrer">
              GitHub Issues
            </a>{' '}
            里提建议，或到{' '}
            <a href="https://x.com/0xkillcoin" target="_blank" rel="noopener noreferrer">
              作者 𝕏
            </a>{' '}
            留言。
          </p>
        </section>

        <section className="prose" id="faq">
          <h2>常见问题</h2>
          <details>
            <summary>为什么有的项目没有 Star 数？</summary>
            <p>抓取时 API 额度用完或仓库被限流，我们不会用「约」「10k+」这类写法补上，直接写未知，并在下一次刷新时补。</p>
          </details>
          <details>
            <summary>为什么有的项目显示「许可证未知」？</summary>
            <p>GitHub 没有识别到标准许可证文件。部分项目使用自定义条款（例如 Open WebUI、MetaMask），我们会读 LICENSE 原文并在详情页写出限制。</p>
          </details>
          <details>
            <summary>收藏会同步吗？</summary>
            <p>不会。收藏只存在当前浏览器的 localStorage 里，可以导出 JSON / Markdown 自行迁移。</p>
          </details>
          <details>
            <summary>介绍是 AI 写的吗？</summary>
            <p>初稿可以由脚本从 README 生成，但发布前必须人工改写并标注依据；页面上「内容依据」一栏就是给读者核对用的。</p>
          </details>
        </section>

        <aside className="about__aside">
          <p className="eyebrow">本期信息</p>
          <dl>
            <div>
              <dt>数据快照</dt>
              <dd className="mono">{data.snapshotDate}</dd>
            </div>
            <div>
              <dt>生成时间</dt>
              <dd className="mono">{fmtDate(data.generatedAt)}</dd>
            </div>
            <div>
              <dt>项目数</dt>
              <dd className="mono">{total}</dd>
            </div>
            <div>
              <dt>分类数</dt>
              <dd className="mono">{data.categories.length}</dd>
            </div>
          </dl>
          <p className="about__aside-note">数据文件：<code>/data/projects.json</code>（构建产物，可直接下载核对）。</p>
        </aside>
      </div>
    </div>
  );
}
