-- The language each user picked in the app (null until the app reports it).
ALTER TABLE "User" ADD COLUMN "language" TEXT;
