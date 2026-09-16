import { closePool } from './pool.js';
import { seedSystemCategories } from './systemCategories.js';

async function seed() {
  const count = await seedSystemCategories();
  console.log(`Seeded ${count} system categories.`);
  await closePool();
}

seed().catch(async (err) => {
  console.error(err);
  await closePool();
  process.exit(1);
});
