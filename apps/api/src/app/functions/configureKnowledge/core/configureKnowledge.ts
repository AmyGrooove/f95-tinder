import { resolve } from "node:path"
import { createHash, timingSafeEqual } from "node:crypto"
import fastifyStatic from "@fastify/static"
import type { NestFastifyApplication } from "@nestjs/platform-fastify"
import type { FastifyInstance } from "fastify"

import { InfrastructureConfigService } from "@infrastructure/config/services/config.service"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"

const configureKnowledge = (app: NestFastifyApplication) => {
  const fastify: FastifyInstance = app.getHttpAdapter().getInstance()
  const { username, password } = app.get(InfrastructureConfigService).knowledge
  const credentialsHash = createHash("sha256")
    .update(Buffer.from(`${username}:${password}`, "utf8").toString("base64"))
    .digest()

  fastify.register(async (knowledge) => {
    knowledge.addHook("onSend", async (_request, reply, payload) => {
      reply.header("Cache-Control", "no-store")
      return payload
    })

    knowledge.addHook("onRequest", async (request, reply) => {
      if (
        username.length === 0 ||
        password.length === 0 ||
        username.includes(":")
      ) {
        return reply.code(503).send({
          message: DICTIONARY.knowledge.unavailable,
        })
      }

      const credentials = request.headers.authorization?.match(
        /^Basic ([A-Za-z0-9+/]+={0,2})$/i,
      )?.[1]
      const providedHash = createHash("sha256")
        .update(credentials ?? "")
        .digest()

      if (!timingSafeEqual(credentialsHash, providedHash)) {
        return reply
          .header(
            "WWW-Authenticate",
            'Basic realm="Bisky knowledge", charset="UTF-8"',
          )
          .code(401)
          .send({ message: DICTIONARY.knowledge.unauthorized })
      }
    })

    knowledge.register(fastifyStatic, {
      root: resolve("knowledge"),
      prefix: "/knowledge",
      redirect: true,
      decorateReply: false,
      cacheControl: false,
      dotfiles: "deny",
    })

    knowledge.register(fastifyStatic, {
      root: resolve("docs"),
      prefix: "/knowledge/content/",
      decorateReply: false,
      index: false,
      cacheControl: false,
      dotfiles: "deny",
    })

    knowledge.register(fastifyStatic, {
      root: resolve("node_modules/docsify/lib"),
      prefix: "/knowledge/vendor/",
      decorateReply: false,
      index: false,
      dotfiles: "deny",
      allowedPath: (pathName) => {
        return ["/docsify.min.js", "/plugins/search.min.js"].includes(pathName)
      },
    })
  })
}

export { configureKnowledge }
