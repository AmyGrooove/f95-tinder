import { registerAs } from "@nestjs/config"

import { createInfrastructureConfiguration } from "../functions/createInfrastructureConfiguration"

const INFRASTRUCTURE_CONFIGURATION = registerAs(
  "infrastructure",
  createInfrastructureConfiguration,
)

export { INFRASTRUCTURE_CONFIGURATION }
