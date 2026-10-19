import { Module } from "@nestjs/common"
import { HttpClientModule } from "@nestjs/http-client"

@Module({
  imports: [HttpClientModule.forRoot({ timeout: "10s", retry: false })],
})
class HttpModule {}

export { HttpModule }
