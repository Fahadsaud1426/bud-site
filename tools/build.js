/* Builds the deployable site from src/.
 *
 *   node tools/build.js
 *
 * The source is one document holding five <section class="view"> blocks that
 * used to be swapped client-side behind a #hash. Search engines never saw past
 * the first one: a fragment is not a URL, so the whole site was a single
 * indexable page carrying five <h1>s. This script cuts that document into one
 * real page per view, each at its own path with its own title, description,
 * canonical and structured data.
 *
 * It emits shells only. The Arabic copy lives in data-ar attributes and the
 * catalog is rendered by script, so a shell is still mostly English markup and
 * empty containers — tools/prerender.js runs them through headless Chrome
 * afterwards to bake in the Arabic and the generated DOM.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src', 'index.html');
const ORIGIN = 'https://bud-co.com';

/* ── page table ──────────────────────────────────────────────────────────
   Titles lead with the search term rather than the brand: nobody in Saudi
   searches "بُعد", they search for the service. Descriptions stay near 155
   characters so Google shows them whole, and use Western digits because that
   is how people actually type queries. */
const PAGES = [
  {
    view: 'home', dir: '',
    title: 'تطوير تطبيقات وأنظمة برمجية في السعودية | بُعد',
    desc: 'بُعد: نطوّر تطبيقات الجوال والويب والأنظمة البرمجية، وننتج أفلامًا تسويقية بالذكاء الاصطناعي. أكثر من 100 ميزة جاهزة، وسقف سعر واضح لا يتجاوز 40 ألف ريال.',
    ogTitle: 'بُعد — نبني البُعد الناقص في أعمالك',
    crumb: null,
  },
  {
    view: 'apps', dir: 'apps',
    title: 'تطوير تطبيقات الجوال والويب | بُعد',
    desc: 'نطوّر تطبيقات iOS وأندرويد وتطبيقات ويب بقواعد بيانات حقيقية وصلاحيات مستخدمين ولوحات تحكم — من أول رسم حتى النشر في المتجر. من تبوك إلى كل السعودية.',
    ogTitle: 'تطوير تطبيقات الجوال والويب — بُعد',
    crumb: 'تطوير التطبيقات',
    service: {
      name: 'تطوير تطبيقات الجوال والويب',
      desc: 'تصميم وتطوير تطبيقات iOS وأندرويد وتطبيقات ويب وأنظمة برمجية بقواعد بيانات وصلاحيات ولوحات تحكم.',
    },
  },
  {
    view: 'film', dir: 'film',
    title: 'أفلام تسويقية بالذكاء الاصطناعي | بُعد',
    desc: 'إنتاج أفلام ومقاطع تسويقية بالذكاء الاصطناعي: سيناريو وصوت ومونتاج جاهز للنشر على منصات التواصل، بتكلفة ومدة أقل بكثير من الإنتاج التقليدي.',
    ogTitle: 'أفلام تسويقية بالذكاء الاصطناعي — بُعد',
    crumb: 'الأفلام التسويقية',
    service: {
      name: 'إنتاج أفلام تسويقية بالذكاء الاصطناعي',
      desc: 'كتابة سيناريو وإنتاج مقاطع تسويقية بالذكاء الاصطناعي مع صوت ومونتاج جاهز للنشر.',
    },
  },
  {
    view: 'catalog', dir: 'catalog',
    title: 'أكثر من 100 ميزة جاهزة لتطبيقك | بُعد',
    desc: 'تصفّح كتالوج إمكانات بُعد: المدفوعات والطلبات والحجوزات والمخزون والتقارير والذكاء الاصطناعي والتكاملات والامتثال — اختر ما يناسب نشاطك وحدّد نطاق مشروعك.',
    ogTitle: 'كتالوج الإمكانات — أكثر من 100 ميزة',
    crumb: 'الإمكانات',
  },
  {
    view: 'brief', dir: 'brief',
    title: 'اطلب عرض سعر تطوير تطبيق | بُعد',
    desc: 'عبّئ طلبك في دقائق: حدّد المزايا والصلاحيات والفروع والمنصات واحصل على تقدير فوري للسعر والمدة. الرد خلال يوم عمل واحد، والسعر لا يتجاوز 40 ألف ريال.',
    ogTitle: 'ابدأ طلبك — تقدير فوري للسعر والمدة',
    crumb: 'ابدأ طلبك',
    contactPage: true,
  },
];

/* ── structured data ─────────────────────────────────────────────────── */
const BUSINESS = {
  '@type': 'ProfessionalService',
  '@id': ORIGIN + '/#business',
  name: "Bu'd بُعد",
  description: 'شركة تطوير تطبيقات وأنظمة برمجية وإنتاج أفلام تسويقية بالذكاء الاصطناعي في تبوك، تخدم كل مناطق السعودية.',
  url: ORIGIN + '/',
  image: ORIGIN + '/og.png',
  telephone: '+966580181743',
  email: 'fahad@bud-co.com',
  priceRange: 'SAR 6,000 – SAR 40,000',
  address: { '@type': 'PostalAddress', addressLocality: 'تبوك', addressRegion: 'تبوك', addressCountry: 'SA' },
  // A named region beats the bare "SA" string: it is what lets the listing
  // surface for "near me" and city-qualified searches across the Kingdom.
  areaServed: [
    { '@type': 'Country', name: 'المملكة العربية السعودية' },
    { '@type': 'City', name: 'تبوك' }, { '@type': 'City', name: 'الرياض' },
    { '@type': 'City', name: 'جدة' }, { '@type': 'City', name: 'الدمام' },
    { '@type': 'City', name: 'نيوم' },
  ],
  openingHoursSpecification: {
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
    opens: '09:00', closes: '18:00',
  },
  knowsLanguage: ['ar', 'en'],
  makesOffer: [
    'تطوير تطبيقات الجوال', 'تطوير تطبيقات الويب', 'تطوير الأنظمة البرمجية',
    'تصميم وتطوير المواقع', 'إنتاج أفلام تسويقية بالذكاء الاصطناعي',
  ].map((n) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: n } })),
};

function graphFor(page) {
  const url = ORIGIN + (page.dir ? '/' + page.dir + '/' : '/');
  const nodes = [];

  if (page.view === 'home') nodes.push(BUSINESS);

  nodes.push({
    '@type': page.contactPage ? 'ContactPage' : 'WebPage',
    '@id': url + '#page',
    url, name: page.title, description: page.desc,
    inLanguage: 'ar-SA',
    isPartOf: { '@type': 'WebSite', '@id': ORIGIN + '/#site', url: ORIGIN + '/', name: "Bu'd بُعد", inLanguage: 'ar-SA' },
    about: { '@id': ORIGIN + '/#business' },
  });

  if (page.crumb) {
    nodes.push({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'الرئيسية', item: ORIGIN + '/' },
        { '@type': 'ListItem', position: 2, name: page.crumb, item: url },
      ],
    });
  }

  if (page.service) {
    nodes.push({
      '@type': 'Service',
      name: page.service.name, description: page.service.desc,
      serviceType: page.service.name,
      provider: { '@id': ORIGIN + '/#business' },
      areaServed: { '@type': 'Country', name: 'المملكة العربية السعودية' },
      url,
    });
  }

  return JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes }, null, 2);
}

/* ── head ────────────────────────────────────────────────────────────── */
const MARK = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%23080F12'/%3E%3Cg fill='none' stroke='%23E0B15F' stroke-width='1.6' stroke-linejoin='round'%3E%3Cpath d='M6 12l10-5 10 5-10 5z'/%3E%3Cpath d='M6 17l10 5 10-5'/%3E%3Cpath d='M6 12v5'/%3E%3Cpath d='M26 12v5'/%3E%3C/g%3E%3C/svg%3E";

function head(page) {
  const url = ORIGIN + (page.dir ? '/' + page.dir + '/' : '/');
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..125,400..900&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Tajawal:wght@500;700;800&display=swap">

<title>${page.title}</title>
<meta name="description" content="${page.desc}">
<meta name="author" content="Bu'd بُعد">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
<meta name="theme-color" content="#E9E6DD" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#080F12" media="(prefers-color-scheme: dark)">

<!-- Self-referencing canonical. Each view is its own URL now, so each one
     claims itself; pointing them all at the origin would collapse the site
     back into a single indexable page. -->
<link rel="canonical" href="${url}">

<meta property="og:type" content="website">
<meta property="og:site_name" content="Bu'd بُعد">
<meta property="og:locale" content="ar_SA">
<meta property="og:locale:alternate" content="en_US">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${page.ogTitle}">
<meta property="og:description" content="${page.desc}">
<meta property="og:image" content="${ORIGIN}/og.png">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="بُعد — نبني البُعد الناقص في أعمالك. تطبيقات ويب وجوال وأفلام تسويقية بالذكاء الاصطناعي.">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${page.ogTitle}">
<meta name="twitter:description" content="${page.desc}">
<meta name="twitter:image" content="${ORIGIN}/og.png">

<!-- Brass dimension mark, inline so there is no extra request and no 404 -->
<link rel="icon" href="${MARK}">
<link rel="apple-touch-icon" href="${MARK}">

<!-- Both languages are served from this one URL by a client-side toggle. -->
<link rel="alternate" hreflang="ar" href="${url}">
<link rel="alternate" hreflang="en" href="${url}">
<link rel="alternate" hreflang="x-default" href="${url}">

<script type="application/ld+json">
${graphFor(page)}
</script>

<style>
  :root { color-scheme: light dark; }
  html, body { margin: 0; }
  body { font: 14px system-ui, sans-serif; background: #E9E6DD; }
  img { max-width: 100%; }
  [hidden] { display: none !important; }
</style>
</head>
<body>
`;
}

/* ── split the source ────────────────────────────────────────────────── */
const src = fs.readFileSync(SRC, 'utf8');

const firstView = src.indexOf('<section class="view is-active" id="view-home">');
if (firstView < 0) throw new Error('could not find the first view section');
const footer = src.indexOf('<footer class="foot">');
if (footer < 0) throw new Error('could not find the footer');

const chromeTop = src.slice(0, firstView);   // skip-link, header, nav, rail
const chromeEnd = src.slice(footer);         // footer, FAB, toast, scripts

const views = {};
{
  const re = /<section class="view(?: is-active)?" id="view-([a-z]+)">/g;
  const marks = [];
  let m;
  while ((m = re.exec(src)) && m.index < footer) marks.push({ view: m[1], at: m.index });
  marks.forEach((mk, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].at : footer;
    views[mk.view] = src.slice(mk.at, end).trimEnd();
  });
}

/* ── write pages ─────────────────────────────────────────────────────── */
let written = 0;
for (const page of PAGES) {
  let view = views[page.view];
  if (!view) throw new Error('missing view: ' + page.view);

  // every emitted page shows its own view, so it is always the active one
  view = view.replace(/^<section class="view(?: is-active)?"/, '<section class="view is-active"');

  const url = page.dir ? '/' + page.dir + '/' : '/';
  // mark the current item for assistive tech and for the nav's active style
  const nav = chromeTop.replace(
    new RegExp('(<a href="' + url.replace(/\//g, '\\/') + '" class="nav__link")'),
    '$1 aria-current="page"'
  );

  const html = head(page) + nav + view + '\n\n' + chromeEnd;
  const outDir = path.join(ROOT, page.dir);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), html);
  console.log(`  ${(url + 'index.html').padEnd(22)} ${String(html.length).padStart(7)} bytes   ${page.title}`);
  written++;
}

/* ── robots.txt + sitemap.xml ────────────────────────────────────────── */
fs.writeFileSync(path.join(ROOT, 'robots.txt'),
  `User-agent: *
Allow: /

Sitemap: ${ORIGIN}/sitemap.xml
`);

const today = new Date().toISOString().slice(0, 10);
const urls = PAGES.map((p) => {
  const loc = ORIGIN + (p.dir ? '/' + p.dir + '/' : '/');
  const priority = p.dir === '' ? '1.0' : p.view === 'brief' ? '0.9' : '0.8';
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${priority}</priority>
  </url>`;
}).join('\n');

fs.writeFileSync(path.join(ROOT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`);

console.log(`\n  robots.txt + sitemap.xml (${PAGES.length} urls)`);
console.log(`\nbuilt ${written} pages`);
