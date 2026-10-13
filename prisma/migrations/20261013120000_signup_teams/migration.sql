-- Project signups from checked-in guests, and teams formed at the door.

ALTER TABLE "EventAttendee" ADD COLUMN "lookingForTeam" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Project" ADD COLUMN "productUrl" TEXT,
ADD COLUMN "githubUrl" TEXT,
ADD COLUMN "signedUpByAttendeeId" TEXT;

CREATE UNIQUE INDEX "Project_signedUpByAttendeeId_key" ON "Project"("signedUpByAttendeeId");

ALTER TABLE "Project" ADD CONSTRAINT "Project_signedUpByAttendeeId_fkey" FOREIGN KEY ("signedUpByAttendeeId") REFERENCES "EventAttendee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "open" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "attendeeId" TEXT NOT NULL,
    "host" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Team_eventId_idx" ON "Team"("eventId");

CREATE UNIQUE INDEX "TeamMember_eventId_attendeeId_key" ON "TeamMember"("eventId", "attendeeId");

CREATE INDEX "TeamMember_teamId_idx" ON "TeamMember"("teamId");

ALTER TABLE "Team" ADD CONSTRAINT "Team_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_attendeeId_fkey" FOREIGN KEY ("attendeeId") REFERENCES "EventAttendee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
