import { Expose, Type } from 'class-transformer';
import { RoleEntity } from 'src/roles/entites/role.entity';

export class UserRoleEntity {
  @Expose()
  @Type(() => RoleEntity)
  role!: RoleEntity;
}
