-- A feedback reply per guest, and a mark for whether the ask email went out.
--
-- feedbackAskedAt is cleared when a send fails, so pressing the button again
-- retries only the people who never received it.

ALTER TABLE "EventAttendee" ADD COLUMN "feedbackAskedAt" TIMESTAMP(3);

CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "attendeeId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Feedback_attendeeId_key" ON "Feedback"("attendeeId");

CREATE INDEX "Feedback_eventId_idx" ON "Feedback"("eventId");

ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_attendeeId_fkey" FOREIGN KEY ("attendeeId") REFERENCES "EventAttendee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
