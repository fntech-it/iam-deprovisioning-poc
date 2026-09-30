-- CreateEnum
CREATE TYPE "StatoUtenza" AS ENUM ('attivo', 'sospeso', 'deprovisioned');

-- CreateEnum
CREATE TYPE "OrigineUtenza" AS ENUM ('manuale', 'import');

-- CreateTable
CREATE TABLE "utenze" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cognome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "stato" "StatoUtenza" NOT NULL DEFAULT 'attivo',
    "data_creazione" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "origine" "OrigineUtenza" NOT NULL DEFAULT 'manuale',

    CONSTRAINT "utenze_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ruoli" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "descrizione" TEXT,
    "creato_da_import" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ruoli_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permessi" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "descrizione" TEXT,

    CONSTRAINT "permessi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_RuoloToUtenza" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_RuoloToUtenza_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_PermessoToRuolo" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_PermessoToRuolo_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "utenze_username_key" ON "utenze"("username");

-- CreateIndex
CREATE UNIQUE INDEX "utenze_email_key" ON "utenze"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ruoli_nome_key" ON "ruoli"("nome");

-- CreateIndex
CREATE INDEX "_RuoloToUtenza_B_index" ON "_RuoloToUtenza"("B");

-- CreateIndex
CREATE INDEX "_PermessoToRuolo_B_index" ON "_PermessoToRuolo"("B");

-- AddForeignKey
ALTER TABLE "_RuoloToUtenza" ADD CONSTRAINT "_RuoloToUtenza_A_fkey" FOREIGN KEY ("A") REFERENCES "ruoli"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RuoloToUtenza" ADD CONSTRAINT "_RuoloToUtenza_B_fkey" FOREIGN KEY ("B") REFERENCES "utenze"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PermessoToRuolo" ADD CONSTRAINT "_PermessoToRuolo_A_fkey" FOREIGN KEY ("A") REFERENCES "permessi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PermessoToRuolo" ADD CONSTRAINT "_PermessoToRuolo_B_fkey" FOREIGN KEY ("B") REFERENCES "ruoli"("id") ON DELETE CASCADE ON UPDATE CASCADE;
