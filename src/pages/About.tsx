import { Link } from 'react-router-dom';
import { DataGate } from '../components/DataGate';
import { useDataReady } from '../context/DataContext';
import { currentIssue } from '../lib/issue';
import { fmtDate } from '../lib/utils';

const REPO = 'https://github.com/iiiiiiiiiiiiiKK/today-new-toys';
const AUTHOR_X = 'https://x.com/0xkillcoin';

export function AboutPage() {
  return (
    <DataGate label="正在展开说明…">
      <AboutInner />
    </DataGate>
  );
}

function Block({
  num,
  title,
  children,
  id,
}: {
  num: string;
  title: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section className="about-block" id={id}>
      <div className="about-block__head">
        <span className="about-block__num">{num}</span>
        <h2 className="about-block__title">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function AboutInner() {
  const data = useDataReady();
  const issue = currentIssue();
  const total = data.projects.length;
  const autoCount = data.projects.filter((p) => p.review.mode === 'auto').length;
  const withShot = data.projects.filter((p) => p.screenshots.length).length;
  const withLicense = data.projects.filter((p) => p.license.spdx).length;

  const principles = [
    {
      title: '解决真实问题',
      body: '它是否解决了一个具体问题，而不是「又一个平台」「又一个全家桶」？我们更在意它替掉了哪一步操作，而不是它列了多少功能。',
    },
    {
      title: '仍然可以使用',
      body: '官网、演示或安装方式是否还能打开、还能跑？这一条必须基于实际访问与截图，而不是仓库描述里的自我声明。打不开的项目不会被写成「即将上线」。',
    },
    {
      title: '值得中文读者知道',
      body: '它是否有明确的使用场景、价值或启发？如果只是英文社区的自娱自乐，或需要一整套我们无法验证的环境，我们会把它留在清单之外。',
    },
  ];

  const transparency = [
    {
      term: '仓库元信息',
      tag: 'GITHUB API',
      desc: 'Star、Fork、许可证、最近推送、Topics 均来自 GitHub REST API 的公开数据，每条记录都带抓取时间（fetchedAt）。Star 是累计值，不代表本周热度，也不是我们的评分。',
    },
    {
      term: '中文项目介绍',
      tag: 'EDITORIAL',
      desc: '编辑在读完 README 后手写概览、功能与上手方式。详情页的「内容依据」会写明依据的是 README 的哪一部分、读了多少字、什么时候抓的。',
    },
    {
      term: '自动收录机制',
      tag: 'AUTOMATED',
      desc: `每天由 GitHub Actions 搜索新项目、抓取 README 与官网截图，再用规则（或可选的模型）生成中文条目并发布。目前 ${autoCount} 条属于这一来源，卡片上带「自动收录」标记，详情页会说明未经人工校对。`,
    },
    {
      term: '项目官网截图',
      tag: 'CAPTURE',
      desc: '用无头浏览器访问官网或演示站实拍，页面标注抓取日期。抓不到时显示明确写有「未取得可用截图」的占位图，不会拿相似产品的图冒充。',
    },
    {
      term: '未知字段处理',
      tag: 'NULL',
      desc: '许可证未声明、Star 取不到、演示链接不存在——一律显示「未知」并说明原因，不填 0、不估算、不用「约」「10k+」之类的写法补齐。',
    },
    {
      term: '去重与更新',
      tag: 'INTEGRITY',
      desc: 'slug、仓库全名、项目名三重去重，导入时与构建时各查一次。已收录项目的元信息会被定期刷新，中文文案不会被自动改写。',
    },
  ];

  return (
    <div className="about">
      <header className="about-hero">
        <p className="about-hero__label">
          ABOUT <span aria-hidden="true">/</span> EDITORIAL POLICY
        </p>
        <h1 className="about-hero__title">我们只写能核实的事。</h1>
        <p className="about-hero__lede">
          这是一个中文的开源项目与互联网工具发现站。我们打开项目、阅读说明、核对公开信息，再决定是否把它放进清单。
        </p>
        <p className="about-hero__facts">
          <span>
            本期 <b className="mono">{issue.id}</b>
          </span>
          <span>
            收录 <b className="mono">{total}</b> 个项目
          </span>
          <span>
            其中自动收录 <b className="mono">{autoCount}</b> 个
          </span>
          <span>
            真实截图 <b className="mono">{withShot}</b> 个
          </span>
          <span>
            许可证已确认 <b className="mono">{withLicense}</b> 个
          </span>
          <span>
            数据快照 <b className="mono">{data.snapshotDate}</b>
          </span>
        </p>
      </header>

      <div className="about-body">
        <div className="about-main">
          <Block num="01" title="编辑原则" id="how">
            <p>
              选题没有算法。我们把每个候选项目按三条标准过一遍，三条都过才收录。热门不是入选理由，冷门也不是；我们不接受付费收录，也不把 Star 数当成质量分。
            </p>
            <div className="principles">
              {principles.map((p, i) => (
                <div className="principle" key={p.title}>
                  <span className="principle__num" aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3 className="principle__title">{p.title}</h3>
                    <p className="principle__body">{p.body}</p>
                  </div>
                </div>
              ))}
            </div>
            <p style={{ marginTop: '0.9rem' }}>
              「本周热门」同样不是流量榜：站内没有埋点，排序只看仓库 Star 规模与最近推送时间，算法写在 <code>scripts/build-data.mjs</code> 里，可以复核。
            </p>
          </Block>

          <Block num="02" title="数据透明度" id="data">
            <p>每一条清单都能追到来源。我们把「怎么来的」写在页面上，而不是放在脚注里。</p>
            <div className="transparency">
              {transparency.map((item) => (
                <div className="transparency__item" key={item.term}>
                  <p className="transparency__term">
                    {item.term}
                    <span className="mono">{item.tag}</span>
                  </p>
                  <p className="transparency__desc">{item.desc}</p>
                </div>
              ))}
            </div>
            <div className="principle-flag">
              <span className="principle-flag__label">原则</span>
              <p>取不到的数据就标记为未知，不猜测、不补造。</p>
            </div>
          </Block>

          <Block num="03" title="许可证与署名" id="license">
            <div className="credits">
              <div className="credits__item">
                <strong>项目版权</strong>
                每个项目的代码、文档、名称与商标归其作者所有。本站只摘录公开 README 的内容并注明来源，不复制源码，也不代表作者背书。
              </div>
              <div className="credits__item">
                <strong>我们的文字</strong>
                中文介绍的著作权归本站所有。转载时请保留项目名、原作者与原始仓库链接，并注明来自「今天又有什么新玩具」。
              </div>
              <div className="credits__item">
                <strong>许可证识别</strong>
                优先采用仓库声明的 SPDX 标识；GitHub 报「Other / NOASSERTION」时会读 LICENSE 原文（如 Open WebUI、MetaMask 的自定义条款），并在详情页写出限制。
              </div>
              <div className="credits__item">
                <strong>字体</strong>
                标题使用 Noto Serif SC 与 Instrument Serif，元数据使用 JetBrains Mono，均为 SIL OFL 1.1，自托管并按站内字符子集化。
              </div>
              <div className="credits__item">
                <strong>修改与移除</strong>
                若你是项目作者，希望修改或移除某条介绍，请到{' '}
                <a href={`${REPO}/issues`} target="_blank" rel="noopener noreferrer">
                  GitHub Issues
                </a>{' '}
                提交，或按下方贡献流程提 PR，我们会在下一期处理。
              </div>
              <div className="credits__item">
                <strong>反馈渠道</strong>
                项目页底部的「提交修订」可以直接生成一份带字段与来源的修订说明；也可以在{' '}
                <a href={AUTHOR_X} target="_blank" rel="noopener noreferrer">
                  作者 𝕏
                </a>{' '}
                留言。
              </div>
            </div>
          </Block>

          <Block num="04" title="贡献流程" id="contribute">
            <p>站点的内容全部是纯文本数据文件，改动一个 JSON 就能提 PR。</p>
            <div className="flow">
              <div className="flow__step">
                <span className="flow__num" aria-hidden="true">
                  01
                </span>
                <div>
                  <h3 className="flow__title">推荐项目</h3>
                  <p className="flow__body">
                    在 <code>data/sources.json</code> 里加一行 <code>{'{ "slug", "repo", "category" }'}</code>，然后运行{' '}
                    <code>npm run data:fetch -- &lt;slug&gt;</code> 抓取元信息与 README。
                  </p>
                </div>
              </div>
              <div className="flow__step">
                <span className="flow__num" aria-hidden="true">
                  02
                </span>
                <div>
                  <h3 className="flow__title">补全介绍</h3>
                  <p className="flow__body">
                    复制 <code>data/projects/_template.json</code>，按 README 填写 <code>features</code>、<code>audienceFor</code>、
                    <code>setup</code>，并在 <code>contentBasis</code> 里写明依据。
                  </p>
                </div>
              </div>
              <div className="flow__step">
                <span className="flow__num" aria-hidden="true">
                  03
                </span>
                <div>
                  <h3 className="flow__title">检查数据</h3>
                  <p className="flow__body">
                    运行 <code>npm run data:check</code> 校验字段、去重与许可证说明，再跑 <code>npm test</code> 确认数据约定没有被破坏。
                  </p>
                </div>
              </div>
              <div className="flow__step">
                <span className="flow__num" aria-hidden="true">
                  04
                </span>
                <div>
                  <h3 className="flow__title">提交修改</h3>
                  <p className="flow__body">
                    运行 <code>npm run build</code> 确认能构建，然后向{' '}
                    <a href={`${REPO}/pulls`} target="_blank" rel="noopener noreferrer">
                      仓库
                    </a>{' '}
                    提交 PR。完整步骤与部署说明在仓库 README 的「内容维护」「数据更新」「部署」三节。
                  </p>
                </div>
              </div>
            </div>
          </Block>

          <Block num="05" title="常见问题" id="faq">
            <div className="faq">
              <details className="faq__item">
                <summary>为什么有的项目没有 Star 数？</summary>
                <p className="faq__answer">
                  抓取时 API 额度用完或仓库被限流。我们不会用「约」「10k+」这类写法补上，直接写未知，并在下一次刷新时补。
                </p>
              </details>
              <details className="faq__item">
                <summary>为什么有的项目显示「许可证未知」？</summary>
                <p className="faq__answer">
                  GitHub 没有识别到标准许可证文件。部分项目使用自定义条款（例如 Open WebUI、MetaMask），我们会读 LICENSE 原文并在详情页写出限制，而不是简单标一个 MIT。
                </p>
              </details>
              <details className="faq__item">
                <summary>收藏会同步吗？</summary>
                <p className="faq__answer">
                  不会。收藏只存在当前浏览器的 localStorage 里，不上传任何服务器。换设备请在收藏页导出 JSON / Markdown 自行迁移。
                </p>
              </details>
              <details className="faq__item">
                <summary>中文介绍是 AI 写的吗？</summary>
                <p className="faq__answer">
                  分两种。编辑精选的条目由人读完 README 后手写；自动收录的条目由脚本按规则（或配置了模型时由模型）整理，带「自动收录」标记，详情页会说明未经人工校对。两种都会展示内容依据。
                </p>
              </details>
              <details className="faq__item">
                <summary>「本周热门」是真的热度吗？</summary>
                <p className="faq__answer">
                  不是访问量榜。站内没有统计代码，排名只看仓库 Star 规模与最近推送时间，属于「社区关注度」的代理指标，不包含我们自己的流量数据。
                </p>
              </details>
              <details className="faq__item">
                <summary>为什么有些项目看起来不像「玩具」？</summary>
                <p className="faq__answer">
                  清单的范围是「值得打开的工具」，从终端工具到自托管服务都算。名字里的「玩具」更接近「可以上手玩一玩的东西」，而不是指娱乐项目。
                </p>
              </details>
            </div>
          </Block>
        </div>

        <aside className="colophon" aria-label="本期信息">
          <p className="colophon__label">ISSUE {issue.id}</p>
          <dl>
            <div>
              <dt>数据快照</dt>
              <dd>{data.snapshotDate}</dd>
            </div>
            <div>
              <dt>生成时间</dt>
              <dd>{fmtDate(data.generatedAt)}</dd>
            </div>
            <div>
              <dt>项目数</dt>
              <dd>{total}</dd>
            </div>
            <div>
              <dt>分类数</dt>
              <dd>{data.categories.length}</dd>
            </div>
            <div>
              <dt>自动收录</dt>
              <dd>{autoCount}</dd>
            </div>
          </dl>
          <p className="colophon__note">
            数据文件：<code>/data/projects.json</code>，构建产物，可直接下载核对。
            <br />
            源码：{' '}
            <a href={REPO} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
            {' · '}
            <a href={`${REPO}#readme`} target="_blank" rel="noopener noreferrer">
              README
            </a>
            <br />
            作者：{' '}
            <a href={AUTHOR_X} target="_blank" rel="noopener noreferrer">
              𝕏 @0xkillcoin
            </a>
            <br />
            <Link to="/discover">浏览全部项目 →</Link>
          </p>
        </aside>
      </div>
    </div>
  );
}
