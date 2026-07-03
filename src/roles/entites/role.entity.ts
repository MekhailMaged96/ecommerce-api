import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class RoleEntity {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty()
  @Expose()
  name: string;
}
