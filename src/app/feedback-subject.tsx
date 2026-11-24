import { ChoiceSheet } from '@/components/ChoiceSheet';
import { FEEDBACK_SUBJECTS } from '@/constants/feedback';
import { setFeedbackSubject, useFeedbackSubject } from '@/store/feedbackDraft';

/**
 * Sheet for the Feedback page's Subject: what part of the app it's about. Opened from the
 * Feedback page (src/app/feedback.tsx); picking one hands it back there and closes the sheet,
 * like Appearance and Haptic Feedback.
 */
export default function FeedbackSubjectScreen() {
  const subject = useFeedbackSubject();

  return (
    <ChoiceSheet
      title="Subject"
      options={FEEDBACK_SUBJECTS}
      value={subject}
      onPick={setFeedbackSubject}
    />
  );
}
