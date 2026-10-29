window.$docsify = {
  name: "База знаний",
  nameLink: "/knowledge/",
  homepage: "readme.md",
  basePath: "/knowledge/content/",
  relativePath: true,
  loadSidebar: true,
  alias: {
    "/_sidebar.md": `${window.location.origin}/knowledge/sidebar.md`,
    "/.*/_sidebar.md": `${window.location.origin}/knowledge/sidebar.md`,
  },
  subMaxLevel: 2,
  auto2top: true,
  executeScript: false,
  externalLinkTarget: "_blank",
  search: {
    paths: "auto",
    placeholder: "Найти в документации…",
    noData: "Ничего не найдено",
    depth: 3,
    namespace: "bisky-knowledge-endpoints",
  },
  plugins: [
    (hook, vm) => {
      hook.afterEach((html) => {
        return vm.route.path === "/"
          ? document.querySelector("#knowledge-home").innerHTML
          : html
      })

      hook.beforeEach((markdown) => {
        const currentFile = new URL(
          vm.router.getFile(vm.route.path),
          window.location.origin,
        )

        return markdown.replace(
          /\[([^\]\n]+)\]\(((?:[^()\r\n]|\([^()\r\n]*\))*)\)/g,
          (match, label, target, offset) => {
            if (/^(?:[a-z][a-z\d+.-]*:|#|\/)/i.test(target)) {
              return match
            }

            const resolved = new URL(target, currentFile)

            if (!resolved.pathname.startsWith("/knowledge/content/")) {
              return `<span class="source-reference" title="Файл в репозитории">${label}</span>`
            }

            if (
              markdown[offset - 1] !== "!" &&
              resolved.pathname.startsWith(
                "/knowledge/content/legacyBiskyV3/screenshots/",
              ) &&
              /\.png$/i.test(resolved.pathname)
            ) {
              return `<img class="layout-preview" src="${resolved.href}" alt="Макет экрана" loading="lazy" decoding="async" />`
            }

            if (/\.(?:json|txt|png)$/i.test(resolved.pathname)) {
              return `[${label}](${resolved.href})`
            }

            return `[${label}](${target.replace(/(^|\/)README\.md(?=[#?]|$)/g, "$1readme.md")})`
          },
        )
      })

      hook.doneEach(() => {
        document.body.dataset.page = vm.route.path === "/" ? "home" : "article"
        document.title =
          vm.route.path === "/"
            ? "База знаний · Bisky"
            : `${document.querySelector(".markdown-section h1")?.textContent ?? "База знаний"} · Bisky`
        const content = document.querySelector(".markdown-section")
        content?.setAttribute("id", "main")
        content?.setAttribute("tabindex", "-1")

        document.querySelector(".sidebar-toggle")?.remove()
        document
          .querySelector(".sidebar")
          ?.setAttribute("id", "knowledge-sidebar")
        document
          .querySelector(".search input")
          ?.setAttribute("aria-label", "Поиск по базе знаний")
      })
    },
  ],
}

document.querySelector(".skip-link").addEventListener("click", (event) => {
  event.preventDefault()
  document.querySelector("#main")?.focus()
})

document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault()
    document.querySelector(".search input")?.focus()
  }
  if (event.key === "Escape") {
    document.querySelector(".search input")?.blur()
  }
})
