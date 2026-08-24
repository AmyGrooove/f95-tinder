import { ApiProperty, ApiPropertyOptional, ApiSchema } from "@nestjs/swagger"
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { IsDate, IsEmail, IsIn, IsOptional, IsString } from "class-validator"
import { Schema as MongooseSchema, Types } from "mongoose"
import type { HydratedDocument } from "mongoose"

import { USER_ROLES, type TUserRole } from "./userRole.schema"
import { USER_STATUSES, type TUserStatus } from "./userStatus.schema"

@ApiSchema({ name: "User", description: "Application user account" })
@Schema({ collection: "User" })
class User {
  @Prop({ type: MongooseSchema.Types.ObjectId })
  @ApiProperty({ description: "User identifier", type: String })
  _id!: Types.ObjectId

  @Prop({ type: String, required: true, lowercase: true, trim: true })
  @ApiProperty({ description: "User email address" })
  @IsEmail()
  email!: string

  @Prop({ type: String, required: true })
  @ApiProperty({ description: "Password hash" })
  @IsString()
  passwordHash!: string

  @Prop({ type: String, required: true, trim: true })
  @ApiProperty({ description: "Displayed user name" })
  @IsString()
  displayName!: string

  @Prop({ type: String, enum: USER_ROLES, default: "user" })
  @ApiProperty({ description: "User role", enum: USER_ROLES })
  @IsIn(USER_ROLES)
  role!: TUserRole

  @Prop({ type: String, enum: USER_STATUSES, default: "active" })
  @ApiProperty({ description: "User status", enum: USER_STATUSES })
  @IsIn(USER_STATUSES)
  status!: TUserStatus

  @Prop({ type: Date, default: null })
  @ApiPropertyOptional({
    description: "Last successful login date",
    nullable: true,
  })
  @IsOptional()
  @IsDate()
  lastLoginAt!: Date | null

  @ApiProperty({ description: "Creation date" })
  createdAt!: Date

  @ApiProperty({ description: "Update date" })
  updatedAt!: Date
}

const UserSchema = SchemaFactory.createForClass(User)

UserSchema.index({ email: 1 }, { unique: true })

type UserDocument = HydratedDocument<User>

export { User, type UserDocument, UserSchema }
