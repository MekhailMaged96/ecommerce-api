import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { CategoryEntity } from '../entities/category.entity';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async findAll(): Promise<CategoryEntity[]> {
    const cached =
      await this.cacheManager.get<CategoryEntity[]>(`categories:all`);
    if (cached) return cached;

    const categories = await this.prisma.category.findMany();
    await this.cacheManager.set(`categories:all`, categories, 60000);
    return plainToInstance(CategoryEntity, categories);
  }

  async findById(id: string): Promise<CategoryEntity> {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');
    return plainToInstance(CategoryEntity, category);
  }

  async create(dto: CreateCategoryDto): Promise<CategoryEntity> {
    const slug = dto.name.toLowerCase().replace(/\s+/g, '-');

    const existing = await this.prisma.category.findUnique({ where: { slug } });
    if (existing) throw new ConflictException('Category already exists');

    const category = await this.prisma.category.create({
      data: { name: dto.name, slug },
    });
    return plainToInstance(CategoryEntity, category);
  }

  async update(dto: UpdateCategoryDto): Promise<CategoryEntity> {
    await this.findById(dto.id);

    const slug = dto.name
      ? dto.name.toLowerCase().replace(/\s+/g, '-')
      : undefined;

    const category = await this.prisma.category.update({
      where: { id: dto.id },
      data: { ...(dto.name && { name: dto.name }), ...(slug && { slug }) },
    });
    return plainToInstance(CategoryEntity, category);
  }

  async remove(id: string): Promise<boolean> {
    await this.findById(id);
    await this.prisma.category.delete({ where: { id } });
    return true;
  }
}
