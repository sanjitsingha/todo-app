// Just these icons, not the whole icon set.
import Bug from 'lucide-react-native/icons/bug';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import CircleUserRound from 'lucide-react-native/icons/circle-user-round';
import Lightbulb from 'lucide-react-native/icons/lightbulb';
import ListTodo from 'lucide-react-native/icons/list-todo';
import MessageCircleMore from 'lucide-react-native/icons/message-circle-more';
import Palette from 'lucide-react-native/icons/palette';

import type { Choice } from '@/components/ChoiceSheet';
import type { FeedbackSubject } from '@/lib/database.types';

/**
 * The Subject sheet's options (src/app/feedback-subject.tsx): what part of the app the feedback
 * is about. The values are what's saved (the feedback table's check in
 * supabase/migrations/20261124120000_feedback.sql lists them too; keep them in step).
 */
export const FEEDBACK_SUBJECTS: readonly Choice<FeedbackSubject>[] = [
  { value: 'bug', label: 'Something isn’t working', icon: Bug },
  { value: 'idea', label: 'Feature idea', icon: Lightbulb },
  { value: 'todos', label: 'Todos & reminders', icon: ListTodo },
  { value: 'calendar', label: 'Google Calendar', icon: CalendarDays },
  { value: 'account', label: 'Account & sign-in', icon: CircleUserRound },
  { value: 'design', label: 'Look & feel', icon: Palette },
  { value: 'other', label: 'Something else', icon: MessageCircleMore },
];

/** Longest message it takes (the table allows the same). */
export const MAX_FEEDBACK_LENGTH = 2000;
