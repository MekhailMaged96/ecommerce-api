import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';
import { RoleEntity } from 'src/roles/entites/role.entity';
import { UserRoleEntity } from './user-role.entity';

export class UserEntity {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty()
  @Expose()
  email: string;

  @ApiPropertyOptional()
  @Expose()
  firstName: string | null;

  @ApiPropertyOptional()
  @Expose()
  lastName: string | null;

  @ApiPropertyOptional()
  @Expose()
  phone: string | null;

  @ApiProperty()
  @Expose()
  isActive: boolean;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiPropertyOptional()
  @Expose()
  updatedAt: Date | null;

  @ApiPropertyOptional({ type: () => [UserRoleEntity] })
  @Expose()
  @Type(() => UserRoleEntity)
  roles: UserRoleEntity[];

  @Exclude()
  password: string;
}
