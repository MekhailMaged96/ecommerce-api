import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { ProductEntity } from '../entities/product.entity';

const PRODUCT_INCLUDE = { category: true } as const;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<ProductEntity[]> {
    const products = await this.prisma.product.findMany({ include: PRODUCT_INCLUDE });
    return plainToInstance(ProductEntity, products);
  }

  async findById(id: string): Promise<ProductEntity> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: PRODUCT_INCLUDE,
    });
    if (!product) throw new NotFoundException('Product not found');
    return plainToInstance(ProductEntity, product);
  }

  async create(dto: CreateProductDto): Promise<ProductEntity> {
    const slug = dto.name.toLowerCase().replace(/\s+/g, '-');

    const existing = await this.prisma.product.findUnique({ where: { slug } });
    if (existing) throw new ConflictException('Product with this name already exists');

    const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
    if (!category) throw new NotFoundException('Category not found');

    const product = await this.prisma.product.create({
      data: { ...dto, slug },
      include: PRODUCT_INCLUDE,
    });
    return plainToInstance(ProductEntity, product);
  }

  async update(dto: UpdateProductDto): Promise<ProductEntity> {
    await this.findById(dto.id);

    const { id, ...data } = dto;

    if (data.categoryId) {
      const category = await this.prisma.category.findUnique({ where: { id: data.categoryId } });
      if (!category) throw new NotFoundException('Category not found');
    }

    const slug = data.name ? data.name.toLowerCase().replace(/\s+/g, '-') : undefined;

    const product = await this.prisma.product.update({
      where: { id },
      data: { ...data, ...(slug && { slug }) },
      include: PRODUCT_INCLUDE,
    });
    return plainToInstance(ProductEntity, product);
  }

  async remove(id: string): Promise<boolean> {
    await this.findById(id);
    await this.prisma.product.delete({ where: { id } });
    return true;
  }
}
