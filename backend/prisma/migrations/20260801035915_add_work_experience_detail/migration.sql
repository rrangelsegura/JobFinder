-- CreateTable
CREATE TABLE "work_experience_responsibilities" (
    "id" SERIAL NOT NULL,
    "text" TEXT NOT NULL,
    "workExperienceId" INTEGER NOT NULL,

    CONSTRAINT "work_experience_responsibilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "workExperienceId" INTEGER NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_achievements" (
    "id" SERIAL NOT NULL,
    "text" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,

    CONSTRAINT "project_achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_stack_items" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "projectId" INTEGER NOT NULL,

    CONSTRAINT "project_stack_items_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "work_experience_responsibilities" ADD CONSTRAINT "work_experience_responsibilities_workExperienceId_fkey" FOREIGN KEY ("workExperienceId") REFERENCES "work_experiences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_workExperienceId_fkey" FOREIGN KEY ("workExperienceId") REFERENCES "work_experiences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_achievements" ADD CONSTRAINT "project_achievements_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_stack_items" ADD CONSTRAINT "project_stack_items_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
