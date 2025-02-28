import {t} from 'app/locale';
import {SchemaFormConfig} from 'app/views/organizationIntegrations/sentryAppExternalForm';

export enum AlertRuleThresholdType {
  ABOVE,
  BELOW,
}

export enum AlertRuleComparisonType {
  COUNT = 'count',
  CHANGE = 'change',
}

export enum Dataset {
  ERRORS = 'events',
  TRANSACTIONS = 'transactions',
  SESSIONS = 'sessions',
}

export enum EventTypes {
  DEFAULT = 'default',
  ERROR = 'error',
  TRANSACTION = 'transaction',
  USER = 'user',
  SESSION = 'session',
}

export enum Datasource {
  ERROR_DEFAULT = 'error_default',
  DEFAULT = 'default',
  ERROR = 'error',
  TRANSACTION = 'transaction',
}

/**
 * This is not a real aggregate as crash-free sessions/users can be only calculated on frontend by comparing the count of sessions broken down by status
 * It is here nevertheless to shoehorn sessions dataset into existing alerts codebase
 * This will most likely be revised as we introduce the metrics dataset
 */
export enum SessionsAggregate {
  CRASH_FREE_SESSIONS = 'percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate',
  CRASH_FREE_USERS = 'percentage(users_crashed, users) AS _crash_rate_alert_aggregate',
}

export type UnsavedTrigger = {
  // UnsavedTrigger can be apart of an Unsaved Alert Rule that does not have an
  // id yet
  alertRuleId?: string;
  label: string;
  alertThreshold: number | '' | null;
  actions: Action[];
};

export type ThresholdControlValue = {
  thresholdType: AlertRuleThresholdType;
  /**
   * Resolve threshold is optional, so it can be null
   */
  threshold: number | '' | null;
};

type SavedTrigger = Omit<UnsavedTrigger, 'actions'> & {
  id: string;
  dateCreated: string;
  actions: Action[];
};

export type Trigger = Partial<SavedTrigger> & UnsavedTrigger;

export type UnsavedIncidentRule = {
  dataset: Dataset;
  projects: string[];
  environment: string | null;
  query: string;
  timeWindow: TimeWindow;
  triggers: Trigger[];
  aggregate: string;
  thresholdType: AlertRuleThresholdType;
  resolveThreshold: number | '' | null;
  comparisonDelta?: number | null;
  eventTypes?: EventTypes[];
  owner?: string | null;
};

export type SavedIncidentRule = UnsavedIncidentRule & {
  dateCreated: string;
  dateModified: string;
  id: string;
  status: number;
  name: string;
  createdBy?: {id: number; email: string; name: string} | null;
  originalAlertRuleId?: number | null;
};

export type IncidentRule = Partial<SavedIncidentRule> & UnsavedIncidentRule;

export enum TimePeriod {
  SIX_HOURS = '6h',
  ONE_DAY = '1d',
  THREE_DAYS = '3d',
  // Seven days is actually 10080m but we have a max of 10000 events
  SEVEN_DAYS = '10000m',
  FOURTEEN_DAYS = '14d',
  THIRTY_DAYS = '30d',
}

export enum TimeWindow {
  ONE_MINUTE = 1,
  FIVE_MINUTES = 5,
  TEN_MINUTES = 10,
  FIFTEEN_MINUTES = 15,
  THIRTY_MINUTES = 30,
  ONE_HOUR = 60,
  TWO_HOURS = 120,
  FOUR_HOURS = 240,
  ONE_DAY = 1440,
}

export enum ActionType {
  EMAIL = 'email',
  SLACK = 'slack',
  PAGERDUTY = 'pagerduty',
  MSTEAMS = 'msteams',
  SENTRY_APP = 'sentry_app',
}

export const ActionLabel = {
  [ActionType.EMAIL]: t('Email'),
  [ActionType.SLACK]: t('Slack'),
  [ActionType.PAGERDUTY]: t('Pagerduty'),
  [ActionType.MSTEAMS]: t('MS Teams'),
  [ActionType.SENTRY_APP]: t('Notification'),
};

export enum TargetType {
  // A direct reference, like an email address, Slack channel, or PagerDuty service
  SPECIFIC = 'specific',

  // A specific user. This could be used to grab the user's email address.
  USER = 'user',

  // A specific team. This could be used to send an email to everyone associated with a team.
  TEAM = 'team',

  // A Sentry App instead of any of the above.
  SENTRY_APP = 'sentry_app',
}

export const TargetLabel = {
  [TargetType.USER]: t('Member'),
  [TargetType.TEAM]: t('Team'),
};

/**
 * This is an available action template that is associated to a Trigger in a
 * Metric Alert Rule. They are defined by the available-actions API.
 */
export type MetricActionTemplate = {
  /**
   * The integration type e.g. 'email'
   */
  type: ActionType;

  /**
   * See `TargetType`
   */
  allowedTargetTypes: TargetType[];

  /**
   * Name of the integration. This is a text field that differentiates integrations from the same provider from each other
   */
  integrationName?: string;

  /**
   * Integration id for this `type`, should be passed to backend as `integrationId` when creating an action
   */
  integrationId?: number;

  /**
   * Name of the SentryApp. Like `integrationName`, this differentiates SentryApps from each other.
   */
  sentryAppName?: string;

  /**
   * SentryApp id for this `type`, should be passed to backend as `sentryAppId` when creating an action.
   */
  sentryAppId?: number;

  sentryAppInstallationUuid?: string;
  /**
   * For some available actions, we pass in the list of available targets.
   */
  options?: Array<{label: string; value: any}>;

  /**
   * If this is a `sentry_app` action, this is the Sentry App's status.
   */
  status?: 'unpublished' | 'published' | 'internal';

  /**
   * Sentry App Alert Rule UI Component settings
   */
  settings?: SchemaFormConfig;
};

/**
 * This is the user's configured action
 */
export type Action = UnsavedAction & Partial<SavedActionFields>;
export type SavedAction = Omit<UnsavedAction, 'unsavedDateCreated' | 'unsavedId'> &
  SavedActionFields;

type SavedActionFields = {
  /**
   * The id of the alert rule this action belongs to
   */
  alertRuleTriggerId: string;

  /**
   * A human readable description of the action generated by server
   */
  desc: string;

  /**
   * model id of the action
   */
  id: string;

  /**
   * date created
   */
  dateCreated: string;
};

type UnsavedAction = {
  unsavedId: string;
  /** Used to maintain order of unsaved actions */
  unsavedDateCreated: string;
  type: ActionType;

  targetType: TargetType | null;

  /**
   * How to identify the target. Can be email, slack channel, pagerduty service,
   * user_id, team_id, SentryApp id, etc
   */
  targetIdentifier: string | null;
  /**
   * An optional Slack channel or user id the user can input to avoid rate limiting issues.
   */
  inputChannelId: string | null;
  /**
   * The id of the integration, can be null (e.g. email) or undefined (server errors when posting w/ null value)
   */
  integrationId?: number | null;

  /**
   * The id of the SentryApp, can be null (e.g. email) or undefined (server errors when posting w/ null value)
   */
  sentryAppId?: number | null;

  /**
   * For some available actions, we pass in the list of available targets.
   */
  options: Array<{label: string; value: any}> | null;

  /**
   * If this is a `sentry_app` action, this is the Sentry App's status.
   */
  status?: 'unpublished' | 'published' | 'internal';
};
