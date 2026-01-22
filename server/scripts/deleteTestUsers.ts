import { PrismaClient } from '@prisma/client'

// Allow passing DATABASE_URL as command line argument or environment variable
const databaseUrl = process.argv[2] || process.env.DATABASE_URL

if (!databaseUrl) {
  console.error('Usage: npx ts-node scripts/deleteTestUsers.ts <DATABASE_URL>')
  console.error('Or set DATABASE_URL environment variable')
  process.exit(1)
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
})

async function main() {
  console.log('Connecting to database...')

  // Find users with @test.com email
  const testUsers = await prisma.user.findMany({
    where: {
      email: {
        endsWith: '@test.com'
      }
    },
    select: {
      id: true,
      email: true,
      displayName: true,
      createdAt: true
    }
  })

  console.log(`Found ${testUsers.length} users with @test.com email`)

  if (testUsers.length === 0) {
    console.log('No users to delete.')
    return
  }

  // Show first 10 for preview
  console.log('Sample of users to delete:')
  testUsers.slice(0, 10).forEach(u => {
    console.log(`  - ${u.email} (${u.displayName})`)
  })
  if (testUsers.length > 10) {
    console.log(`  ... and ${testUsers.length - 10} more`)
  }

  // Delete the users (cascade will handle related records)
  console.log('\nDeleting users...')
  const result = await prisma.user.deleteMany({
    where: {
      email: {
        endsWith: '@test.com'
      }
    }
  })

  console.log(`Successfully deleted ${result.count} users with @test.com email`)
}

main()
  .catch((error) => {
    console.error('Error:', error.message)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
