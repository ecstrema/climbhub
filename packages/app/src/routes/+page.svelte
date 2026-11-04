<script lang="ts">
  import { resolve } from "$app/paths";
  import ArrowUpRightIcon from "@lucide/svelte/icons/arrow-up-right";
  import MountainIcon from "@lucide/svelte/icons/mountain";

  const regions = [
    { name: "Europe", note: "Limestone, granite, and long days", slug: "europe" },
    { name: "Americas", note: "From desert towers to big walls", slug: "americas" },
    { name: "Asia", note: "A whole world of new lines", slug: "asia" },
  ];
</script>

<svelte:head>
  <title>Climbhub: Find your next line</title>
  <meta
    name="description"
    content="Explore climbing areas and routes around the world with Climbhub, a living map built from OpenStreetMap."
  />
  <meta name="theme-color" content="#18251f" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link
    href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<div class="landing">
  <header class="site-header">
    <a class="wordmark" href={resolve("/")} aria-label="Climbhub home">
      <span class="brand-mark"><MountainIcon size={19} strokeWidth={2.2} /></span>
      <span>climbhub</span>
    </a>
    <nav aria-label="Main navigation">
      <a class="nav-link" href={resolve("/grade-comparison/route")}>Grade comparison</a>
      <a class="nav-cta" href={resolve("/world/[...slug]", { slug: "" })}>
        Explore the map <ArrowUpRightIcon size={16} />
      </a>
    </nav>
  </header>

  <main>
    <section class="hero" aria-labelledby="hero-title">
      <img
        class="hero-image"
        src="https://images.unsplash.com/photo-1522163182402-834f871fd851?auto=format&fit=crop&w=2400&q=85"
        alt="A climber making their way up a sunlit rock face"
        fetchpriority="high"
      />
      <div class="hero-shade"></div>
      <div class="hero-copy">
        <p class="eyebrow"><span></span> The climbing world, wide open</p>
        <h1 id="hero-title">Find your<br />next <em>line.</em></h1>
        <p class="hero-description">A living map of climbing areas and routes, made for wherever the rock takes you.</p>
        <a class="hero-button" href={resolve("/world/[...slug]", { slug: "" })}>
          Explore climbing areas <ArrowUpRightIcon size={18} />
        </a>
      </div>
      <div class="hero-caption">
        <span class="caption-rule"></span>
        <span>Outside is closer than you think.</span>
      </div>
      <div class="hero-index" aria-hidden="true">01 <span>/</span> WORLD</div>
    </section>

    <section class="regions" aria-labelledby="regions-title">
      <div class="section-heading">
        <p class="eyebrow dark-eyebrow">Pick a direction</p>
        <h2 id="regions-title">The next hold<br />could be <em>anywhere.</em></h2>
      </div>
      <div class="region-list">
        {#each regions as region, index (region.slug)}
          <a class="region-row" href={resolve("/world/[...slug]", { slug: region.slug })}>
            <span class="region-number">0{index + 1}</span>
            <span class="region-name">{region.name}</span>
            <span class="region-note">{region.note}</span>
            <span class="region-arrow"><ArrowUpRightIcon size={19} /></span>
          </a>
        {/each}
      </div>
    </section>

    <section class="grade-band" aria-labelledby="grade-title">
      <div>
        <p class="eyebrow">Every scale has a story</p>
        <h2 id="grade-title">Speak the<br /><em>same grade.</em></h2>
      </div>
      <div class="grade-aside">
        <p>Compare climbing grades across the systems you know, and the ones you’re about to discover.</p>
        <a href={resolve("/grade-comparison/route")}>
          Compare grades <ArrowUpRightIcon size={17} />
        </a>
      </div>
      <div class="grade-stamp" aria-hidden="true">5a <span>&middot;</span> 5.9 <span>&middot;</span> V2</div>
    </section>
  </main>

  <footer class="site-footer">
    <a class="wordmark footer-brand" href={resolve("/")}>
      <span class="brand-mark"><MountainIcon size={17} strokeWidth={2.2} /></span>
      <span>climbhub</span>
    </a>
    <p>Find good rock. Leave it better.</p>
    <a class="osm-credit" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
      Map data &copy; OpenStreetMap contributors <ArrowUpRightIcon size={13} />
    </a>
  </footer>
</div>

<style>
  .landing {
    --ink: #1d2923;
    --paper: #f2f0e9;
    --moss: #c5d85b;
    min-height: 100vh;
    color: var(--ink);
    background: var(--paper);
    font-family: "DM Sans", sans-serif;
  }

  .site-header {
    position: absolute;
    z-index: 2;
    top: 0;
    left: 0;
    display: flex;
    width: 100%;
    min-height: 82px;
    align-items: center;
    justify-content: space-between;
    padding: 0 clamp(22px, 5.5vw, 88px);
    box-sizing: border-box;
    color: #fff;
    border-bottom: 1px solid rgb(255 255 255 / 24%);
  }

  .wordmark {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    color: inherit;
    font-size: 19px;
    font-weight: 700;
    letter-spacing: 0;
    text-decoration: none;
  }

  .brand-mark {
    display: grid;
    width: 31px;
    aspect-ratio: 1;
    place-items: center;
    color: var(--moss);
    border: 1px solid rgb(197 216 91 / 55%);
    border-radius: 50%;
  }

  nav {
    display: flex;
    align-items: center;
    gap: clamp(20px, 3vw, 46px);
  }

  .nav-link,
  .nav-cta {
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
  }

  .nav-link {
    transition: color 180ms ease;
  }

  .nav-link:hover {
    color: var(--moss);
  }

  .nav-cta,
  .hero-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 19px;
  }

  .nav-cta {
    padding: 12px 15px;
    border: 1px solid rgb(255 255 255 / 55%);
    transition:
      color 180ms ease,
      background 180ms ease,
      border-color 180ms ease;
  }

  .nav-cta:hover {
    color: var(--ink);
    background: var(--moss);
    border-color: var(--moss);
  }

  .hero {
    position: relative;
    display: flex;
    min-height: min(790px, 92svh);
    align-items: center;
    padding: 120px clamp(24px, 11vw, 175px) 118px;
    overflow: hidden;
    box-sizing: border-box;
    color: #fff;
    background: #28352f;
  }

  .hero-image,
  .hero-shade {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .hero-image {
    object-fit: cover;
    object-position: center 43%;
    animation: image-arrive 1.2s ease-out both;
  }

  .hero-shade {
    background:
      linear-gradient(90deg, rgb(13 23 19 / 77%) 0%, rgb(13 23 19 / 53%) 38%, rgb(13 23 19 / 9%) 78%),
      linear-gradient(0deg, rgb(13 23 19 / 45%) 0%, transparent 36%);
  }

  .hero-copy {
    position: relative;
    z-index: 1;
    max-width: 700px;
    animation: copy-arrive 700ms 100ms both;
  }

  .eyebrow {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0 0 23px;
    color: var(--moss);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0;
    text-transform: uppercase;
  }

  .eyebrow span {
    width: 7px;
    aspect-ratio: 1;
    background: var(--moss);
    border-radius: 50%;
  }

  h1,
  h2 {
    margin: 0;
    font-family: "Barlow Condensed", sans-serif;
    font-weight: 600;
    letter-spacing: 0;
    text-transform: uppercase;
  }

  h1 {
    font-size: clamp(76px, 10.1vw, 146px);
    line-height: 0.81;
  }

  h1 em,
  h2 em {
    color: var(--moss);
    font-style: normal;
  }

  .hero-description {
    max-width: 390px;
    margin: 28px 0 29px;
    color: rgb(255 255 255 / 87%);
    font-size: 15px;
    line-height: 1.7;
  }

  .hero-button {
    min-height: 53px;
    padding: 0 19px;
    color: var(--ink);
    background: var(--moss);
    font-size: 13px;
    font-weight: 700;
    text-decoration: none;
    transition:
      background 180ms ease,
      transform 180ms ease;
  }

  .hero-button:hover {
    background: #d7e78a;
    transform: translateY(-2px);
  }

  .hero-caption,
  .hero-index {
    position: absolute;
    z-index: 1;
    bottom: 35px;
    color: rgb(255 255 255 / 80%);
    font-size: 11px;
  }

  .hero-caption {
    left: clamp(24px, 5.5vw, 88px);
    display: flex;
    align-items: center;
    gap: 11px;
  }

  .caption-rule {
    width: 31px;
    height: 1px;
    background: var(--moss);
  }

  .hero-index {
    right: clamp(24px, 5.5vw, 88px);
    font-weight: 700;
  }

  .hero-index span {
    padding: 0 5px;
    color: var(--moss);
  }

  .regions {
    display: grid;
    grid-template-columns: minmax(250px, 0.8fr) minmax(0, 1.2fr);
    gap: clamp(50px, 10vw, 160px);
    padding: clamp(75px, 10vw, 140px) clamp(24px, 11vw, 175px);
    background: var(--paper);
  }

  .dark-eyebrow {
    color: #697867;
  }

  .section-heading h2,
  .grade-band h2 {
    font-size: clamp(53px, 6vw, 82px);
    line-height: 0.88;
  }

  .section-heading h2 em {
    color: #75864b;
  }

  .region-list {
    align-self: center;
  }

  .region-row {
    display: grid;
    grid-template-columns: 35px minmax(110px, 0.8fr) minmax(140px, 1.2fr) 22px;
    min-height: 75px;
    align-items: center;
    gap: 13px;
    color: var(--ink);
    border-bottom: 1px solid #d5d4cb;
    text-decoration: none;
    transition:
      padding 180ms ease,
      color 180ms ease;
  }

  .region-row:first-child {
    border-top: 1px solid #d5d4cb;
  }

  .region-row:hover {
    padding-inline: 8px;
    color: #687744;
  }

  .region-number {
    color: #889084;
    font-size: 11px;
  }

  .region-name {
    font-family: "Barlow Condensed", sans-serif;
    font-size: 29px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .region-note {
    color: #747970;
    font-size: 11px;
    line-height: 1.5;
  }

  .region-arrow {
    justify-self: end;
    transition: transform 180ms ease;
  }

  .region-row:hover .region-arrow {
    transform: translate(2px, -2px);
  }

  .grade-band {
    position: relative;
    display: grid;
    grid-template-columns: 1fr minmax(230px, 0.65fr);
    align-items: center;
    gap: 50px;
    min-height: 330px;
    padding: 75px clamp(24px, 11vw, 175px) 105px;
    overflow: hidden;
    box-sizing: border-box;
    color: #f2f0e9;
    background: #26372e;
  }

  .grade-band h2 em {
    color: var(--moss);
  }

  .grade-aside {
    position: relative;
    z-index: 1;
    max-width: 330px;
  }

  .grade-aside p {
    margin: 0 0 23px;
    color: rgb(242 240 233 / 75%);
    font-size: 14px;
    line-height: 1.75;
  }

  .grade-aside a {
    display: inline-flex;
    align-items: center;
    gap: 13px;
    padding-bottom: 7px;
    color: var(--moss);
    border-bottom: 1px solid rgb(197 216 91 / 60%);
    font-size: 13px;
    font-weight: 700;
    text-decoration: none;
  }

  .grade-stamp {
    position: absolute;
    right: 4vw;
    bottom: -45px;
    color: rgb(255 255 255 / 4%);
    font-family: "Barlow Condensed", sans-serif;
    font-size: clamp(100px, 18vw, 240px);
    font-weight: 700;
    line-height: 1;
    white-space: nowrap;
  }

  .grade-stamp span {
    color: rgb(197 216 91 / 22%);
  }

  .site-footer {
    display: flex;
    min-height: 80px;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 18px clamp(24px, 5.5vw, 88px);
    box-sizing: border-box;
    background: var(--paper);
  }

  .footer-brand {
    font-size: 16px;
  }

  .footer-brand .brand-mark {
    width: 27px;
    color: #687744;
    border-color: #aeb799;
  }

  .site-footer p,
  .osm-credit {
    margin: 0;
    color: #747970;
    font-size: 11px;
  }

  .osm-credit {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    text-decoration: none;
  }

  .osm-credit:hover {
    color: var(--ink);
  }

  @keyframes image-arrive {
    from {
      transform: scale(1.035);
    }
    to {
      transform: scale(1);
    }
  }

  @keyframes copy-arrive {
    from {
      opacity: 0;
      transform: translateY(14px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (max-width: 760px) {
    .site-header {
      min-height: 70px;
      padding-inline: 21px;
    }

    .wordmark {
      font-size: 17px;
    }

    .brand-mark {
      width: 28px;
    }

    nav {
      gap: 12px;
    }

    .nav-link {
      display: none;
    }

    .nav-cta {
      gap: 9px;
      padding: 10px 11px;
      font-size: 11px;
    }

    .hero {
      min-height: 760px;
      min-height: max(690px, 92svh);
      align-items: center;
      padding: 110px 25px 110px;
    }

    .hero-image {
      object-position: 32% center;
    }

    .hero-shade {
      background:
        linear-gradient(90deg, rgb(13 23 19 / 70%), rgb(13 23 19 / 20%) 100%),
        linear-gradient(0deg, rgb(13 23 19 / 55%), transparent 58%);
    }

    .hero-copy {
      margin-top: 12px;
    }

    .eyebrow {
      font-size: 10px;
    }

    h1 {
      font-size: clamp(76px, 19vw, 120px);
    }

    .hero-description {
      max-width: 320px;
      font-size: 14px;
    }

    .hero-caption,
    .hero-index {
      bottom: 24px;
    }

    .hero-caption {
      left: 25px;
      font-size: 10px;
    }

    .hero-index {
      right: 25px;
      font-size: 10px;
    }

    .regions {
      grid-template-columns: 1fr;
      gap: 38px;
      padding: 76px 25px 84px;
    }

    .section-heading h2,
    .grade-band h2 {
      font-size: clamp(54px, 14vw, 76px);
    }

    .region-row {
      grid-template-columns: 25px minmax(95px, 0.8fr) minmax(85px, 1fr) 18px;
      min-height: 72px;
      gap: 8px;
    }

    .region-name {
      font-size: 25px;
    }

    .region-note {
      font-size: 10px;
    }

    .grade-band {
      grid-template-columns: 1fr;
      gap: 30px;
      min-height: 430px;
      padding: 72px 25px 110px;
    }

    .grade-aside p {
      max-width: 330px;
    }

    .grade-stamp {
      right: -14px;
      bottom: -20px;
      font-size: 112px;
    }

    .site-footer {
      flex-wrap: wrap;
      justify-content: space-between;
      padding: 21px 25px;
    }

    .site-footer p {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      scroll-behavior: auto !important;
      transition-duration: 0.01ms !important;
    }
  }
</style>
