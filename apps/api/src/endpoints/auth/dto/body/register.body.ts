import { ApiProperty, ApiSchema } from "@nestjs/swagger"
import { IsEmail, IsString, MinLength } from "class-validator"

@ApiSchema({ name: "RegisterBody" })
class RegisterBodyDto {
  @ApiProperty({ description: "User email address" })
  @IsEmail()
  email!: string

  @ApiProperty({ description: "User password", minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string

  @ApiProperty({ description: "Displayed user name" })
  @IsString()
  @MinLength(2)
  displayName!: string
}

export { RegisterBodyDto }
