let diagramRendererPromise
let diagramSequence = 0

const DIAGRAM_TYPES = {
  http: "HTTP",
  action: "Прямой вызов",
  data: "Данные",
  queue: "Очередь",
  job: "Фоновая джоба",
  event: "Событие",
  external: "Внешний сервис",
}

const loadDiagramRenderer = () => {
  diagramRendererPromise ??=
    import("/knowledge/vendor/mermaid/mermaid.esm.min.mjs").then(
      ({ default: mermaid }) => {
        const styles = getComputedStyle(document.documentElement)

        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          suppressErrorRendering: true,
          htmlLabels: false,
          theme: "base",
          fontFamily: "Roboto, Arial, sans-serif",
          themeVariables: {
            darkMode: true,
            fontSize: "15px",
            background: styles.getPropertyValue("--background").trim(),
            primaryColor: styles.getPropertyValue("--surface-raised").trim(),
            primaryTextColor: styles.getPropertyValue("--text").trim(),
            primaryBorderColor: styles.getPropertyValue("--muted").trim(),
            lineColor: styles.getPropertyValue("--muted").trim(),
            secondaryColor: styles.getPropertyValue("--surface").trim(),
            tertiaryColor: styles.getPropertyValue("--background").trim(),
            clusterBkg: styles.getPropertyValue("--background").trim(),
            clusterBorder: styles.getPropertyValue("--border").trim(),
            edgeLabelBackground: styles.getPropertyValue("--surface").trim(),
          },
          flowchart: {
            htmlLabels: false,
            useMaxWidth: false,
            curve: "basis",
            nodeSpacing: 40,
            rankSpacing: 34,
            padding: 16,
            wrappingWidth: 240,
          },
        })

        return mermaid
      },
    )

  return diagramRendererPromise
}

const renderKnowledgeDiagrams = async () => {
  const diagrams = document.querySelectorAll(
    ".knowledge-diagram:not([data-rendered])",
  )

  for (const diagram of diagrams) {
    diagram.dataset.rendered = "true"
    const view = diagram.querySelector(".diagram-view")
    const source = diagram.querySelector("code").textContent

    try {
      const mermaid = await loadDiagramRenderer()

      if (!diagram.isConnected) {
        continue
      }

      const styles = getComputedStyle(document.documentElement)
      const classes = Object.keys(DIAGRAM_TYPES)
        .map((name) => {
          const fill = styles.getPropertyValue(`--diagram-${name}-fill`).trim()
          const stroke = styles
            .getPropertyValue(`--diagram-${name}-stroke`)
            .trim()
          const text = styles.getPropertyValue("--text").trim()

          return `classDef ${name} fill:${fill},stroke:${stroke},stroke-width:1.25px,color:${text}`
        })
        .join("\n")
      const definition = /^\s*(?:flowchart|graph)\b/.test(source)
        ? `${source}\n${classes}`
        : source
      const { svg } = await mermaid.render(
        `knowledge-diagram-${diagramSequence++}`,
        definition,
        view,
      )

      if (diagram.isConnected) {
        view.innerHTML = svg
        view.removeAttribute("role")
        diagram.querySelector(".diagram-title").textContent =
          view.querySelector("svg title")?.textContent ?? "Сценарий запроса"

        const legend = diagram.querySelector(".diagram-legend")

        for (const [name, label] of Object.entries(DIAGRAM_TYPES)) {
          if (!view.querySelector(`.node.${name}`)) {
            continue
          }

          const item = document.createElement("span")
          item.className = "diagram-legend-item"
          const swatch = document.createElement("span")
          swatch.className = "diagram-swatch"
          swatch.setAttribute("aria-hidden", "true")
          swatch.style.backgroundColor = styles
            .getPropertyValue(`--diagram-${name}-stroke`)
            .trim()
          item.append(swatch, document.createTextNode(label))
          legend.append(item)
        }
      }
    } catch (error) {
      view.textContent =
        "Не удалось показать схему. Открой исходник ниже; если схема корректна, попробуй перезагрузить страницу."
      view.setAttribute("role", "alert")
      diagram.querySelector("details").open = true
      console.error("Не удалось отобразить диаграмму knowledge", error)
    }
  }
}

window.$docsify.markdown = {
  renderer: {
    code({ text, lang }) {
      if (lang !== "mermaid") {
        return this.origin.code.apply(this, arguments)
      }

      const source = document.createElement("code")
      source.textContent = text.replace(/@DOCSIFY_QM@/g, "`")

      return `<figure class="knowledge-diagram">
        <figcaption class="diagram-header">
          <div><span class="diagram-eyebrow">Схема выполнения</span><strong class="diagram-title">Сценарий запроса</strong></div>
          <a class="diagram-help" href="/knowledge/#/api/requestFlows/readme?id=Как-читать-схему">Обозначения</a>
        </figcaption>
        <div class="diagram-view" role="status" tabindex="0" aria-label="Схема выполнения запроса">Загружаем схему…</div>
        <div class="diagram-legend" role="group" aria-label="Типы блоков на этой схеме"></div>
        <details class="diagram-source"><summary>Исходник схемы</summary><pre>${source.outerHTML}</pre></details>
      </figure>`
    },
  },
}

window.$docsify.plugins.push((hook) => {
  hook.doneEach(renderKnowledgeDiagrams)
})
