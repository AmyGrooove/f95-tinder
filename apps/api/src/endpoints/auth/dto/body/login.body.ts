import { ApiProperty, ApiSchema } from "@nestjs/swagger"
import { IsEmail, IsString, MinLength } from "class-validator"

@ApiSchema({ name: "LoginBody" })
class LoginBodyDto {
  @ApiProperty({ description: "User email address" })
  @IsEmail()
  email!: string

  @ApiProperty({ description: "User password", minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string
}

export { LoginBodyDto }
