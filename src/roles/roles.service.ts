import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { PrismaService } from 'src/prisma/prisma.service';
import { AssignRoleDto } from './dtos/assign-role.dto';
import { CreateRoleDto } from './dtos/create-role.dto';
import { UpdateRoleDto } from './dtos/update-role.dto';
import { RoleEntity } from './entites/role.entity';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<RoleEntity[]> {
    const roles = await this.prisma.role.findMany();
    return plainToInstance(RoleEntity, roles);
  }

  async findById(id: string): Promise<RoleEntity> {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    return plainToInstance(RoleEntity, role);
  }

  async create(dto: CreateRoleDto): Promise<RoleEntity> {
    const existing = await this.prisma.role.findUnique({
      where: { name: dto.name },
    });
    if (existing) throw new ConflictException('Role already exists');

    const role = await this.prisma.role.create({ data: { name: dto.name } });
    return plainToInstance(RoleEntity, role);
  }

  async update(dto: UpdateRoleDto): Promise<RoleEntity> {
    await this.findById(dto.id);

    const role = await this.prisma.role.update({
      where: { id: dto.id },
      data: { name: dto.name },
    });
    return plainToInstance(RoleEntity, role);
  }

  async remove(id: string): Promise<boolean> {
    await this.findById(id);
    await this.prisma.role.delete({ where: { id } });

    return true;
  }

  async assignRole(dto: AssignRoleDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });
    if (!user) throw new NotFoundException('User not found');

    const role = await this.prisma.role.findUnique({
      where: { id: dto.roleId },
    });
    if (!role) throw new NotFoundException('Role not found');

    const existing = await this.prisma.userRole.findFirst({
      where: { userId: dto.userId, roleId: dto.roleId },
    });
    if (existing) throw new ConflictException('Role already assigned to user');

    await this.prisma.userRole.create({
      data: { userId: dto.userId, roleId: dto.roleId },
    });
  }

  async unassignRole(dto: AssignRoleDto): Promise<void> {
    const userRole = await this.prisma.userRole.findFirst({
      where: { userId: dto.userId, roleId: dto.roleId },
    });
    if (!userRole) throw new NotFoundException('UserRole not found');

    await this.prisma.userRole.delete({
      where: { userId_roleId: { userId: dto.userId, roleId: dto.roleId } },
    });
  }
}
