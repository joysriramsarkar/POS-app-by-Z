const config = {
  seed: "tsx prisma/seed.ts",
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
      directUrl: process.env.DIRECT_URL,
    },
  },
};

export default config;
