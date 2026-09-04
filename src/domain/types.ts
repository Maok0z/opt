export type ChoiceStatus = 'unjudged' | 'green' | 'red';

export interface Choice {
  id: string;
  text: string;
  occurredAt: string;
  localDate: string;
  status: ChoiceStatus;
  judgedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DayRecord {
  localDate: string;
  note: string;
}

export interface Settings {
  reviewTime: string;
  reminderEnabled: boolean;
  notificationPreference: 'default' | 'granted' | 'denied' | 'unsupported';
  historyHintSeen: boolean;
  latestSeenDate: string;
}

export interface OptData {
  version: 1;
  choices: Choice[];
  days: Record<string, DayRecord>;
  settings: Settings;
}

export interface ChoiceStats {
  green: number;
  red: number;
  unjudged: number;
  total: number;
  greenPercent: number;
  redPercent: number;
  unjudgedPercent: number;
}
