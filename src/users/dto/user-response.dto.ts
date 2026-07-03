import { Exclude, Expose, Type } from 'class-transformer';

class UserRoleDto {
  @Expose()
  id!: string;

  @Expose()
  name!: string;
}

class UserRoleMappingDto {
  @Expose()
  @Type(() => UserRoleDto)
  role!: UserRoleDto;
}
