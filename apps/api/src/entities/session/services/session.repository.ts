import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { Model, Types } from "mongoose"

import { Session, type SessionDocument } from "../schemas/session.schema"
import type { TCreateSessionPayload } from "../types/TCreateSessionPayload"

@Injectable()
class SessionRepository {
  constructor(
    @InjectModel(Session.name)
    private readonly sessionModel: Model<SessionDocument>,
  ) {}

  createSession(payload: TCreateSessionPayload): Promise<SessionDocument> {
    return this.sessionModel.create(payload)
  }

  findSession(
    sessionId: string | Types.ObjectId,
  ): Promise<SessionDocument | null> {
    return this.sessionModel.findById(sessionId).exec()
  }

  deleteSession(
    sessionId: string | Types.ObjectId,
  ): Promise<SessionDocument | null> {
    return this.sessionModel.findByIdAndDelete(sessionId).exec()
  }
}

export { SessionRepository }
