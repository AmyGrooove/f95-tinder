import { Module } from "@nestjs/common"

import { FactModule } from "@entities/fact/fact.module"

import { FactController } from "./controllers/factController"
import { FactService } from "./services/factService"

@Module({
  imports: [FactModule],
  controllers: [FactController],
  providers: [FactService],
})
class FactEndpointModule {}

export { FactEndpointModule }
