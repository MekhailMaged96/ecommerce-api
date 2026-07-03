import { PrismaClient } from '../../generated/prisma/client';

const categories = [
  { name: 'Electronics', slug: 'electronics' },
  { name: 'Clothing', slug: 'clothing' },
  { name: 'Books', slug: 'books' },
  { name: 'Home & Garden', slug: 'home-garden' },
  { name: 'Sports & Outdoors', slug: 'sports-outdoors' },
  { name: 'Toys & Games', slug: 'toys-games' },
  { name: 'Health & Beauty', slug: 'health-beauty' },
  { name: 'Automotive', slug: 'automotive' },
];

export async function seedCategories(prisma: PrismaClient) {
  console.log('Seeding categories...');

  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {},
      create: category,
    });
  }

  console.log(`✓ Seeded ${categories.length} categories.`);
}
