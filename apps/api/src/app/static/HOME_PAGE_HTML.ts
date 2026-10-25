const HOME_PAGE_HTML = `<!doctype html>
      <html lang="ru">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <meta name="color-scheme" content="dark">
          <title>Bisky API</title>
          <style>
            :root {
              --color-dark-deepest: #170e19;
              --color-dark-deep: #231726;
              --color-dark-light: #322136;
              --color-light-lightest: #f8f8f8;
              --color-light-deepest: #a4a4a4;
              --color-accent-deep: #801a59;
              --color-accent-light: #be3d73;
              --color-accent-lightest: #dd5480;
              --color-system-success: #4f9a61;
              --color-system-error: #e84a5f;
            }
            * { box-sizing: border-box; }
            body {
              margin: 0;
              min-height: 100vh;
              min-height: 100svh;
              display: grid;
              place-items: center;
              padding: 32px 20px;
              background: var(--color-dark-deepest);
              color: var(--color-light-lightest);
              font-family: Roboto, Arial, sans-serif;
            }
            main { width: min(100%, 960px); }
            .header {
              display: flex;
              flex-wrap: wrap;
              align-items: center;
              gap: 16px;
              margin-bottom: 20px;
              padding: 16px 20px;
              border-radius: 20px;
              background: var(--color-dark-deep);
            }
            h1 { margin: 0; font-size: 28px; line-height: 36px; font-weight: 700; }
            .brand { color: var(--color-accent-lightest); }
            .api-label { color: var(--color-light-deepest); font-size: 20px; }
            .links { display: flex; flex: 1 1 240px; flex-wrap: wrap; justify-content: flex-end; gap: 8px; min-width: 0; }
            .link {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              min-height: 40px;
              padding: 8px 16px;
              border-radius: 12px;
              background: var(--color-accent-deep);
              color: var(--color-light-lightest);
              font-size: 16px;
              line-height: 24px;
              font-weight: 700;
              text-decoration: none;
            }
            .link:hover { background: var(--color-accent-light); }
            .link:focus-visible { outline: 2px solid var(--color-accent-lightest); outline-offset: 4px; }
            .background {
              display: block;
              width: 100%;
              aspect-ratio: 16 / 9;
              object-fit: cover;
              border-radius: 20px;
              background: var(--color-dark-light);
            }
            .services { margin-top: 24px; }
            h2 { margin: 0 0 12px; font-size: 24px; line-height: 32px; font-weight: 700; }
            .service-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 8px; margin: 0; padding: 0; list-style: none; }
            .service {
              display: inline-flex;
              align-items: center;
              justify-content: space-between;
              gap: 12px;
              padding: 12px;
              border-radius: 12px;
              background: var(--color-dark-light);
              font-size: 16px;
              line-height: 24px;
            }
            .service-label { display: inline-flex; align-items: center; gap: 8px; min-width: 0; }
            .service-icon { width: 20px; height: 20px; flex-shrink: 0; color: var(--color-light-deepest); }
            .service-name { overflow-wrap: anywhere; }
            .service-status { display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; padding: 4px 8px; border-radius: 8px; font-size: 12px; line-height: 16px; font-weight: 700; }
            .status-dot { width: 6px; height: 6px; flex-shrink: 0; border-radius: 50%; }
            .is-up .service-status { color: #a9ddb5; background: #4f9a6126; }
            .is-up .status-dot { background: var(--color-system-success); }
            .is-down .status-dot { background: var(--color-system-error); }
            .is-down .service-status { color: #ffadb9; background: #e84a5f26; }
            @media (max-width: 480px) {
              body { padding: 20px 12px; }
              .header { margin-bottom: 12px; padding: 12px; border-radius: 16px; }
              h1 { font-size: 24px; line-height: 32px; }
              .api-label { font-size: 16px; }
              .links { flex-basis: 100%; justify-content: flex-start; }
              .background { border-radius: 16px; }
              .services { margin-top: 20px; }
              h2 { font-size: 20px; line-height: 28px; }
              .service { gap: 8px; font-size: 14px; line-height: 20px; }
            }
          </style>
        </head>
        <body>
          <main>
            <header class="header">
              <h1><span class="brand">Bisky</span> <span class="api-label">API</span></h1>
              <nav class="links" aria-label="Ссылки API">
                <a class="link" href="https://bisky.one/">Основной сайт</a>
                <a class="link" href="/docs">Swagger</a>
                  <a class="link" href="/knowledge/">База знаний</a>
              </nav>
            </header>
            <img class="background" src="/background?request={{backgroundRequest}}" alt="">
            <section class="services" aria-labelledby="services-title">
              <h2 id="services-title">Сервисы</h2>
              <ul class="service-list">{{healthStatuses}}</ul>
            </section>
          </main>
        </body>
      </html>`

export { HOME_PAGE_HTML }
